import { chatJSON } from './openai'
import { normalize, todayISO } from './format'
import {
  appendNotes,
  blankCompany,
  blankMeeting,
  blankPerson,
  blankTask,
  fullName,
  getDB,
  saveCompany,
  saveMeeting,
  savePerson,
  saveTask,
} from '../store/db'
import type { Company, DB, Person } from '../types'

/** A reference is either an existing record id or a `new:*` ref to a proposal in the same batch. */
export type Ref = string

export type Proposal =
  | { kind: 'create_company'; ref: Ref; name: string; industry: string; street: string; zip: string; city: string; phone: string; email: string; notes: string }
  | { kind: 'create_person'; ref: Ref; firstName: string; lastName: string; role: string; phone: string; email: string; notes: string; companyRefs: Ref[] }
  | { kind: 'create_meeting'; date: string; title: string; summary: string; companyRefs: Ref[]; personRefs: Ref[] }
  | { kind: 'create_task'; title: string; due: string; companyRef?: Ref; personRef?: Ref }
  | { kind: 'add_note'; targetRef: Ref; text: string }

export type ProposalKind = Proposal['kind']

export interface ReviewItem {
  key: string
  accepted: boolean
  proposal: Proposal
}

const isNew = (ref?: Ref) => !!ref && ref.startsWith('new:')

/* ---------- matching existing records ---------- */

const LEGAL = /\b(ag|gmbh|sa|sarl|kg|co|und|&|partner|ltd|inc)\b/g
const companyKey = (name: string) => normalize(name).replace(LEGAL, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function findCompany(db: DB, name: string): Company | undefined {
  const k = companyKey(name)
  if (!k) return
  return (
    db.companies.find((c) => companyKey(c.name) === k) ??
    db.companies.find((c) => {
      const ck = companyKey(c.name)
      return ck.length > 4 && k.length > 4 && (ck.includes(k) || k.includes(ck))
    })
  )
}

export function findPerson(db: DB, firstName: string, lastName: string): Person | undefined {
  const f = normalize(firstName)
  const l = normalize(lastName)
  if (!l) return
  return db.people.find((p) => normalize(p.lastName) === l && (!f || normalize(p.firstName) === f))
}

/* ---------- AI interpretation ---------- */

interface RawAction {
  type: ProposalKind
  ref?: string
  [k: string]: unknown
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])

function context(db: DB) {
  const companies = db.companies.map((c) => `${c.id} | ${c.name} | ${c.city}`).join('\n')
  const people = db.people
    .map((p) => `${p.id} | ${fullName(p)} | ${p.role} | companies: ${p.companyIds.join(',')}`)
    .join('\n')
  return { companies, people }
}

function systemPrompt(db: DB) {
  const { companies, people } = context(db)
  const today = new Date()
  const weekday = today.toLocaleDateString('en-GB', { weekday: 'long' })
  return `You are the assistant of a field sales rep at a Swiss glass manufacturer.
Turn the rep's spoken note into CRM actions. Today is ${weekday}, ${todayISO()}.

Rules:
- Reuse existing records. If a company or person in the note matches one below (even roughly, e.g. without "AG", a nickname or a typo), reference its id and do NOT create it again.
- Only create a company/person when it clearly does not exist. Give new records a ref like "new:c1" / "new:p1" and use that ref to link other actions to them.
- A meeting is something that already happened ("I just met…", "we discussed…"). Summarise what was discussed, keep all facts, products, quantities and wishes.
- A task is something the rep must do later ("remind me", "send offer", "call back"). Short imperative title. Resolve relative dates ("Friday", "next week") to YYYY-MM-DD, always in the future.
- Use add_note for lasting facts about an existing record that are not a meeting or a task (e.g. new phone number, preferences).
- Write text in the language the rep spoke.
- Leave unknown fields as empty strings. Never invent phone numbers or emails.

Return JSON: {"actions": [ ... ]} where each action is one of:
{"type":"create_company","ref":"new:c1","name":"","industry":"","street":"","zip":"","city":"","phone":"","email":"","notes":""}
{"type":"create_person","ref":"new:p1","firstName":"","lastName":"","role":"","phone":"","email":"","notes":"","companyRefs":["<id or new ref>"]}
{"type":"create_meeting","date":"YYYY-MM-DD","title":"","summary":"","companyRefs":[],"personRefs":[]}
{"type":"create_task","title":"","due":"YYYY-MM-DD or empty","companyRef":"","personRef":""}
{"type":"add_note","targetRef":"<existing id>","text":""}

Existing companies (id | name | city):
${companies}

Existing people (id | name | role | company ids):
${people}`
}

export async function interpret(text: string): Promise<ReviewItem[]> {
  const db = getDB()
  const res = await chatJSON<{ actions?: RawAction[] }>(systemPrompt(db), text)
  return resolve(db, res.actions ?? [])
}

/** Normalise AI output and guard against duplicates the model missed. */
export function resolve(db: DB, actions: RawAction[]): ReviewItem[] {
  const remap = new Map<string, string>()
  const valid = (ref: string) =>
    isNew(ref) || db.companies.some((c) => c.id === ref) || db.people.some((p) => p.id === ref)
  const fix = (ref: string) => remap.get(ref) ?? ref

  const proposals: Proposal[] = []
  for (const a of actions) {
    switch (a.type) {
      case 'create_company': {
        const ref = str(a.ref) || `new:c${proposals.length}`
        const existing = findCompany(db, str(a.name))
        if (existing) {
          remap.set(ref, existing.id)
          if (str(a.notes)) proposals.push({ kind: 'add_note', targetRef: existing.id, text: str(a.notes) })
          break
        }
        if (!str(a.name)) break
        proposals.push({
          kind: 'create_company', ref, name: str(a.name), industry: str(a.industry), street: str(a.street),
          zip: str(a.zip), city: str(a.city), phone: str(a.phone), email: str(a.email), notes: str(a.notes),
        })
        break
      }
      case 'create_person': {
        const ref = str(a.ref) || `new:p${proposals.length}`
        const existing = findPerson(db, str(a.firstName), str(a.lastName))
        if (existing) {
          remap.set(ref, existing.id)
          if (str(a.notes)) proposals.push({ kind: 'add_note', targetRef: existing.id, text: str(a.notes) })
          break
        }
        if (!str(a.firstName) && !str(a.lastName)) break
        proposals.push({
          kind: 'create_person', ref, firstName: str(a.firstName), lastName: str(a.lastName), role: str(a.role),
          phone: str(a.phone), email: str(a.email), notes: str(a.notes), companyRefs: arr(a.companyRefs),
        })
        break
      }
      case 'create_meeting':
        proposals.push({
          kind: 'create_meeting', date: /^\d{4}-\d{2}-\d{2}$/.test(str(a.date)) ? str(a.date) : todayISO(),
          title: str(a.title), summary: str(a.summary), companyRefs: arr(a.companyRefs), personRefs: arr(a.personRefs),
        })
        break
      case 'create_task':
        if (!str(a.title)) break
        proposals.push({
          kind: 'create_task', title: str(a.title), due: /^\d{4}-\d{2}-\d{2}$/.test(str(a.due)) ? str(a.due) : '',
          companyRef: str(a.companyRef) || undefined, personRef: str(a.personRef) || undefined,
        })
        break
      case 'add_note':
        if (str(a.text) && str(a.targetRef)) proposals.push({ kind: 'add_note', targetRef: str(a.targetRef), text: str(a.text) })
        break
    }
  }

  // Apply remapping and drop references to unknown records.
  const clean = (refs: string[]) => [...new Set(refs.map(fix).filter(valid))]
  const one = (ref?: string) => (ref && valid(fix(ref)) ? fix(ref) : undefined)
  const fixed = proposals
    .map((p): Proposal | null => {
      switch (p.kind) {
        case 'create_person':
          return { ...p, companyRefs: clean(p.companyRefs) }
        case 'create_meeting':
          return { ...p, companyRefs: clean(p.companyRefs), personRefs: clean(p.personRefs) }
        case 'create_task':
          return { ...p, companyRef: one(p.companyRef), personRef: one(p.personRef) }
        case 'add_note': {
          const target = one(p.targetRef)
          return target ? { ...p, targetRef: target } : null
        }
        default:
          return p
      }
    })
    .filter((p): p is Proposal => !!p)

  // A meeting or task with a person but no company inherits the person's single company.
  const companyOf = (personRef?: string) => {
    if (!personRef) return undefined
    const np = fixed.find((p) => p.kind === 'create_person' && p.ref === personRef)
    const ids = np?.kind === 'create_person' ? np.companyRefs : db.people.find((p) => p.id === personRef)?.companyIds ?? []
    return ids.length === 1 ? ids[0] : undefined
  }
  for (const p of fixed) {
    if (p.kind === 'create_task' && !p.companyRef) p.companyRef = companyOf(p.personRef)
    if (p.kind === 'create_meeting' && p.companyRefs.length === 0) {
      const c = p.personRefs.map(companyOf).find(Boolean)
      if (c) p.companyRefs = [c]
    }
  }

  return fixed.map((proposal, i) => ({ key: `${i}-${proposal.kind}`, accepted: true, proposal }))
}

/* ---------- saving ---------- */

export function applyProposals(items: ReviewItem[]) {
  const accepted = items.filter((i) => i.accepted).map((i) => i.proposal)
  const ids = new Map<string, string>()
  const resolveRef = (ref?: string) => (ref ? (isNew(ref) ? ids.get(ref) : ref) : undefined)
  const resolveRefs = (refs: string[]) => refs.map(resolveRef).filter((x): x is string => !!x)

  for (const p of accepted) {
    if (p.kind === 'create_company') {
      const { kind: _k, ref, ...fields } = p
      ids.set(ref, saveCompany(blankCompany(fields)).id)
    }
  }
  for (const p of accepted) {
    if (p.kind === 'create_person') {
      const { kind: _k, ref, companyRefs, ...fields } = p
      ids.set(ref, savePerson(blankPerson({ ...fields, companyIds: resolveRefs(companyRefs) })).id)
    }
  }
  for (const p of accepted) {
    if (p.kind === 'create_meeting') {
      saveMeeting(blankMeeting({ date: p.date, title: p.title, summary: p.summary, companyIds: resolveRefs(p.companyRefs), personIds: resolveRefs(p.personRefs) }))
    } else if (p.kind === 'create_task') {
      saveTask(blankTask({ title: p.title, due: p.due, companyId: resolveRef(p.companyRef), personId: resolveRef(p.personRef) }))
    } else if (p.kind === 'add_note') {
      const target = resolveRef(p.targetRef)
      if (!target) continue
      const db = getDB()
      appendNotes(db.companies.some((c) => c.id === target) ? 'companies' : 'people', target, p.text)
    }
  }
  return accepted.length
}

import { chat, type ChatMessage } from './openai'
import { normalize, todayISO } from './format'
import { fullName, getDB } from '../store/db'
import { distance } from './interpret'
import type { DB } from '../types'

const STOP = new Set(
  'you the and with from what who how does know about tell show give find have has for are was this that his her him she they them there their please kennst du der die das und mit von wer wie was ist sind ein eine einen dem den des bei zu zum zur'.split(' '),
)

/** Same word, a prefix of it ("Ann" → "Anna") or a small typo ("Meyer" → "Meier"). */
function fuzzy(token: string, word: string) {
  if (!token || !word) return false
  if (token === word) return true
  if (token.length >= 3 && word.startsWith(token)) return true
  // Typos keep the first letter; short names allow one wrong letter, long ones two.
  if (token[0] !== word[0] || token.length < 3) return false
  const d = distance(token, word)
  return word.length <= 6 ? d <= 1 : d <= 2
}

/**
 * People and companies the question probably means, found with fuzzy matching, plus
 * name-like words that match nothing (so the assistant can say so and ask for the full name).
 */
export function nameMatches(db: DB, question: string) {
  const raw = question.match(/[\p{L}][\p{L}'-]+/gu) ?? []
  const tokens = [...new Set(raw.map((w) => normalize(w)).filter((w) => w.length >= 3 && !STOP.has(w)))]
  const freq = new Map<string, number>()
  db.companies.forEach((c) => new Set(words(c.name)).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1)))
  const used = new Set<string>()
  const people = db.people.filter((p) => {
    const hit = tokens.filter((t) => fuzzy(t, normalize(p.firstName)) || fuzzy(t, normalize(p.lastName)))
    hit.forEach((t) => used.add(t))
    return hit.length > 0
  })
  const companies = db.companies.filter((c) => {
    const hit = tokens.filter((t) => words(c.name).some((w) => (freq.get(w) ?? 0) < 2 && fuzzy(t, w)))
    hit.forEach((t) => used.add(t))
    return hit.length > 0
  })
  // Capitalised words that matched nothing look like unknown names ("Rahul"); acronyms (CRM, ESG)
  // and words that occur in company names or the knowledge base are vocabulary, not names.
  const vocabulary = new Set(
    [...db.companies.map((c) => c.name), ...db.knowledge.map((k) => `${k.title} ${k.product} ${k.tags.join(' ')}`)]
      .flatMap((x) => normalize(x).split(/[^a-z0-9]+/)),
  )
  const unknown = [
    ...new Set(
      raw.filter(
        (w) =>
          w.length >= 3 &&
          /^\p{Lu}\p{Ll}/u.test(w) &&
          !STOP.has(normalize(w)) &&
          !used.has(normalize(w)) &&
          !vocabulary.has(normalize(w)),
      ),
    ),
  ]
  return { people: people.slice(0, 6), companies: companies.slice(0, 6), unknown }
}

export interface Choice {
  id: string
  kind: 'person' | 'company'
  label: string
  sub: string
}

/**
 * When a question names someone only partly or misspelled ("who is ana", "phone of Huber"),
 * return the matching records (names only) so the user can pick one before any details are shown.
 * Returns null when the question is already unambiguous (full name given) or names nobody.
 */
export function clarify(db: DB, question: string): Choice[] | null {
  const m = nameMatches(db, question)
  if (!m.people.length && !m.companies.length) return null
  const tokens = new Set((question.match(/[\p{L}][\p{L}'-]+/gu) ?? []).map((w) => normalize(w)))
  const personWords = new Set(m.people.flatMap((p) => [normalize(p.firstName), normalize(p.lastName)]))
  const fullPerson = m.people.some((p) => tokens.has(normalize(p.firstName)) && tokens.has(normalize(p.lastName)))
  // A company counts as clearly named when the question uses a word of its name that is not also a person's name.
  const clearCompany = m.companies.some((c) => words(c.name).some((w) => tokens.has(w) && !personWords.has(w)))
  if (fullPerson || clearCompany) return null
  const company = (id: string) => db.companies.find((c) => c.id === id)?.name ?? ''
  return [
    ...m.people.map((p) => ({ id: p.id, kind: 'person' as const, label: fullName(p), sub: [p.role, ...p.companyIds.map(company)].filter(Boolean).join(' · ') })),
    ...m.companies.map((c) => ({ id: c.id, kind: 'company' as const, label: c.name, sub: [c.city, c.industry].filter(Boolean).join(' · ') })),
  ].slice(0, 6)
}

/** Distinctive words of a name ("Schreinerei Huber AG" → huber, schreinerei), for mention checks. */
const words = (name: string) =>
  normalize(name)
    .replace(/\b(ag|gmbh|sa|co|und|&)\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3)

/**
 * The demo dataset is small enough to send as context. To minimise personal data,
 * phone numbers, emails and addresses are only included for the companies and people
 * the question names (and the people of a named company).
 * A production system would retrieve only relevant records on the server (see architecture plan).
 */
function context(question: string) {
  const db = getDB()
  const q = new Set(words(question))
  // Words shared by several companies ("Schreinerei") do not identify one.
  const freq = new Map<string, number>()
  db.companies.forEach((c) => new Set(words(c.name)).forEach((w) => freq.set(w, (freq.get(w) ?? 0) + 1)))
  const named = (name: string) => words(name).some((w) => q.has(w) && (freq.get(w) ?? 0) < 2)
  const companyNamed = new Set(db.companies.filter((c) => named(c.name)).map((c) => c.id))
  const fuzzyHits = nameMatches(db, question)
  fuzzyHits.companies.forEach((c) => companyNamed.add(c.id))
  const fuzzyPeople = new Set(fuzzyHits.people.map((p) => p.id))
  const personNamed = (p: (typeof db.people)[number]) =>
    q.has(normalize(p.lastName)) || fuzzyPeople.has(p.id) || p.companyIds.some((id) => companyNamed.has(id))

  const company = (id?: string) => db.companies.find((c) => c.id === id)?.name ?? ''
  const person = (id?: string) => {
    const p = db.people.find((x) => x.id === id)
    return p ? fullName(p) : ''
  }
  const lines: string[] = []
  lines.push('## Knowledge base')
  for (const k of db.knowledge) {
    lines.push(`### ${k.title} [${k.section}] — ${k.product}`, k.summary)
    k.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}`))
  }
  lines.push('## Companies')
  for (const c of db.companies) {
    const details = companyNamed.has(c.id) ? ` | ${c.street}, ${c.zip} ${c.city} | ${c.phone} | ${c.email}` : ` | ${c.city}`
    lines.push(`- ${c.name} | ${c.industry}${details}${c.notes ? ` | notes: ${c.notes}` : ''}`)
  }
  lines.push('## People')
  for (const p of db.people) {
    const details = personNamed(p) ? ` | ${p.phone} | ${p.email}` : ''
    lines.push(`- ${fullName(p)} | ${p.role} | ${p.companyIds.map(company).join(', ')}${details}${p.notes ? ` | notes: ${p.notes}` : ''}`)
  }
  lines.push('## Tasks')
  for (const t of db.tasks) lines.push(`- [${t.status}] ${t.title} | due ${t.due || '-'} | ${company(t.companyId)} | ${person(t.personId)}`)
  lines.push('## Meetings')
  for (const m of [...db.meetings].sort((a, b) => b.date.localeCompare(a.date)))
    lines.push(`- ${m.date} | ${m.companyIds.map(company).join(', ')} | ${m.personIds.map(person).join(', ')} | ${m.title}: ${m.summary}`)
  lines.push('## Name search for this question (fuzzy: typos, partial names)')
  lines.push(`- people: ${fuzzyHits.people.map((p) => `${fullName(p)} (${p.role}, ${p.companyIds.map(company).join(', ')})`).join('; ') || 'none'}`)
  lines.push(`- companies: ${fuzzyHits.companies.map((c) => `${c.name} (${c.city})`).join('; ') || 'none'}`)
  lines.push(`- not found in the CRM: ${fuzzyHits.unknown.join(', ') || 'none'}`)
  return lines.join('\n')
}

export async function ask(history: ChatMessage[]) {
  const question = [...history].reverse().find((m) => m.role === 'user')?.content ?? ''
  const system: ChatMessage = {
    role: 'system',
    content: `You are the assistant inside the CRM of a Swiss glass manufacturer. Users are sales reps and technicians, often on a phone.
Help like a good production assistant: friendly, natural, never the same canned sentence twice.
Answer questions about their work (customers, contacts, meetings, tasks, quotes, glass products, installation, construction, sales), general business or CRM concepts, and how to use this app.
Use the CRM data and knowledge base below when relevant and say which record you used. Never invent facts or people.
People and companies: use "Name search for this question".
- One clear match (even if the user misspelled it): answer about that record, using its correct full name.
- Several matches (e.g. only a first name): list them briefly (name, role, company) and ask which one is meant.
- A name under "not found in the CRM" and no close match: say you can't find anyone by that name, offer the closest matches if any, and ask for the full name or the company.
Questions about periods ("November 2026", "this week", "last month") are relative to today: filter the meetings and tasks by date and list what matches (date, company, title), or say that there is nothing in that period and mention the nearest entries.
Be brief and practical: short sentences or short lists, no preamble. Answer in English or German (see language rule), whatever language the user writes. Today is ${todayISO()}.

<crm_data>
${context(question)}
</crm_data>`,
  }
  return chat([system, ...history.slice(-12)], { temperature: 0.3 })
}

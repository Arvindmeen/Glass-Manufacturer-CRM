import { chat, type ChatMessage } from './openai'
import { normalize, todayISO } from './format'
import { fullName, getDB } from '../store/db'

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
  const personNamed = (p: (typeof db.people)[number]) => q.has(normalize(p.lastName)) || p.companyIds.some((id) => companyNamed.has(id))

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
  return lines.join('\n')
}

export async function ask(history: ChatMessage[]) {
  const question = [...history].reverse().find((m) => m.role === 'user')?.content ?? ''
  const system: ChatMessage = {
    role: 'system',
    content: `You are the assistant inside the CRM of a Swiss glass manufacturer. Users are sales reps and technicians, often on a phone.
Answer questions about their work: customers, contacts, meetings, tasks, glass products, installation, construction and sales.
Use the CRM data and knowledge base below when relevant and say which record you used. Never invent facts.
Be brief and practical: short sentences or short lists, no preamble. Answer in English or German, matching the user. Today is ${todayISO()}.

<crm_data>
${context(question)}
</crm_data>`,
  }
  return chat([system, ...history.slice(-12)], { temperature: 0.3 })
}

import { chat, type ChatMessage } from './openai'
import { todayISO } from './format'
import { fullName, getDB } from '../store/db'

/**
 * The whole demo dataset is a few KB, so it goes into the prompt as-is.
 * A production system would retrieve only relevant records (see architecture plan).
 */
function context() {
  const db = getDB()
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
  for (const c of db.companies)
    lines.push(`- ${c.name} | ${c.industry} | ${c.street}, ${c.zip} ${c.city} | ${c.phone} | ${c.email}${c.notes ? ` | notes: ${c.notes}` : ''}`)
  lines.push('## People')
  for (const p of db.people)
    lines.push(`- ${fullName(p)} | ${p.role} | ${p.companyIds.map(company).join(', ')} | ${p.phone} | ${p.email}${p.notes ? ` | notes: ${p.notes}` : ''}`)
  lines.push('## Tasks')
  for (const t of db.tasks) lines.push(`- [${t.status}] ${t.title} | due ${t.due || '-'} | ${company(t.companyId)} | ${person(t.personId)}`)
  lines.push('## Meetings')
  for (const m of [...db.meetings].sort((a, b) => b.date.localeCompare(a.date)))
    lines.push(`- ${m.date} | ${m.companyIds.map(company).join(', ')} | ${m.personIds.map(person).join(', ')} | ${m.title}: ${m.summary}`)
  return lines.join('\n')
}

export async function ask(history: ChatMessage[]) {
  const system: ChatMessage = {
    role: 'system',
    content: `You are the assistant inside the CRM of a Swiss glass manufacturer. Users are sales reps and technicians, often on a phone.
Answer any question. Use the CRM data and knowledge base below when relevant and say which record you used. For general questions answer from general knowledge.
Be brief and practical: short sentences or short lists, no preamble. Answer in the user's language. Today is ${todayISO()}.

${context()}`,
  }
  return chat([system, ...history.slice(-12)], { temperature: 0.3 })
}

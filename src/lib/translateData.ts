import { allTexts, getDB, mapTexts } from '../store/db'
import { seedTexts } from '../store/seed'
import { getSettings, type Lang } from '../store/settings'
import { vaultStatus } from './keyVault'
import { translateTexts } from './openai'

/*
 * The user's own entries follow the app language too. Demo texts switch from the built-in
 * translations; everything else is translated by the AI once and remembered, in both directions,
 * so switching back restores the original wording exactly and costs no new request.
 */

const KEY = 'glasscrm:i18n:v1'
type Memory = Record<Lang, Record<string, string>>

function load(): Memory {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Memory | null
    if (v && typeof v.en === 'object' && typeof v.de === 'object') return v
  } catch {
    // start fresh
  }
  return { en: {}, de: {} }
}

function save(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m))
  } catch {
    // full: translations are simply requested again next time
  }
}

const BATCH = 30
let running: Lang | null = null

export type TranslateResult = 'done' | 'nothing' | 'no-key' | 'failed'

export async function translateUserData(lang: Lang): Promise<TranslateResult> {
  if (running === lang) return 'nothing'
  running = lang
  try {
    const mem = load()
    const other: Lang = lang === 'de' ? 'en' : 'de'
    // Built-in demo texts are handled by localizeDemoData.
    const demo = new Set(
      Object.values(seedTexts()).flatMap((t) =>
        [t.en, t.de].flatMap((x) => Object.values(x).flatMap((v) => (Array.isArray(v) ? v.flatMap((s) => (typeof s === 'string' ? [s] : [s.text, s.image ?? ''])) : [v]))),
      ),
    )
    // Already known: translated before (mem[lang]) or itself the result of a translation into this language (mem[other]).
    const todo = [...new Set(allTexts(getDB()))].filter((s) => !demo.has(s) && mem[lang][s] === undefined && mem[other][s] === undefined)

    if (todo.length) {
      if (!vaultStatus().hasKey) {
        apply(mem, lang)
        return 'no-key'
      }
      for (let i = 0; i < todo.length; i += BATCH) {
        const part = todo.slice(i, i + BATCH)
        const out = await translateTexts(part, lang)
        part.forEach((src, n) => {
          const dst = out[n]
          mem[lang][src] = dst
          if (dst !== src) mem[other][dst] = src
        })
        save(mem)
        if (getSettings().lang !== lang) return 'nothing' // the user switched again meanwhile
      }
    }
    return apply(mem, lang) ? 'done' : 'nothing'
  } catch {
    return 'failed'
  } finally {
    running = null
  }
}

/** Swap every remembered text into `lang`; edits made in the meantime are left alone. */
function apply(mem: Memory, lang: Lang) {
  return mapTexts((s) => mem[lang][s]) > 0
}

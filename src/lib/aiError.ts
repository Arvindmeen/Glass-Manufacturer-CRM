import type { T } from '../i18n'
import { GuardError } from './guard'
import { MissingKeyError } from './openai'

/** User-facing message for any failure of an AI call. */
export function aiErrorMessage(e: unknown, t: T): string {
  if (e instanceof MissingKeyError) return t('voice.noKey')
  if (e instanceof GuardError) return t(`guard.${e.reason}`)
  return t('voice.error', { msg: e instanceof Error ? e.message : String(e) })
}

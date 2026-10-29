import type { T } from '../i18n'
import { GuardError } from './guard'
import { AIHttpError, MissingKeyError } from './openai'

/** User-facing message for any failure of an AI call: what happened and what to do, never raw technical text. */
export function aiErrorMessage(e: unknown, t: T): string {
  if (e instanceof MissingKeyError) return t('voice.noKey')
  if (e instanceof GuardError) return t(`guard.${e.reason}`)
  if (e instanceof AIHttpError) {
    if (e.status === 401 || e.status === 403) return t('ai.badKey')
    if (e.status === 429) return t('ai.limit')
    if (e.status >= 500) return t('ai.unavailable')
    return t('voice.error', { msg: e.message })
  }
  // fetch() rejects with a TypeError when the network is down or the request is blocked.
  if (e instanceof TypeError) return t('ai.offline')
  // The model returned something that is not the expected JSON.
  if (e instanceof SyntaxError) return t('ai.badAnswer')
  return t('ai.unavailable')
}

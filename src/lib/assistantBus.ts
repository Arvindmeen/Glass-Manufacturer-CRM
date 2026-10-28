/** Lets any page open the central assistant (it lives in the layout). */
const EVENT = 'glasscrm:open-assistant'

export const openAssistant = () => window.dispatchEvent(new Event(EVENT))

export function onOpenAssistant(fn: () => void) {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

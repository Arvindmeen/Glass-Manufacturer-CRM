/**
 * A short, light tick like native apps give when a sheet snaps into place.
 * Android: Vibration API. iOS Safari (no Vibration API): toggling a hidden
 * <input type="checkbox" switch> plays the system haptic (iOS 18+). Elsewhere it does nothing.
 */
let iosSwitch: HTMLLabelElement | null = null
let last = 0

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:-10px;top:0'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = label
  }
  iosSwitch.click()
}

export function haptic() {
  const now = performance.now()
  if (now - last < 80) return // one tick per snap
  last = now
  if (typeof navigator.vibrate === 'function') navigator.vibrate(8)
  else if (/iP(hone|ad|od)/.test(navigator.userAgent)) iosTick()
}

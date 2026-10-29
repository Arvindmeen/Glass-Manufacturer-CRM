import { Component, type ReactNode } from 'react'
import { translate } from '../i18n'
import { resetDemoData } from '../store/db'
import { getSettings } from '../store/settings'

/** Last line of defence: a render error shows a way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const t = (k: Parameters<typeof translate>[1]) => translate(getSettings().lang, k)
    return (
      <div className="crash" role="alert">
        <h1>{t('crash.title')}</h1>
        <div className="row-gap">
          <button className="btn primary" onClick={() => location.reload()}>
            {t('crash.reload')}
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm(t('settings.resetConfirm'))) {
                resetDemoData()
                location.reload()
              }
            }}
          >
            {t('settings.resetData')}
          </button>
        </div>
      </div>
    )
  }
}

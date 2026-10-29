import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  Inbox,
  ListChecks,
  Menu,
  Mic,
  Radar,
  Settings,
  Users,
  Landmark,
} from 'lucide-react'
import { useT, type TKey } from '../i18n'
import { localizeDemoData, STORAGE_FULL, useDB } from '../store/db'
import { useSettings } from '../store/settings'
import { translateUserData } from '../lib/translateData'
import { Sheet, toast, Toaster, useClosing } from './ui'
import { ChatSheet, onOpenChat } from './AskChat'
import { VoiceCommand } from './VoiceCommand'

type NavItem = { to: string; label: TKey; icon: ReactNode }

const primary: NavItem[] = [
  { to: '/companies', label: 'nav.companies', icon: <Building2 size={22} /> },
  { to: '/people', label: 'nav.people', icon: <Users size={22} /> },
  { to: '/tasks', label: 'nav.tasks', icon: <ListChecks size={22} /> },
]
const secondary: NavItem[] = [
  { to: '/inbox', label: 'nav.inbox', icon: <Inbox size={20} /> },
  { to: '/knowledge', label: 'nav.knowledge', icon: <BookOpen size={20} /> },
  { to: '/leads', label: 'nav.leads', icon: <Radar size={20} /> },
  { to: '/simap', label: 'nav.simap', icon: <Landmark size={20} /> },
  { to: '/settings', label: 'nav.settings', icon: <Settings size={20} /> },
]

export function Layout() {
  const t = useT()
  const { emails } = useDB()
  const unread = emails.filter((e) => !e.read).length
  // The assistant stays open while it navigates; it closes itself when the user leaves via a link.
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  useEffect(() => onOpenChat(() => setChatOpen(true)), [])
  // All records follow the selected language.
  const { lang } = useSettings()
  const firstLang = useRef(lang)
  useEffect(() => {
    // Demo records switch from built-in texts; the user's own entries are translated by the AI.
    localizeDemoData(lang)
    const switched = firstLang.current !== lang
    firstLang.current = lang
    // Own entries go to the AI only when the user switches the language, never on page load.
    if (!switched) return
    void translateUserData(lang).then((r) => {
      if (r === 'no-key') toast(t('settings.translateNeedsKey'))
      else if (r === 'failed') toast(t('settings.translateFailed'))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = secondary.some((n) => pathname.startsWith(n.to))

  useEffect(() => {
    const warn = () => toast(t('common.storageFull'))
    window.addEventListener(STORAGE_FULL, warn)
    return () => window.removeEventListener(STORAGE_FULL, warn)
  }, [t])

  const badge = (to: string) =>
    to === '/inbox' && unread > 0 ? <span className="chip danger">{unread}</span> : null

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">Glass CRM</div>
        {[...primary, ...secondary].map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.icon}
            <span style={{ flex: 1 }}>{t(n.label)}</span>
            {badge(n.to)}
          </NavLink>
        ))}
        <div className="spacer" />
        <button className="voice-fab" onClick={() => setVoiceOpen(true)}>
          <Mic size={20} /> {t('voice.start')}
        </button>
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {primary.slice(0, 2).map((n) => (
          <NavLink key={n.to} to={n.to}>
            {n.icon}
            {t(n.label)}
          </NavLink>
        ))}
        <div className="voice-slot">
          <button className="voice-fab" onClick={() => setVoiceOpen(true)} aria-label={t('voice.start')}>
            <Mic size={26} />
          </button>
        </div>
        <NavLink to={primary[2].to}>
          {primary[2].icon}
          {t(primary[2].label)}
        </NavLink>
        <button className={moreActive ? 'active' : ''} onClick={() => setMoreOpen(true)} style={moreActive ? { color: 'var(--primary)', fontWeight: 600 } : undefined}>
          <Menu size={22} />
          {t('nav.more')}
          {unread > 0 && <span className="chip danger" style={{ position: 'absolute', marginLeft: 28, marginTop: -4, padding: '0 6px' }}>{unread}</span>}
        </button>
      </nav>

      {moreOpen && <MoreSheet badge={badge} onClose={() => setMoreOpen(false)} />}

      {voiceOpen && <VoiceCommand onClose={() => setVoiceOpen(false)} />}
      {chatOpen && <ChatSheet onClose={() => setChatOpen(false)} />}
      <Toaster />
    </div>
  )
}

function MoreSheet({ badge, onClose }: { badge: (to: string) => ReactNode; onClose: () => void }) {
  const t = useT()
  const [closing, close] = useClosing(onClose)
  return (
    <Sheet title={t('nav.more')} onClose={close} closing={closing}>
      <div className="list">
        {secondary.map((n) => (
          <NavLink key={n.to} to={n.to} className="list-item" onClick={close}>
            {n.icon}
            <span className="grow title">{t(n.label)}</span>
            {badge(n.to)}
          </NavLink>
        ))}
      </div>
    </Sheet>
  )
}

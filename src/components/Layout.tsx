import { useState, type ReactNode } from 'react'
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
import { useDB } from '../store/db'
import { Sheet, Toaster } from './ui'
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
  // The voice sheet belongs to the page it was opened on; following a link out of it closes it.
  const [voicePath, setVoicePath] = useState<string | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const { pathname } = useLocation()
  const moreActive = secondary.some((n) => pathname.startsWith(n.to))
  const voiceOpen = voicePath === pathname
  const setVoiceOpen = (open: boolean) => setVoicePath(open ? pathname : null)

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

      {moreOpen && (
        <Sheet title={t('nav.more')} onClose={() => setMoreOpen(false)}>
          <div className="list">
            {secondary.map((n) => (
              <NavLink key={n.to} to={n.to} className="list-item" onClick={() => setMoreOpen(false)}>
                {n.icon}
                <span className="grow title">{t(n.label)}</span>
                {badge(n.to)}
              </NavLink>
            ))}
          </div>
        </Sheet>
      )}

      {voiceOpen && <VoiceCommand onClose={() => setVoiceOpen(false)} />}
      <Toaster />
    </div>
  )
}

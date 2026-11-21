import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { CallScreen, IncomingCall } from '../components/CallUI'
import { IconLogo } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from '../contexts/CallContext'
import { db, fsCol } from '../firebase/app'
import { InboxList, InboxWarm } from '../pages/Inbox'
import type { ChatMemberInfo } from '../types'
import { useLocale, useT } from '../i18n'
import { EventReminders } from '../components/EventBits'
import { PrefsSync } from '../lib/prefs'
import { ModerationGate } from '../components/ModerationGate'
import { useUiConfig } from '../lib/uiConfig'
import { isAdminUid } from '../lib/admin'
import { ScheduledRunner } from '../lib/scheduled'
import { StoryHost } from '../components/Stories'
import { Alerts } from '../components/Alerts'
import { AppSetupSheet } from '../components/AppAlertsSettings'

const TABS = [
  { to: '/', id: 'chats', test: 'tab-chats', match: (p: string) => p === '/' || p === '/requests' || p === '/archived' || p.startsWith('/chat') || p === '/search' || p === '/new-group' },
  { to: '/feed', id: 'feed', test: 'tab-feed', match: (p: string) => p.startsWith('/feed') || p.startsWith('/post') || p === '/compose' },
  { to: '/calendar', id: 'calendar', test: 'tab-calendar', match: (p: string) => p.startsWith('/calendar') || p.startsWith('/event') },
  { to: '/games', id: 'games', test: 'tab-games', match: (p: string) => p.startsWith('/games') },
  { to: '/profile', id: 'profile', test: 'tab-profile', match: (p: string) => p.startsWith('/profile') || p.startsWith('/u/') || p === '/settings' || p === '/admin' },
] as const

function TabIcons({ name, size = 22 }: { name: string; size?: number }) {
  const s = { width: size, height: size }
  if (name === 'chats') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 6h14v10H9l-4 3V6z" /></svg>
  if (name === 'feed') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 9h8M8 13h5" /></svg>
  if (name === 'calendar') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></svg>
  if (name === 'games') return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="10" rx="3" /><path d="M8 12h2M9 11v2M16 12h.01M18 12h.01" /></svg>
  return <svg {...s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 4-4.5 7-4.5S17.5 16 19 19" /></svg>
}

export function AppShell() {
  const { user, profile, loading } = useAuth()
  const loc = useLocation()
  const isList = loc.pathname === '/' || loc.pathname === '/requests' || loc.pathname === '/archived'
  const isChat = loc.pathname.startsWith('/chat/')
  const isChatsSection = isList || isChat || loc.pathname === '/search' || loc.pathname === '/new-group'
  const mode = loc.pathname === '/requests' ? 'requests' : loc.pathname === '/archived' ? 'archived' : 'inbox'
  const t = useT()
  const { locale } = useLocale()
  const ui = useUiConfig()
  const narrow = useNarrow()
  const shellClass = isChat ? 'detail' : isList ? 'list' : 'page-fill'
  // Feed & Profile use the slim sidebar (icon + label in a row); everything else the classic rail.
  const slimNav = /^\/(feed|post|compose|profile|u\/|settings)/.test(loc.pathname)

  if (loading) return <div className="spinner" />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) {
    // The admin account may have no Pingo profile at all: it still gets the console, without the chat UI.
    if (isAdminUid(user.uid)) {
      if (!loc.pathname.startsWith('/admin')) return <Navigate to="/admin" replace />
      return (
        <div className="shell page-fill admin-only" data-testid="admin-only-shell">
          <div className="shell-body">
            <main className="main"><Suspense fallback={<ScreenSkeleton />}><div className="route-view"><Outlet /></div></Suspense></main>
          </div>
          <ModerationGate />
        </div>
      )
    }
    return <Navigate to="/signup" replace />
  }

  const tabs = (
    <>
      {TABS.filter((tab) => !(ui.hiddenTabs ?? []).includes(tab.id) || tab.match(loc.pathname)).map((tab) => (
        <Link key={tab.to} to={tab.to} className={tab.match(loc.pathname) ? 'active' : ''} data-testid={tab.test}>
          <TabIcons name={tab.id} />
          <span className="tab-label">{t(`nav.${tab.id}`)}</span>
        </Link>
      ))}
    </>
  )

  return (
    <div className={`shell ${shellClass}${slimNav ? ' nav-slim' : ''}`}>
      <nav className="nav-rail">
        <div className="brand-mini"><IconLogo size={30} /><b className="brand-name">{t('app.name')}</b></div>
        {tabs}
      </nav>
      <div className="shell-body">
        {isChatsSection && !(isChat && narrow) ? (
          <aside className="sidebar">
            <InboxList mode={mode} />
          </aside>
        ) : isChatsSection ? <InboxWarm /> : null}
        <main className="main">
          {isList ? (
            <div className="main-empty" data-testid="desktop-empty">
              <IconLogo size={72} />
              <strong>{ui.emptyTitle || t('shell.pickTitle')}</strong>
              <p>{ui.emptyBody || t('shell.pickBody')}</p>
            </div>
          ) : (
            <Suspense fallback={<ScreenSkeleton />}><div className="route-view" key={`${loc.pathname.split('/')[1] ?? ''}:${locale}`}><Outlet /></div></Suspense>
          )}
        </main>
      </div>
      <nav className="tabbar">{tabs}</nav>
      <PrefsSync />
      <ModerationGate />
      <Alerts />
      <AfterPaint>
        <EventReminders />
        <ScheduledRunner />
        <StoryHost />
        <AppSetupSheet />
      </AfterPaint>
      <CallOverlays />
    </div>
  )
}

function useNarrow() {
  const [narrow, setNarrow] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 899px)').matches)
  useEffect(() => {
    const mq = matchMedia('(max-width: 899px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

/** Listeners that are not needed for the first screen wait until the chat UI has painted. */
function AfterPaint({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setOn(true), 900)
    return () => window.clearTimeout(id)
  }, [])
  return on ? children : null
}

function ScreenSkeleton() {
  return (
    <div className="screen" aria-busy="true">
      <div className="topbar"><div className="skeleton" style={{ width: 140, height: 22 }} /></div>
      <div className="skeleton-list">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}
      </div>
    </div>
  )
}

function CallOverlays() {
  const { call } = useCall()
  const { user } = useAuth()
  const [peer, setPeer] = useState<ChatMemberInfo | undefined>()
  const peerId = call && user ? (call.callerId === user.uid ? call.calleeId : call.callerId) : undefined
  useEffect(() => {
    if (!peerId) { setPeer(undefined); return }
    void getDoc(doc(db, ...fsCol('users', peerId))).then((snap) => {
      const d = snap.data()
      if (!d) return
      setPeer({ displayName: d.displayName, username: d.username, photoURL: d.photoURL ?? '' })
    })
  }, [peerId])
  return (
    <>
      <IncomingCall peer={peer} />
      <CallScreen peer={peer} />
    </>
  )
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="spinner" />
  // Signed in with a finished profile: go to the app.
  if (user && profile) return <Navigate to="/" replace />
  // The admin (e.g. right after Continue with Google) goes straight to the console, profile or not.
  if (user && !profile && isAdminUid(user.uid) && !(loc.pathname === '/signup' && loc.search.includes('setup=1'))) return <Navigate to="/admin" replace />
  // Signed in (e.g. Google) but no profile yet: stay on /signup to finish setup.
  if (user && !profile && loc.pathname !== '/signup') return <Navigate to="/signup" replace />
  return children
}


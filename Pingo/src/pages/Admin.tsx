import { at, setAdminLang, useAdminLang } from './admin/adminI18n'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconShield } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { isAdminUid } from '../lib/admin'
import { Announce } from './admin/Announce'
import { Chats } from './admin/Chats'
import { Dashboard } from './admin/Dashboard'
import { Filter } from './admin/Filter'
import { Flags } from './admin/Flags'
import { Posts } from './admin/Posts'
import { Reports } from './admin/Reports'
import { AdminContext, loadUsers, type AdminUser, type Tab } from './admin/shared'
import { UiEditor } from './admin/UiEditor'
import { Users } from './admin/Users'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'reports', label: 'Reports', icon: '🚩' },
  { id: 'flags', label: 'Auto-flagged', icon: '🤖' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'chats', label: 'Chats', icon: '💬' },
  { id: 'posts', label: 'Posts', icon: '📝' },
  { id: 'announce', label: 'Announcements', icon: '📣' },
  { id: 'filter', label: 'Word filter', icon: '🧹' },
  { id: 'ui', label: 'UI editor', icon: '🎨' },
  { id: 'lumen', label: 'Lumen', icon: '✦' },
]

export function AdminPage() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'dashboard')
  const [focus, setFocus] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [err, setErr] = useState('')
  const admin = isAdminUid(user?.uid)
  const lang = useAdminLang()

  const reloadUsers = useCallback(async () => {
    try { setUsers(await loadUsers()) } catch (e) { setErr(e instanceof Error ? e.message : at("Could not load users")) }
  }, [])
  // UI editor element overrides never apply to the admin console (their selectors exclude this route).
  useEffect(() => { document.documentElement.dataset.route = 'admin'; return () => { delete document.documentElement.dataset.route } }, [])
  useEffect(() => { if (admin) void reloadUsers() }, [admin, reloadUsers])
  useEffect(() => { const u = new URL(location.href); u.searchParams.set('tab', tab); history.replaceState(history.state, '', u) }, [tab])

  const go = useCallback((t: Tab, f = '') => { setTab(t); setFocus(f) }, [])
  const ctx = useMemo(() => ({ adminUid: user?.uid ?? '', users, byUid: new Map(users.map((u) => [u.uid, u])), reloadUsers, go, focus, toast }), [user?.uid, users, reloadUsers, go, focus, toast])

  if (!admin) {
    return (
      <div className="screen" data-testid="admin-denied">
        <div className="topbar"><button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={at("Back")}><IconBack /></button><h2>{at("Admin")}</h2></div>
        <div className="empty"><h3>{at("Admins only")}</h3><p>{at("This area is only available to the Pingo admin account.")}</p></div>
      </div>
    )
  }
  return (
    <AdminContext.Provider value={ctx}>
      <div className="screen admin" data-testid="admin-screen">
        <div className="topbar admin-top">
          <button type="button" className="icon-btn" onClick={() => nav('/')} aria-label={at("Back to app")}><IconBack /></button>
          <h2><IconShield size={20} />{' '}{at("Admin console")}</h2>
          <div className="seg admin-lang" role="group" aria-label={at("Language")}>
            {(['en', 'ko'] as const).map((l) => <button key={l} type="button" className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setAdminLang(l)} data-testid={`admin-lang-${l}`}>{l === 'en' ? 'EN' : '한국어'}</button>)}
          </div>
          {!profile ? <a className="btn btn-ghost admin-mkprofile" href="/signup?setup=1" data-testid="admin-make-profile">{at("Create a Pingo profile (optional)")}</a> : null}
        </div>
        <nav className="admin-tabs" role="tablist" aria-label={at("Admin sections")}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`admin-tab ${tab === t.id ? 'on' : ''}`} onClick={() => go(t.id)} data-testid={`admin-tab-${t.id}`}>
              <span aria-hidden="true">{t.icon}</span>{at(t.label)}
            </button>
          ))}
        </nav>
        {err ? <p className="a-note bad">{err}</p> : null}
        <div className={`admin-body${tab === 'lumen' ? ' lumen' : ''}`} key={tab}>
          {tab === 'lumen' ? (
            <iframe className="admin-lumen" title="Lumen" src="/lumen/index.html" data-testid="admin-lumen" />
          ) : tab === 'dashboard' ? <Dashboard /> : tab === 'reports' ? <Reports /> : tab === 'flags' ? <Flags /> : tab === 'users' ? <Users /> : tab === 'chats' ? <Chats /> : tab === 'posts' ? <Posts /> : tab === 'announce' ? <Announce /> : tab === 'filter' ? <Filter /> : <UiEditor />}
        </div>
      </div>
    </AdminContext.Provider>
  )
}

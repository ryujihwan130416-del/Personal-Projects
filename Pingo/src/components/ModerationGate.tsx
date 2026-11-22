import { dateLocale, tx } from '../i18n'
import { collection, doc, onSnapshot, query, where, type Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'

export interface ModerationDoc {
  state?: 'ok' | 'warned' | 'suspended' | 'banned'
  until?: Timestamp | null
  reason?: string
  warning?: { text: string; at: Timestamp | null } | null
}

export interface Announcement {
  id: string
  title?: string
  text: string
  kind: 'banner' | 'popup'
  tone: 'info' | 'warn' | 'success'
  active: boolean
  dismissible: boolean
  expiresAt?: Timestamp | null
  createdAt?: Timestamp | null
}

export function isRestricted(m: ModerationDoc | null | undefined, now = Date.now()) {
  if (!m) return false
  if (m.state === 'banned') return true
  return m.state === 'suspended' && (m.until?.toMillis?.() ?? 0) > now
}

/** Blocks suspended/banned accounts, shows admin warnings once, and shows the admin announcement banner. */
export function ModerationGate() {
  const { user, logout } = useAuth()
  const onAdmin = useLocation().pathname.startsWith('/admin')
  const [mod, setMod] = useState<ModerationDoc | null>(null)
  const [ack, setAck] = useState(0)
  const [anns, setAnns] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<string[]>([])
  const [seen, setSeen] = useState<string[]>([])
  const [, tick] = useState(0)

  useEffect(() => {
    if (!user) return
    setAck(Number(localStorage.getItem(`pingo-warn-ack-${user.uid}`) ?? 0))
    const u1 = onSnapshot(doc(db, ...fsCol('moderation', user.uid)), (s) => setMod(s.exists() ? (s.data() as ModerationDoc) : null), () => setMod(null))
    try { setDismissed(JSON.parse(localStorage.getItem(`pingo-ann-dismiss-${user.uid}`) ?? '[]')) } catch { setDismissed([]) }
    // Live: admin changes show up immediately.
    const u2 = onSnapshot(query(collection(db, ...fsCol('announcements')), where('active', '==', true)),
      (s) => setAnns(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))), () => setAnns([]))
    return () => { u1(); u2() }
  }, [user])
  // Re-check once a minute so a suspension that ends lets the user back in.
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 60000); return () => window.clearInterval(id) }, [])

  if (!user) return null
  if (isRestricted(mod)) {
    return createPortal(<Restricted mod={mod} onLogout={() => void logout()} />, document.body)
  }
  const warnAt = mod?.warning?.at?.toMillis?.() ?? 0
  const now = Date.now()
  const live = anns
    .filter((a) => a.text && !(a.expiresAt && a.expiresAt.toMillis() < now) && !(a.dismissible !== false && dismissed.includes(a.id)) && !(a.kind === 'popup' && seen.includes(a.id)))
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? now) - (a.createdAt?.toMillis?.() ?? now))
  const banner = onAdmin ? undefined : live.find((a) => a.kind !== 'popup')
  // The admin console previews announcements itself; don't cover it with them.
  const popup = onAdmin ? undefined : live.find((a) => a.kind === 'popup')
  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])].slice(-50)
    setDismissed(next)
    try { localStorage.setItem(`pingo-ann-dismiss-${user.uid}`, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const icon = (tone: string) => (tone === 'warn' ? '⚠️' : tone === 'success' ? '🎉' : '📣')
  return createPortal(
    <>
      {banner ? (
        <div className={`announce tone-${banner.tone ?? 'info'}`} role="status" data-testid="announcement-banner">
          <span className="announce-ico" aria-hidden="true">{icon(banner.tone)}</span>
          <span className="announce-text">{banner.title ? <b>{banner.title} </b> : null}{banner.text}</span>
          {banner.dismissible !== false ? <button type="button" className="icon-btn" aria-label={tx("Dismiss")} data-testid="announcement-dismiss" onClick={() => dismiss(banner.id)}>✕</button> : null}
        </div>
      ) : null}
      {popup && !(mod?.warning?.text && warnAt > ack) ? (
        <div className="backdrop center">
          <div className={`sheet announce-pop tone-${popup.tone ?? 'info'}`} role="dialog" aria-label={popup.title || tx('Announcement')} data-testid="announcement-popup">
            <div className="report-head"><span className="report-ico" aria-hidden="true">{icon(popup.tone)}</span><div><h3>{popup.title || tx('Announcement')}</h3><p>{tx("From the Pingo team")}</p></div></div>
            <p className="announce-body">{popup.text}</p>
            <button type="button" className="btn btn-primary" data-testid="announcement-ok" onClick={() => { setSeen((v) => [...v, popup.id]); if (popup.dismissible !== false) dismiss(popup.id) }}>{popup.dismissible === false ? tx('OK') : tx('Got it')}</button>
          </div>
        </div>
      ) : null}
      {mod?.warning?.text && warnAt > ack ? (
        <div className="backdrop center">
          <div className="sheet warn-sheet" role="alertdialog" data-testid="warning-dialog">
            <div className="report-head"><span className="report-ico" aria-hidden="true">⚠️</span><div><h3>{tx("A warning from the Pingo team")}</h3><p>{tx("Please follow the community guidelines.")}</p></div></div>
            <blockquote className="report-quote">{mod.warning.text}</blockquote>
            <button type="button" className="btn btn-primary" data-testid="warning-ack" onClick={() => { localStorage.setItem(`pingo-warn-ack-${user.uid}`, String(warnAt)); setAck(warnAt) }}>{tx("I understand")}</button>
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  )
}

function Restricted({ mod, onLogout }: { mod: ModerationDoc | null; onLogout: () => void }) {
  const banned = mod?.state === 'banned'
  const until = mod?.until?.toMillis?.()
  return (
    <div className="restricted" role="alertdialog" aria-modal="true" data-testid="suspended-screen">
      <div className="restricted-card">
        <div className="restricted-ico" aria-hidden="true">{banned ? '⛔' : '⏸️'}</div>
        <h2>{banned ? tx('Your account has been banned') : tx('Your account is suspended')}</h2>
        <p>{banned ? tx('You can no longer send messages or post on Pingo.') : tx("You can't send messages or post until {when}.", { when: until && until < Date.UTC(2099, 0, 1) ? new Date(until).toLocaleString(dateLocale()) : tx('further notice') })}</p>
        {mod?.reason ? <p className="restricted-reason"><b>{tx("Reason:")}</b> {mod.reason}</p> : null}
        <p className="restricted-small">{tx("If you think this is a mistake, contact the Pingo team.")}</p>
        <button type="button" className="btn btn-primary" onClick={onLogout} data-testid="suspended-logout">{tx("Log out")}</button>
      </div>
    </div>
  )
}

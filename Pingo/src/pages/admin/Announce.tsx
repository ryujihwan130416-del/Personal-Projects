import { adminConfirm, at } from './adminI18n'
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import type { Announcement } from '../../components/ModerationGate'
import { db, fsCol } from '../../firebase/app'
import { Pill, ms, useAdmin, when } from './shared'

export function Announce() {
  const { adminUid, toast } = useAdmin()
  const [rows, setRows] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<'banner' | 'popup'>('banner')
  const [tone, setTone] = useState<'info' | 'warn' | 'success'>('info')
  const [dismissible, setDismissible] = useState(true)
  const [expiry, setExpiry] = useState('none')
  const [custom, setCustom] = useState('')
  useEffect(() => onSnapshot(query(collection(db, ...fsCol('announcements')), orderBy('createdAt', 'desc'), limit(100)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Announcement, 'id'>) }))), (e) => toast(e.message)), [toast])

  const expiresAt = () => {
    if (expiry === 'none') return null
    if (expiry === 'custom') return custom ? Timestamp.fromDate(new Date(custom)) : null
    return Timestamp.fromMillis(Date.now() + Number(expiry) * 3600000)
  }
  const publish = async () => {
    if (!text.trim()) return
    try {
      await addDoc(collection(db, ...fsCol('announcements')), { title: title.trim(), text: text.trim(), kind, tone, dismissible, active: true, expiresAt: expiresAt(), createdAt: serverTimestamp(), by: adminUid })
      setTitle(''); setText(''); toast(at("Announcement published — it is live now"))
    } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) }
  }
  const icon = tone === 'warn' ? '⚠️' : tone === 'success' ? '🎉' : '📣'
  return (
    <div className="a-grid2 wide">
      <section className="a-card" data-testid="announce-composer">
        <header><h3>{at("New announcement")}</h3></header>
        <label className="a-field"><span>{at("Title (optional)")}</span><input className="input" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} data-testid="ann-title" /></label>
        <label className="a-field"><span>{at("Message")}</span><textarea className="input textarea" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} data-testid="ann-text" /></label>
        <div className="a-field-row">
          <label className="a-field"><span>{at("Show as")}</span><div className="seg big"><button type="button" className={kind === 'banner' ? 'on' : ''} onClick={() => setKind('banner')} data-testid="ann-banner">{at("Top banner")}</button><button type="button" className={kind === 'popup' ? 'on' : ''} onClick={() => setKind('popup')} data-testid="ann-popup">{at("Popup")}</button></div></label>
          <label className="a-field"><span>{at("Style")}</span><select className="input" value={tone} onChange={(e) => setTone(e.target.value as typeof tone)}><option value="info">{at("📣 Info")}</option><option value="success">{at("🎉 Good news")}</option><option value="warn">{at("⚠️ Warning")}</option></select></label>
        </div>
        <div className="a-field-row">
          <label className="a-field"><span>{at("Expires")}</span><select className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} data-testid="ann-expiry"><option value="none">{at("Never")}</option><option value="1">{at("In 1 hour")}</option><option value="24">{at("In 1 day")}</option><option value="168">{at("In 7 days")}</option><option value="custom">{at("Pick a time…")}</option></select></label>
          {expiry === 'custom' ? <label className="a-field"><span>{at("At")}</span><input className="input" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} /></label> : null}
          <label className="a-check"><input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} />{' '}{at("Users can dismiss it")}</label>
        </div>
        <div className="a-preview">
          <small>{at("Preview")}</small>
          {kind === 'banner' ? <div className={`announce static tone-${tone}`}><span className="announce-ico">{icon}</span><span className="announce-text">{title ? <b>{title} </b> : null}{text || at("Your message")}</span>{dismissible ? <span>✕</span> : null}</div>
            : <div className={`sheet announce-pop static tone-${tone}`}><div className="report-head"><span className="report-ico">{icon}</span><div><h3>{title || at("Announcement")}</h3><p>{at("From the Pingo team")}</p></div></div><p className="announce-body">{text || at("Your message")}</p></div>}
        </div>
        <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => void publish()} data-testid="ann-publish">{at("Publish now")}</button>
      </section>
      <section className="a-card">
        <header><h3>{at("Announcements")}</h3><small>{rows.filter((r) => r.active).length}{' '}{at("live")}</small></header>
        <div className="a-list" data-testid="ann-list">
          {rows.length === 0 ? <div className="a-empty-sm">{at("None yet.")}</div> : null}
          {rows.map((a) => {
            const expired = a.expiresAt && ms(a.expiresAt) < Date.now()
            return (
              <div key={a.id} className="a-row static" data-testid="ann-row">
                <div className="a-row-top"><Pill tone={a.active && !expired ? 'ok' : 'muted'}>{expired ? at("expired") : a.active ? at("live") : at("off")}</Pill><Pill>{at(a.kind)}</Pill><small>{when(a.createdAt)}{a.expiresAt ? ` → ${when(a.expiresAt)}` : ''}</small></div>
                {a.title ? <b>{a.title}</b> : null}
                <p>{a.text}</p>
                <div className="a-btns">
                  <button type="button" className="mini-btn" onClick={() => void updateDoc(doc(db, ...fsCol('announcements', a.id)), { active: !a.active })} data-testid="ann-toggle">{a.active ? at("Turn off") : at("Turn on")}</button>
                  <button type="button" className="mini-btn danger" onClick={async () => { if (await adminConfirm(at("Delete this announcement?"))) void deleteDoc(doc(db, ...fsCol('announcements', a.id))) }} data-testid="ann-delete">{at("Delete")}</button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

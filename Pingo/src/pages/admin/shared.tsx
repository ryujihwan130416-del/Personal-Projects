import { adminConfirm, at } from './adminI18n'
import {
  arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query,
  serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Avatar } from '../../components/Avatar'
import type { ModerationDoc } from '../../components/ModerationGate'
import { db, fsCol } from '../../firebase/app'
import { CATEGORY_LABEL, type FlagCategory } from '../../lib/moderation'

export interface AdminUser {
  uid: string
  username: string
  displayName: string
  photoURL: string
  bio: string
  link: string
  createdAt: number
  deleted?: boolean
  mod?: ModerationDoc | null
}

export type Tab = 'dashboard' | 'reports' | 'flags' | 'users' | 'chats' | 'posts' | 'announce' | 'filter' | 'ui' | 'lumen'

export interface AdminCtx {
  adminUid: string
  users: AdminUser[]
  byUid: Map<string, AdminUser>
  reloadUsers: () => Promise<void>
  go: (tab: Tab, focus?: string) => void
  focus: string
  toast: (m: string) => void
}
export const AdminContext = createContext<AdminCtx | null>(null)
export const useAdmin = () => useContext(AdminContext)!

export const ms = (v: unknown): number => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : (v as { toMillis?: () => number })?.toMillis?.() ?? 0)
export const when = (v: unknown) => { const t = ms(v); return t ? new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—' }

export async function loadUsers(): Promise<AdminUser[]> {
  const [us, mods] = await Promise.all([
    getDocs(query(collection(db, ...fsCol('users')), limit(2000))),
    getDocs(query(collection(db, ...fsCol('moderation')), limit(2000))),
  ])
  const modMap = new Map(mods.docs.map((d) => [d.id, d.data() as ModerationDoc]))
  return us.docs.map((d) => {
    const x = d.data()
    return {
      uid: d.id, username: x.username ?? '', displayName: x.displayName ?? '(no name)', photoURL: x.photoURL ?? '', bio: x.bio ?? '', link: x.link ?? '',
      createdAt: ms(x.createdAt), deleted: !!x.deleted, mod: modMap.get(d.id) ?? null,
    }
  }).sort((a, b) => b.createdAt - a.createdAt)
}

export function modState(m?: ModerationDoc | null): { label: string; cls: string } {
  if (!m || !m.state || m.state === 'ok') return { label: at('Active'), cls: 'ok' }
  if (m.state === 'banned') return { label: at('Banned'), cls: 'bad' }
  if (m.state === 'suspended') {
    const u = ms(m.until)
    return u > Date.now() ? { label: at('Suspended until {0}', [new Date(u).toLocaleDateString()]), cls: 'bad' } : { label: at('Suspension ended'), cls: 'ok' }
  }
  return { label: at('Warned'), cls: 'warn' }
}

/* ---------------- actions ---------------- */
async function writeMod(uid: string, by: string, patch: DocumentData, entry: { action: string; reason?: string }) {
  await setDoc(doc(db, ...fsCol('moderation', uid)), {
    ...patch, updatedAt: serverTimestamp(), by,
    history: arrayUnion({ ...entry, reason: entry.reason ?? '', by, at: Timestamp.now() }),
  }, { merge: true })
}
export const warnUser = (uid: string, by: string, text: string) =>
  writeMod(uid, by, { state: 'warned', warning: { text, at: Timestamp.now() } }, { action: 'warn', reason: text })
export const suspendUser = (uid: string, by: string, days: number | null, reason: string) =>
  writeMod(uid, by, { state: 'suspended', reason, until: Timestamp.fromMillis(days ? Date.now() + days * 86400000 : Date.UTC(2100, 0, 1)) }, { action: days ? `suspend ${days}d` : 'suspend (indefinite)', reason })
export const banUser = (uid: string, by: string, reason: string) =>
  writeMod(uid, by, { state: 'banned', reason, until: null }, { action: 'ban', reason })
export const unsuspendUser = (uid: string, by: string) =>
  writeMod(uid, by, { state: 'ok', until: null, reason: '' }, { action: 'lift restrictions' })

export async function deleteMessage(chatId: string, messageId: string) {
  await updateDoc(doc(db, ...fsCol('chats', chatId, 'messages', messageId)), {
    unsent: true, text: '', removedByAdmin: true,
    photoURL: deleteField(), fileURL: deleteField(), audioURL: deleteField(),
  })
}
export async function deletePost(postId: string) {
  for (const sub of ['comments', 'likes']) {
    const s = await getDocs(collection(db, ...fsCol('posts', postId, sub)))
    for (let i = 0; i < s.docs.length; i += 400) {
      const b = writeBatch(db)
      s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
  }
  await deleteDoc(doc(db, ...fsCol('posts', postId)))
}
/** Wipes a user's profile data (the Auth account itself can't be removed without a server). */
export async function deleteProfileData(u: AdminUser) {
  const posts = await getDocs(query(collection(db, ...fsCol('posts')), where('authorId', '==', u.uid)))
  for (const p of posts.docs) await deletePost(p.id)
  await updateDoc(doc(db, ...fsCol('users', u.uid)), {
    displayName: 'Deleted user', bio: '', link: '', photoURL: '', deleted: true, deletedAt: serverTimestamp(),
  })
  return posts.size
}

export interface CtxMessage { id: string; senderId: string; text: string; type: string; createdAt: number; unsent?: boolean; photoURL?: string; fileName?: string; removedByAdmin?: boolean }
const toCtx = (id: string, x: DocumentData): CtxMessage => ({ id, senderId: x.senderId, text: x.text ?? '', type: x.type ?? 'text', createdAt: ms(x.createdAt), unsent: x.unsent, photoURL: x.photoURL, fileName: x.fileName, removedByAdmin: x.removedByAdmin })
export async function messageContext(chatId: string, messageId: string, around = 4): Promise<{ target: CtxMessage | null; before: CtxMessage[]; after: CtxMessage[] }> {
  const t = await getDoc(doc(db, ...fsCol('chats', chatId, 'messages', messageId)))
  if (!t.exists()) return { target: null, before: [], after: [] }
  const at = t.data().createdAt
  const col = collection(db, ...fsCol('chats', chatId, 'messages'))
  const [b, a] = await Promise.all([
    getDocs(query(col, where('createdAt', '<', at), orderBy('createdAt', 'desc'), limit(around))),
    getDocs(query(col, where('createdAt', '>', at), orderBy('createdAt', 'asc'), limit(around))),
  ])
  return { target: toCtx(t.id, t.data()), before: b.docs.map((d) => toCtx(d.id, d.data())).reverse(), after: a.docs.map((d) => toCtx(d.id, d.data())) }
}
export async function chatMessages(chatId: string, n = 200): Promise<CtxMessage[]> {
  const s = await getDocs(query(collection(db, ...fsCol('chats', chatId, 'messages')), orderBy('createdAt', 'desc'), limit(n)))
  return s.docs.map((d) => toCtx(d.id, d.data())).reverse()
}

/* ---------------- small UI ---------------- */
export function UserChip({ uid, sub }: { uid: string; sub?: ReactNode }) {
  const { byUid, go } = useAdmin()
  const u = byUid.get(uid)
  return (
    <button type="button" className="user-chip" onClick={() => go('users', uid)} title={at("Open in Users")}>
      <Avatar name={u?.displayName ?? '?'} photoURL={u?.photoURL} size={30} />
      <span><b>{u?.displayName ?? at("Unknown user")}</b><small>{u ? `@${u.username}` : uid.slice(0, 10)}{sub ? <> · {sub}</> : null}</small></span>
    </button>
  )
}

export function Pill({ children, tone = 'muted' }: { children: ReactNode; tone?: string }) {
  return <span className={`a-pill ${tone}`}>{children}</span>
}
export function CatPills({ cats }: { cats: string[] }) {
  return <>{cats.map((c) => <Pill key={c} tone={`cat-${c}`}>{at(CATEGORY_LABEL[c as FlagCategory] ?? c)}</Pill>)}</>
}

export function MessageLine({ m, highlight, onDelete }: { m: CtxMessage; highlight?: boolean; onDelete?: (m: CtxMessage) => void }) {
  const { byUid } = useAdmin()
  const name = byUid.get(m.senderId)?.displayName ?? m.senderId.slice(0, 8)
  const body = m.unsent ? (m.removedByAdmin ? 'Removed by admin' : 'Message unsent') : m.text || (m.type === 'photo' ? '📷 Photo' : m.type === 'voice' ? '🎤 Voice message' : m.type === 'file' ? `📎 ${m.fileName ?? 'File'}` : m.type === 'game' ? '🎮 Game' : m.type === 'event' ? '📅 Event' : '')
  return (
    <div className={`a-msg ${highlight ? 'hl' : ''} ${m.unsent ? 'unsent' : ''}`} data-testid="admin-msg">
      <div className="a-msg-head"><b>{name}</b><small>{when(m.createdAt)}</small></div>
      <div className="a-msg-body">{body}{m.photoURL && !m.unsent ? <img src={m.photoURL} alt="" /> : null}</div>
      {onDelete && !m.unsent ? <button type="button" className="mini-btn danger" data-testid="admin-del-msg" onClick={() => onDelete(m)}>{at("Delete")}</button> : null}
    </div>
  )
}

export function ContextView({ chatId, messageId, reloadKey = 0 }: { chatId: string; messageId: string; reloadKey?: number }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof messageContext>> | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Keep the flagged/reported message in view inside the scrolling context box.
    const el = box.current, hl = el?.querySelector<HTMLElement>('.a-msg.hl')
    if (el && hl) el.scrollTop = hl.offsetTop - el.clientHeight / 2 + hl.clientHeight / 2
  }, [data])
  useEffect(() => {
    let live = true
    setData(null)
    messageContext(chatId, messageId).then((d) => live && setData(d)).catch(() => live && setData({ target: null, before: [], after: [] }))
    return () => { live = false }
  }, [chatId, messageId, reloadKey])
  if (!data) return <div className="a-loading">{at("Loading conversation…")}</div>
  if (!data.target) return <div className="a-empty-sm">{at("The message no longer exists.")}</div>
  return (
    <div className="a-context" data-testid="admin-context" ref={box}>
      {data.before.map((m) => <MessageLine key={m.id} m={m} />)}
      <MessageLine m={data.target} highlight />
      {data.after.map((m) => <MessageLine key={m.id} m={m} />)}
    </div>
  )
}

/** Warn / suspend / ban / lift for one user, with a reason box. */
export function ModActions({ uid, onDone, defaultReason = '' }: { uid: string; onDone?: (action: string) => void; defaultReason?: string }) {
  const { adminUid, byUid, reloadUsers, toast } = useAdmin()
  const [reason, setReason] = useState(defaultReason)
  const [days, setDays] = useState('7')
  const [busy, setBusy] = useState(false)
  const u = byUid.get(uid)
  const st = modState(u?.mod)
  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true)
    try { await fn(); await reloadUsers(); toast(`${at(label)} — ${u?.displayName ?? at('user')}`); onDone?.(label) } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) } finally { setBusy(false) }
  }
  if (uid === adminUid) return <p className="a-note">{at("This is the admin account.")}</p>
  return (
    <div className="mod-actions" data-testid="mod-actions">
      <div className="mod-status">{at("Status:")}{' '}<Pill tone={st.cls}>{at(st.label)}</Pill></div>
      <input className="input" placeholder={at("Reason / message to the user")} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="mod-reason" />
      <div className="a-btns">
        <button type="button" className="btn btn-ghost" disabled={busy || !reason.trim()} data-testid="mod-warn" onClick={() => void run("Warned", () => warnUser(uid, adminUid, reason.trim()))}>{at("⚠️ Warn")}</button>
        <select className="input a-select" value={days} onChange={(e) => setDays(e.target.value)} aria-label={at("Suspension length")} data-testid="mod-days">
          <option value="1">{at("1 day")}</option><option value="3">{at("3 days")}</option><option value="7">{at("7 days")}</option><option value="30">{at("30 days")}</option><option value="0">{at("Indefinite")}</option>
        </select>
        <button type="button" className="btn btn-ghost" disabled={busy} data-testid="mod-suspend" onClick={() => void run("Suspended", () => suspendUser(uid, adminUid, Number(days) || null, reason.trim() || 'Community guidelines violation'))}>{at("⏸️ Suspend")}</button>
        <button type="button" className="btn btn-ghost danger" disabled={busy} data-testid="mod-ban" onClick={async () => { if (await adminConfirm(at("Ban {0}?", [u?.displayName ?? at('this user')]))) void run("Banned", () => banUser(uid, adminUid, reason.trim() || 'Community guidelines violation')) }}>{at("⛔ Ban")}</button>
        {st.cls !== 'ok' || u?.mod?.state === 'warned' ? <button type="button" className="btn btn-ghost" disabled={busy} data-testid="mod-lift" onClick={() => void run("Restrictions lifted", () => unsuspendUser(uid, adminUid))}>{at("✅ Lift")}</button> : null}
      </div>
    </div>
  )
}

/** Tiny SVG bar chart. */
export function Bars({ data, label, testId }: { data: { k: string; v: number; title?: string }[]; label: string; testId?: string }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div className="a-chart" data-testid={testId}>
      <div className="a-chart-bars" role="img" aria-label={label}>
        {data.map((d, i) => (
          <div key={d.k} className="a-bar" title={`${d.title ?? d.k}: ${d.v}`}>
            <span className="a-bar-v">{d.v || ''}</span>
            <i style={{ height: `${(d.v / max) * 100}%` }} />
            <small>{data.length <= 10 || (data.length - 1 - i) % 2 === 0 ? d.k : '\u00a0'}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
export function HBars({ data, testId }: { data: { k: string; v: number }[]; testId?: string }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  if (!data.length) return <div className="a-empty-sm">{at("No data yet.")}</div>
  return (
    <div className="a-hbars" data-testid={testId}>
      {data.map((d) => (
        <div key={d.k} className="a-hbar"><span>{d.k}</span><i><b style={{ width: `${(d.v / max) * 100}%` }} /></i><em>{d.v}</em></div>
      ))}
    </div>
  )
}

import { adminConfirm, at } from './adminI18n'
import { collection, deleteDoc, doc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { db, fsCol } from '../../firebase/app'
import { ModActions, Pill, deleteProfileData, modState, ms, useAdmin, when } from './shared'

interface Act { id: string; type: string; at: number; actor: string; meta: Record<string, string> }
interface Rep { id: string; reason: string; status: string; createdAt: number; targetType: string; reporterId: string; targetUid: string }

export function Users() {
  const { users, byUid, focus, go, toast, reloadUsers, adminUid } = useAdmin()
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'restricted' | 'new'>('all')
  const [sel, setSel] = useState(focus)
  const [acts, setActs] = useState<Act[] | null>(null)
  const [filed, setFiled] = useState<Rep[]>([])
  const [received, setReceived] = useState<Rep[]>([])
  const [extra, setExtra] = useState<{ posts: number; chats: number } | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => { if (focus) setSel(focus) }, [focus])

  const u = sel ? byUid.get(sel) : undefined
  useEffect(() => {
    if (!sel) return
    setActs(null); setExtra(null)
    const repMap = (s: Awaited<ReturnType<typeof getDocs>>) => s.docs.map((d) => { const x = d.data() as Record<string, unknown>; return { id: d.id, reason: String(x.reason ?? ''), status: String(x.status ?? 'open'), createdAt: ms(x.createdAt), targetType: String(x.targetType ?? 'user'), reporterId: String(x.reporterId ?? ''), targetUid: String(x.targetUid ?? '') } }).sort((a, b) => b.createdAt - a.createdAt)
    void Promise.all([
      getDocs(query(collection(db, ...fsCol('activity')), where('uid', '==', sel), limit(300))),
      getDocs(query(collection(db, ...fsCol('reports')), where('reporterId', '==', sel), limit(200))),
      getDocs(query(collection(db, ...fsCol('reports')), where('targetUid', '==', sel), limit(200))),
      getDocs(query(collection(db, ...fsCol('posts')), where('authorId', '==', sel), limit(500))),
      getDocs(query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', sel), limit(500))),
    ]).then(([a, f, r, p, c]) => {
      setActs(a.docs.map((d) => { const x = d.data(); return { id: d.id, type: x.type, at: ms(x.at), actor: x.actor, meta: x.meta ?? {} } }).sort((x, y) => y.at - x.at))
      setFiled(repMap(f)); setReceived(repMap(r)); setExtra({ posts: p.size, chats: c.size })
    }).catch((e) => toast(e instanceof Error ? e.message : at("Failed to load")))
  }, [sel, reload, toast])

  const term = q.trim().toLowerCase()
  const list = users.filter((x) => (!term || x.displayName.toLowerCase().includes(term) || x.username.toLowerCase().includes(term) || x.uid.toLowerCase().startsWith(term))
    && (only === 'all' || (only === 'restricted' ? modState(x.mod).cls !== 'ok' : x.createdAt > Date.now() - 7 * 86400000)))

  const wipe = async () => {
    if (!u || !(await adminConfirm(at("Delete {0}'s profile data? This clears their name, bio, link, photo and deletes all their posts. Their messages stay.", [u.displayName])))) return
    try { const n = await deleteProfileData(u); await reloadUsers(); setReload((x) => x + 1); toast(at("Profile data deleted ({0} posts)", [n])) } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) }
  }
  const clearLog = async () => {
    if (!sel || !acts?.length || !(await adminConfirm(at("Clear this user’s activity log?")))) return
    const b = writeBatch(db); acts.slice(0, 450).forEach((a) => b.delete(doc(db, ...fsCol('activity', a.id)))); await b.commit(); setReload((x) => x + 1); toast(at("Activity log cleared"))
  }

  const label = (a: Act) => a.type === 'signup' ? '🎉 Signed up' : a.type === 'login' ? '🔑 Logged in' : a.type === 'report_filed' ? `🚩 Filed a report (${a.meta.reason ?? ''})` : a.type === 'report_received' ? `⚠️ Was reported (${a.meta.reason ?? ''})` : a.type

  return (
    <div className="a-split">
      <div className="a-list-col">
        <input className="input" placeholder={at("Search name, @username or uid")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="user-search" />
        <div className="a-filters">
          {(['all', 'restricted', 'new'] as const).map((s) => <button key={s} type="button" className={`a-chip ${only === s ? 'on' : ''}`} onClick={() => setOnly(s)}>{s === 'all' ? at("All ({0})", [users.length]) : s === 'restricted' ? at("Warned / suspended") : at("New this week")}</button>)}
        </div>
        <div className="a-list" data-testid="user-list">
          {list.map((x) => {
            const st = modState(x.mod)
            return (
              <button key={x.uid} type="button" className={`a-row user ${sel === x.uid ? 'on' : ''}`} onClick={() => setSel(x.uid)} data-testid={`user-row-${x.username}`}>
                <Avatar name={x.displayName} photoURL={x.photoURL} size={38} />
                <span className="a-row-main"><b>{x.displayName}{x.uid === adminUid ? at(" · admin") : ''}</b><small>@{x.username}{' '}{at("· joined")}{' '}{x.createdAt ? new Date(x.createdAt).toLocaleDateString() : '—'}</small></span>
                {st.cls !== 'ok' ? <Pill tone={st.cls}>{st.label.split(' ')[0]}</Pill> : null}
              </button>
            )
          })}
        </div>
      </div>
      <div className="a-detail" data-testid="user-detail">
        {!u ? <div className="a-empty">{at("Select a user.")}</div> : (
          <>
            <div className="a-profile">
              <Avatar name={u.displayName} photoURL={u.photoURL} size={72} />
              <div>
                <h3>{u.displayName} {u.deleted ? <Pill tone="muted">{at("profile deleted")}</Pill> : null}</h3>
                <small>@{u.username}{' '}{at("· uid")}{' '}<code>{u.uid}</code></small>
                {u.bio ? <p>{u.bio}</p> : null}
                <small>{at("Joined")}{' '}{when(u.createdAt)}{extra ? at(" · {0} posts · {1} chats", [extra.posts, extra.chats]) : ''}</small>
              </div>
            </div>
            <div className="a-btns">
              <button type="button" className="btn btn-ghost" onClick={() => go('chats', u.uid)} data-testid="u-view-chats">{at("💬 View conversations")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => go('posts', u.uid)}>{at("📝 View posts")}</button>
              <a className="btn btn-ghost" href={`/u/${u.username}`} target="_blank" rel="noreferrer">{at("Open profile ↗")}</a>
            </div>
            <h4>{at("Moderation")}</h4>
            <ModActions uid={u.uid} />
            {u.mod?.warning?.text ? <p className="a-note">{at("Last warning: “")}{u.mod.warning.text}” · {when(u.mod.warning.at)}</p> : null}
            {((u.mod as { history?: { action: string; reason?: string; at?: unknown }[] } | null)?.history ?? []).length ? (
              <ul className="a-timeline">
                {[...((u.mod as { history: { action: string; reason?: string; at?: unknown }[] }).history)].reverse().map((h, i) => <li key={i}><b>{h.action}</b>{h.reason ? ` — ${h.reason}` : ''}<small>{when(h.at)}</small></li>)}
              </ul>
            ) : null}
            <h4>{at("Reports")}</h4>
            <div className="a-grid2 tight">
              <div><small className="a-sub">{at("Received ({0})", [received.length])}</small>{received.length ? received.slice(0, 20).map((r) => <button key={r.id} type="button" className="a-mini-row" onClick={() => go('reports', r.id)}><Pill tone={r.status === 'open' ? 'bad' : 'muted'}>{at(r.status)}</Pill> {r.reason} <small>{when(r.createdAt)}</small></button>) : <p className="a-empty-sm">{at("None")}</p>}</div>
              <div><small className="a-sub">{at("Filed ({0})", [filed.length])}</small>{filed.length ? filed.slice(0, 20).map((r) => <button key={r.id} type="button" className="a-mini-row" onClick={() => go('reports', r.id)}><Pill>{at(r.targetType)}</Pill> {r.reason} <small>{when(r.createdAt)}</small></button>) : <p className="a-empty-sm">{at("None")}</p>}</div>
            </div>
            <h4>{at("Activity log")}{' '}{acts?.length ? <button type="button" className="mini-btn" onClick={() => void clearLog()}>{at("Clear")}</button> : null}</h4>
            {acts === null ? <div className="a-loading">{at("Loading…")}</div> : acts.length === 0 ? <p className="a-empty-sm">{at("No activity recorded yet.")}</p> : (
              <ul className="a-timeline" data-testid="activity-log">{acts.slice(0, 100).map((a) => <li key={a.id}><b>{label(a)}</b>{a.meta.via ? <small>{' '}{at("via")}{' '}{a.meta.via}</small> : null}<small>{when(a.at)}</small></li>)}</ul>
            )}
            <h4>{at("Danger zone")}</h4>
            <div className="a-btns">
              <button type="button" className="btn btn-ghost danger" disabled={u.uid === adminUid || u.deleted} onClick={() => void wipe()} data-testid="u-wipe">{at("🗑️ Delete profile data")}</button>
              <button type="button" className="btn btn-ghost" onClick={async () => { if (await adminConfirm(at("Remove the moderation record entirely?"))) void deleteDoc(doc(db, ...fsCol('moderation', u.uid))).then(reloadUsers) }}>{at("Reset moderation record")}</button>
            </div>
            <p className="a-note">{at("Deleting the sign-in account itself needs a server (Cloud Functions), which Pingo doesn’t use. Suspend or ban to block access.")}</p>
          </>
        )}
      </div>
    </div>
  )
}

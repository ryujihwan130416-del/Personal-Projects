import { adminConfirm, at } from './adminI18n'
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type DocumentData } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db, fsCol } from '../../firebase/app'
import { ContextView, ModActions, Pill, UserChip, deleteMessage, deletePost, ms, useAdmin, when } from './shared'

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export interface ReportRow {
  id: string
  reporterId: string
  targetType: 'message' | 'user' | 'post'
  targetUid: string
  targetId?: string
  chatId?: string | null
  reason: string
  note?: string
  snapshot?: { text?: string; kind?: string; name?: string }
  status: ReportStatus
  source?: string
  createdAt: number
  resolution?: { note?: string; action?: string; at?: unknown }
}
const STATUSES: ReportStatus[] = ['open', 'reviewing', 'resolved', 'dismissed']
const toneOf = (s: string) => (s === 'open' ? 'bad' : s === 'reviewing' ? 'warn' : s === 'resolved' ? 'ok' : 'muted')

function mapReport(id: string, x: DocumentData): ReportRow {
  return {
    id, reporterId: x.reporterId, targetType: x.targetType ?? 'user', targetUid: x.targetUid, targetId: x.targetId, chatId: x.chatId,
    reason: x.reason ?? '', note: x.note ?? '', snapshot: x.snapshot, status: x.status ?? 'open', source: x.source, createdAt: ms(x.createdAt), resolution: x.resolution,
  }
}

export function Reports() {
  const { adminUid, focus, toast } = useAdmin()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [filter, setFilter] = useState<ReportStatus | 'all'>('open')
  const [sel, setSel] = useState<string>(focus)
  const [note, setNote] = useState('')
  const [reload, setReload] = useState(0)
  const [post, setPost] = useState<DocumentData | null | undefined>(undefined)

  useEffect(() => onSnapshot(query(collection(db, ...fsCol('reports')), orderBy('createdAt', 'desc'), limit(500)),
    (s) => setRows(s.docs.map((d) => mapReport(d.id, d.data()))), (e) => toast(e.message)), [toast])
  useEffect(() => { if (focus) setSel(focus) }, [focus])

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length])), [rows])
  const list = rows.filter((r) => filter === 'all' || r.status === filter)
  const r = rows.find((x) => x.id === sel) ?? null
  useEffect(() => { setNote(r?.resolution?.note ?? '') }, [r?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setPost(undefined)
    if (r?.targetType === 'post' && r.targetId) void getDoc(doc(db, ...fsCol('posts', r.targetId))).then((s) => setPost(s.exists() ? s.data() : null))
  }, [r?.id, r?.targetType, r?.targetId, reload])

  const setStatus = async (status: ReportStatus, action = '') => {
    if (!r) return
    try {
      await updateDoc(doc(db, ...fsCol('reports', r.id)), {
        status, updatedAt: serverTimestamp(),
        ...(status === 'resolved' || status === 'dismissed' ? { resolution: { note: note.trim(), action: action || r.resolution?.action || '', by: adminUid, at: serverTimestamp() } } : {}),
      })
      toast(at("Report {0}", [status]))
    } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) }
  }
  const markAction = async (action: string) => {
    if (!r) return
    await updateDoc(doc(db, ...fsCol('reports', r.id)), { status: r.status === 'open' ? 'reviewing' : r.status, 'resolution.action': action, updatedAt: serverTimestamp() }).catch(() => {})
  }

  return (
    <div className="a-split">
      <div className="a-list-col">
        <div className="a-filters" role="tablist">
          {(['open', 'reviewing', 'resolved', 'dismissed', 'all'] as const).map((s) => (
            <button key={s} type="button" className={`a-chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)} data-testid={`rf-${s}`}>
              {at(s[0].toUpperCase() + s.slice(1))}{s !== 'all' ? <em>{counts[s] ?? 0}</em> : null}
            </button>
          ))}
        </div>
        <div className="a-list" data-testid="report-list">
          {list.length === 0 ? <div className="a-empty-sm">{filter === 'all' ? at("No reports. 🎉") : at("No {0} reports. 🎉", [at(filter)])}</div> : null}
          {list.map((x) => (
            <button key={x.id} type="button" className={`a-row ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)} data-testid="report-row">
              <div className="a-row-top"><Pill tone={toneOf(x.status)}>{at(x.status)}</Pill><Pill>{at(x.targetType)}</Pill>{x.source === 'flag' ? <Pill tone="cat-spam">{at("from flag")}</Pill> : null}<small>{when(x.createdAt)}</small></div>
              <b>{x.reason}</b>
              <p>{x.snapshot?.text || x.note || '—'}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="a-detail" data-testid="report-detail">
        {!r ? <div className="a-empty">{at("Select a report to review it.")}</div> : (
          <>
            <header className="a-detail-head">
              <div><h3>{r.reason}</h3><small>{at("Reported")}{' '}{when(r.createdAt)} · {at(r.targetType)}</small></div>
              <Pill tone={toneOf(r.status)}>{at(r.status)}</Pill>
            </header>
            <div className="a-kv">
              <span>{at("Reported by")}</span>{r.source === 'flag' ? <b>{at("Auto-filter (converted by admin)")}</b> : <UserChip uid={r.reporterId} />}
              <span>{at("Reported user")}</span><UserChip uid={r.targetUid} />
            </div>
            {r.note ? <blockquote className="report-quote">“{r.note}”</blockquote> : null}
            <h4>{at("Reported content")}</h4>
            {r.snapshot?.text ? <div className="a-snapshot"><small>{at("As the reporter saw it")}</small><p>{r.snapshot.text}</p></div> : null}
            {r.targetType === 'message' && r.chatId && r.targetId ? (
              <>
                <h4>{at("Conversation context")}</h4>
                <ContextView chatId={r.chatId} messageId={r.targetId} reloadKey={reload} />
              </>
            ) : null}
            {r.targetType === 'post' ? (
              post === undefined ? <div className="a-loading">{at("Loading post…")}</div> : post === null ? <div className="a-empty-sm">{at("The post has been deleted.")}</div> : (
                <div className="a-post"><p>{post.text}</p><div className="a-post-photos">{(post.photoURLs ?? []).map((u: string, i: number) => <img key={i} src={u} alt="" />)}</div><small>♥ {post.likeCount ?? 0} · 💬 {post.commentCount ?? 0}</small></div>
              )
            ) : null}
            <h4>{at("Actions")}</h4>
            <div className="a-btns">
              {r.status === 'open' ? <button type="button" className="btn btn-ghost" onClick={() => void setStatus('reviewing')} data-testid="r-reviewing">{at("👀 Mark reviewing")}</button> : null}
              {r.targetType === 'message' && r.chatId && r.targetId ? (
                <button type="button" className="btn btn-ghost danger" data-testid="r-del-msg" onClick={async () => { if (await adminConfirm(at("Delete this message for everyone?"))) void deleteMessage(r.chatId!, r.targetId!).then(() => { toast(at("Message deleted")); setReload((n) => n + 1); void markAction('message deleted') }).catch((e) => toast(e.message)) }}>{at("🗑️ Delete message")}</button>
              ) : null}
              {r.targetType === 'post' && r.targetId && post ? (
                <button type="button" className="btn btn-ghost danger" data-testid="r-del-post" onClick={async () => { if (await adminConfirm(at("Delete this post?"))) void deletePost(r.targetId!).then(() => { toast(at("Post deleted")); setReload((n) => n + 1); void markAction('post deleted') }).catch((e) => toast(e.message)) }}>{at("🗑️ Delete post")}</button>
              ) : null}
            </div>
            <ModActions uid={r.targetUid} defaultReason={r.reason} onDone={(a) => void markAction(a.toLowerCase())} />
            <h4>{at("Resolution")}</h4>
            <textarea className="input textarea" rows={2} placeholder={at("Resolution note (visible to admins only)")} value={note} onChange={(e) => setNote(e.target.value)} data-testid="r-note" />
            <div className="a-btns">
              <button type="button" className="btn btn-primary" onClick={() => void setStatus('resolved')} data-testid="r-resolve">{at("✅ Resolve")}</button>
              <button type="button" className="btn btn-ghost" onClick={() => void setStatus('dismissed')} data-testid="r-dismiss">{at("Dismiss")}</button>
              {r.status === 'resolved' || r.status === 'dismissed' ? <button type="button" className="btn btn-ghost" onClick={() => void setStatus('open')}>{at("Reopen")}</button> : null}
            </div>
            {r.resolution?.action ? <p className="a-note">{at("Action taken:")}{' '}{r.resolution.action}{r.resolution.at ? ` · ${when(r.resolution.at)}` : ''}</p> : null}
          </>
        )}
      </div>
    </div>
  )
}

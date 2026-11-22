import { adminConfirm, at } from './adminI18n'
import { addDoc, collection, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db, fsCol } from '../../firebase/app'
import { CATEGORY_LABEL, detect, flagId, useModerationConfig, type FlagCategory } from '../../lib/moderation'
import { CatPills, ContextView, ModActions, Pill, UserChip, deleteMessage, ms, useAdmin, when } from './shared'

type FlagStatus = 'open' | 'dismissed' | 'actioned' | 'reported'
interface FlagRow { id: string; messageId: string; chatId: string; senderId: string; category: string; categories: string[]; terms: string[]; snippet: string; createdAt: number; source: string; status: FlagStatus }

export function Flags() {
  const { adminUid, toast, go } = useAdmin()
  const cfg = useModerationConfig()
  const [rows, setRows] = useState<FlagRow[]>([])
  const [filter, setFilter] = useState<FlagStatus | 'all'>('open')
  const [cat, setCat] = useState<string>('all')
  const [sel, setSel] = useState('')
  const [scan, setScan] = useState<{ text: string; running: boolean } | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => onSnapshot(query(collection(db, ...fsCol('flags')), orderBy('createdAt', 'desc'), limit(1000)), (s) => setRows(s.docs.map((d) => {
    const x = d.data()
    return { id: d.id, messageId: x.messageId, chatId: x.chatId, senderId: x.senderId, category: x.category, categories: x.categories ?? [x.category], terms: x.terms ?? [], snippet: x.snippet ?? '', createdAt: ms(x.createdAt), source: x.source ?? 'send', status: x.status ?? 'open' }
  })), (e) => toast(e.message)), [toast])

  const list = rows.filter((r) => (filter === 'all' || r.status === filter) && (cat === 'all' || r.categories.includes(cat)))
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    rows.forEach((r) => { c[r.status] = (c[r.status] ?? 0) + 1 })
    return c
  }, [rows])
  const f = rows.find((r) => r.id === sel) ?? null

  const setStatus = (id: string, status: FlagStatus, extra: Record<string, unknown> = {}) =>
    updateDoc(doc(db, ...fsCol('flags', id)), { status, reviewedBy: adminUid, reviewedAt: serverTimestamp(), ...extra })

  /** Reads every chat in this browser and flags matching messages that aren't flagged yet. */
  const runScan = async () => {
    setScan({ text: 'Loading chats…', running: true })
    try {
      const known = new Set(rows.map((r) => r.id))
      const chats = await getDocs(collection(db, ...fsCol('chats')))
      let scanned = 0, added = 0, i = 0
      for (const c of chats.docs) {
        i++
        setScan({ text: `Scanning chat ${i} of ${chats.size} · ${scanned} messages · ${added} new flags`, running: true })
        const ms2 = await getDocs(query(collection(db, ...fsCol('chats', c.id, 'messages')), orderBy('createdAt', 'desc'), limit(1000)))
        for (const m of ms2.docs) {
          const x = m.data()
          scanned++
          if (x.unsent || !x.text || x.type === 'system') continue
          const id = flagId(c.id, m.id)
          if (known.has(id)) continue
          const d = detect(x.text, cfg)
          if (!d) continue
          await setDoc(doc(db, ...fsCol('flags', id)), {
            messageId: m.id, chatId: c.id, senderId: x.senderId, category: d.category, categories: d.categories, terms: d.terms,
            snippet: String(x.text).slice(0, 280), createdAt: x.createdAt ?? serverTimestamp(), source: 'scan', status: 'open', flaggedBy: adminUid,
          })
          known.add(id)
          added++
        }
      }
      setScan({ text: `Scanned ${scanned} messages in ${chats.size} chats — ${added} new flag${added === 1 ? '' : 's'}.`, running: false })
    } catch (e) {
      setScan({ text: e instanceof Error ? e.message : 'Scan failed', running: false })
    }
  }

  const toReport = async (r: FlagRow) => {
    const ref = await addDoc(collection(db, ...fsCol('reports')), {
      reporterId: adminUid, reporterName: 'Auto-filter', targetType: 'message', targetUid: r.senderId, targetId: r.messageId, chatId: r.chatId,
      reason: `Auto-flagged: ${r.categories.map((c) => CATEGORY_LABEL[c as FlagCategory] ?? c).join(', ')}`, note: `Matched: ${r.terms.join(', ')}`,
      snapshot: { text: r.snippet, kind: 'message', name: '' }, status: 'open', source: 'flag', flagId: r.id, createdAt: serverTimestamp(),
    })
    await setStatus(r.id, 'reported', { reportId: ref.id })
    toast(at("Converted to a report"))
    go('reports', ref.id)
  }

  return (
    <div className="a-split">
      <div className="a-list-col">
        <div className="a-scan">
          <button type="button" className="btn btn-primary" disabled={scan?.running} onClick={() => void runScan()} data-testid="scan-btn">{at("🔍 Scan existing messages")}</button>
          {scan ? <small data-testid="scan-status">{scan.text}</small> : <small>{at("Runs the word filter over every chat in this browser.")}</small>}
        </div>
        <div className="a-filters">
          {(['open', 'reported', 'actioned', 'dismissed', 'all'] as const).map((s) => (
            <button key={s} type="button" className={`a-chip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)} data-testid={`ff-${s}`}>{at(s[0].toUpperCase() + s.slice(1))}{s !== 'all' ? <em>{counts[s] ?? 0}</em> : null}</button>
          ))}
        </div>
        <select className="input a-select" value={cat} onChange={(e) => setCat(e.target.value)} aria-label={at("Category")}>
          <option value="all">{at("All categories")}</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="a-list" data-testid="flag-list">
          {list.length === 0 ? <div className="a-empty-sm">{at("Nothing flagged here.")}</div> : null}
          {list.map((r) => (
            <button key={r.id} type="button" className={`a-row ${sel === r.id ? 'on' : ''}`} onClick={() => setSel(r.id)} data-testid="flag-row">
              <div className="a-row-top"><CatPills cats={r.categories.slice(0, 2)} /><small>{when(r.createdAt)}</small></div>
              <p>{r.snippet}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="a-detail" data-testid="flag-detail">
        {!f ? <div className="a-empty">{at("Select a flagged message.")}</div> : (
          <>
            <header className="a-detail-head">
              <div><h3>{at("Auto-flagged message")}</h3><small>{when(f.createdAt)}{' '}{at("· detected on")}{' '}{f.source}</small></div>
              <Pill tone={f.status === 'open' ? 'bad' : 'muted'}>{at(f.status)}</Pill>
            </header>
            <div className="a-row-top"><CatPills cats={f.categories} /></div>
            <p className="a-note">{at("Matched:")}{' '}{f.terms.map((t) => <code key={t}>{t}</code>)}</p>
            <div className="a-kv"><span>{at("Sender")}</span><UserChip uid={f.senderId} /></div>
            <h4>{at("Conversation context")}</h4>
            <ContextView chatId={f.chatId} messageId={f.messageId} reloadKey={reload} />
            <h4>{at("Actions")}</h4>
            <div className="a-btns">
              <button type="button" className="btn btn-ghost" data-testid="f-dismiss" onClick={() => void setStatus(f.id, 'dismissed').then(() => toast(at("Flag dismissed")))}>{at("👍 Dismiss (not a problem)")}</button>
              <button type="button" className="btn btn-ghost danger" data-testid="f-del-msg" onClick={async () => { if (await adminConfirm(at("Delete this message for everyone?"))) void deleteMessage(f.chatId, f.messageId).then(() => setStatus(f.id, 'actioned', { action: 'message deleted' })).then(() => { toast(at("Message deleted")); setReload((n) => n + 1) }).catch((e) => toast(e.message)) }}>{at("🗑️ Delete message")}</button>
              <button type="button" className="btn btn-ghost" data-testid="f-report" disabled={f.status === 'reported'} onClick={() => void toReport(f)}>{at("🚩 Convert to report")}</button>
            </div>
            <ModActions uid={f.senderId} defaultReason={`Inappropriate message (${f.categories.map((c) => CATEGORY_LABEL[c as FlagCategory] ?? c).join(', ')})`} onDone={(a) => void setStatus(f.id, 'actioned', { action: a.toLowerCase() })} />
          </>
        )}
      </div>
    </div>
  )
}

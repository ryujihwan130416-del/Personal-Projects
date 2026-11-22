import { adminConfirm, at } from './adminI18n'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Avatar } from '../../components/Avatar'
import { db, fsCol } from '../../firebase/app'
import { MessageLine, chatMessages, deleteMessage, ms, useAdmin, when, type CtxMessage } from './shared'

interface ChatRow { id: string; type: string; memberIds: string[]; title?: string; last: string; at: number }

export function Chats() {
  const { users, byUid, focus, toast } = useAdmin()
  const [uid, setUid] = useState(focus)
  const [q, setQ] = useState('')
  const [chats, setChats] = useState<ChatRow[] | null>(null)
  const [sel, setSel] = useState('')
  const [msgs, setMsgs] = useState<CtxMessage[] | null>(null)
  const [find, setFind] = useState('')
  useEffect(() => { if (focus) setUid(focus) }, [focus])

  useEffect(() => {
    setChats(null); setSel('')
    const col = collection(db, ...fsCol('chats'))
    const qq = uid ? query(col, where('memberIds', 'array-contains', uid), limit(300)) : query(col, orderBy('lastMessageAt', 'desc'), limit(100))
    void getDocs(qq).then((s) => setChats(s.docs.map((d) => { const x = d.data(); return { id: d.id, type: x.type, memberIds: x.memberIds ?? [], title: x.title, last: x.lastMessage?.text ?? '', at: ms(x.lastMessageAt) } }).sort((a, b) => b.at - a.at)))
      .catch((e) => { toast(e.message); setChats([]) })
  }, [uid, toast])
  useEffect(() => {
    setMsgs(null)
    if (sel) void chatMessages(sel, 300).then(setMsgs).catch((e) => { toast(e.message); setMsgs([]) })
  }, [sel, toast])

  const nameOf = (id: string) => byUid.get(id)?.displayName ?? id.slice(0, 6)
  const titleOf = (c: ChatRow) => c.title || c.memberIds.filter((m) => m !== uid || c.memberIds.length === 1).map(nameOf).join(', ')
  const term = q.trim().toLowerCase()
  const pick = users.filter((u) => !term || u.displayName.toLowerCase().includes(term) || u.username.includes(term)).slice(0, 8)
  const del = async (m: CtxMessage) => {
    if (!sel || !(await adminConfirm(at("Delete this message for everyone?")))) return
    try { await deleteMessage(sel, m.id); setMsgs((v) => v?.map((x) => (x.id === m.id ? { ...x, unsent: true, removedByAdmin: true, text: '' } : x)) ?? null); toast(at("Message deleted")) } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) }
  }
  const shown = (msgs ?? []).filter((m) => !find.trim() || m.text.toLowerCase().includes(find.trim().toLowerCase()))

  return (
    <div className="a-split three">
      <div className="a-list-col">
        <div className="a-picked">
          {uid ? <><Avatar name={nameOf(uid)} photoURL={byUid.get(uid)?.photoURL} size={30} /><b>{nameOf(uid)}</b><button type="button" className="mini-btn" onClick={() => setUid('')}>{at("All chats")}</button></> : <b>{at("Recent conversations")}</b>}
        </div>
        <input className="input" placeholder={at("Pick a user…")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="chat-user-search" />
        {term ? <div className="a-picklist">{pick.map((u) => <button key={u.uid} type="button" className="a-mini-row" onClick={() => { setUid(u.uid); setQ('') }}><Avatar name={u.displayName} photoURL={u.photoURL} size={24} /> {u.displayName} <small>@{u.username}</small></button>)}</div> : null}
        <div className="a-list" data-testid="admin-chat-list">
          {chats === null ? <div className="a-loading">{at("Loading…")}</div> : chats.length === 0 ? <div className="a-empty-sm">{at("No conversations.")}</div> : chats.map((c) => (
            <button key={c.id} type="button" className={`a-row ${sel === c.id ? 'on' : ''}`} onClick={() => setSel(c.id)} data-testid="admin-chat-row">
              <div className="a-row-top"><b>{titleOf(c)}</b><small>{when(c.at)}</small></div>
              <p>{c.type === 'group' ? `👥 ${c.memberIds.length} · ` : ''}{c.last || '—'}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="a-detail" data-testid="admin-chat-view">
        {!sel ? <div className="a-empty">{at("Pick a conversation to read it. Read-only — you can only delete messages.")}</div> : (
          <>
            <header className="a-detail-head"><div><h3>{chats?.find((c) => c.id === sel) ? titleOf(chats.find((c) => c.id === sel)!) : at("Conversation")}</h3><small>{msgs ? at("{0} most recent messages · read-only", [msgs.length]) : at("Loading…")}</small></div>
              <input className="input a-find" placeholder={at("Find in chat")} value={find} onChange={(e) => setFind(e.target.value)} /></header>
            <div className="a-context tall">{msgs === null ? <div className="a-loading">{at("Loading…")}</div> : shown.map((m) => <MessageLine key={m.id} m={m} onDelete={(mm) => void del(mm)} />)}</div>
            <p className="a-note">{at("Chat id")}{' '}<code>{sel}</code>{' '}{at("· last activity")}{' '}{when(chats?.find((c) => c.id === sel)?.at)}</p>
          </>
        )}
      </div>
    </div>
  )
}

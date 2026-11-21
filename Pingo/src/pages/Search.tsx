import { tx } from '../i18n'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { IconBack } from '../components/Icons'
import { markText } from '../components/MessageBubble'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { normalizeUsername } from '../lib/ids'
import { formatListTime } from '../lib/format'
import type { UserProfile } from '../types'
import { useT } from '../i18n'

interface Hit { chatId: string; msgId: string; text: string; at: number; title: string; photo: string; sender: string }
interface ChatCache { at: number; chats: { id: string; title: string; photo: string; names: Record<string, string>; msgs: { id: string; text: string; at: number; senderId: string }[] }[] }
let cache: ChatCache | null = null

/** Loads recent text messages from every chat I'm in (newest 300 per chat), cached for a minute. */
async function loadMyMessages(uid: string): Promise<ChatCache> {
  if (cache && Date.now() - cache.at < 60_000) return cache
  const chats = await getDocs(query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', uid)))
  const now = Date.now()
  const out = await Promise.all(chats.docs.map(async (c) => {
    const d = c.data()
    const info = (d.memberInfo ?? {}) as Record<string, { displayName?: string; photoURL?: string }>
    const other = (d.memberIds as string[]).find((m) => m !== uid) ?? uid
    const title = d.type === 'group' ? String(d.title || tx('Group')) : info[other]?.displayName ?? 'Chat'
    const photo = d.type === 'group' ? '' : info[other]?.photoURL ?? ''
    const names = Object.fromEntries(Object.entries(info).map(([k, v]) => [k, v.displayName ?? '']))
    const ms = await getDocs(query(collection(db, ...fsCol('chats', c.id, 'messages')), orderBy('createdAt', 'desc'), limit(300))).catch(() => null)
    const msgs = (ms?.docs ?? []).map((m) => m.data() as Record<string, unknown> & { id?: string }).map((x, i) => ({ x, id: ms!.docs[i].id }))
      .filter(({ x }) => x.type === 'text' && !x.unsent && typeof x.text === 'string' && !(x.expiresAt && (x.expiresAt as { toMillis(): number }).toMillis() < now))
      .map(({ x, id }) => ({ id, text: String(x.text), at: (x.createdAt as { toMillis(): number } | null)?.toMillis() ?? 0, senderId: String(x.senderId) }))
    return { id: c.id, title, photo, names, msgs }
  }))
  cache = { at: Date.now(), chats: out }
  return cache
}

export function SearchPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const t = useT()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'messages' ? 'messages' : 'people'
  const [qtext, setQtext] = useState(params.get('q') ?? '')
  const [results, setResults] = useState<UserProfile[]>([])
  const [hits, setHits] = useState<Hit[]>([])
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)

  const searchPeople = async (raw: string) => {
    const term = normalizeUsername(raw)
    if (!term) return
    const qy = query(collection(db, ...fsCol('users')), where('username', '>=', term), where('username', '<=', term + '\uf8ff'), limit(20))
    const snap = await getDocs(qy)
    const list: UserProfile[] = []
    snap.forEach((d) => {
      if (d.id === user?.uid) return
      const data = d.data()
      list.push({ uid: d.id, username: data.username, displayName: data.displayName, bio: data.bio ?? '', link: data.link ?? '', photoURL: data.photoURL ?? '', createdAt: data.createdAt ?? null })
    })
    setResults(list)
  }
  const searchMessages = async (raw: string) => {
    const term = raw.trim().toLowerCase()
    if (!term || !user) return
    const data = await loadMyMessages(user.uid)
    const out: Hit[] = []
    for (const c of data.chats) for (const m of c.msgs) {
      if (m.text.toLowerCase().includes(term)) out.push({ chatId: c.id, msgId: m.id, text: m.text, at: m.at, title: c.title, photo: c.photo, sender: m.senderId === user.uid ? tx('You') : c.names[m.senderId] ?? '' })
    }
    out.sort((a, b) => b.at - a.at)
    setHits(out.slice(0, 100))
  }
  const run = async (raw: string, which: string) => {
    if (!raw.trim()) return
    setBusy(true); setSearched(true)
    try { if (which === 'messages') await searchMessages(raw); else await searchPeople(raw) } finally { setBusy(false) }
  }
  const search = (e?: FormEvent) => {
    e?.preventDefault()
    setParams({ tab, q: qtext }, { replace: true })
    void run(qtext, tab)
  }
  useEffect(() => {
    // re-run when switching tabs with a query in the box
    if (qtext.trim()) void run(qtext, tab)
    else setSearched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])
  const switchTab = (next: 'people' | 'messages') => setParams({ tab: next, q: qtext }, { replace: true })

  return (
    <div className="screen" data-testid="search-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>{t('search.title')}</h2>
      </div>
      <div className="seg big search-seg" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'people'} className={tab === 'people' ? 'on' : ''} onClick={() => switchTab('people')} data-testid="search-tab-people">{tx("People")}</button>
        <button type="button" role="tab" aria-selected={tab === 'messages'} className={tab === 'messages' ? 'on' : ''} onClick={() => switchTab('messages')} data-testid="search-tab-messages">{tx("Messages")}</button>
      </div>
      <form className="search-box" onSubmit={search}>
        <input
          className="input"
          data-testid="search-input"
          placeholder={tab === 'messages' ? tx('Search all your messages') : t('search.placeholder')}
          value={qtext}
          onChange={(e) => setQtext(e.target.value)}
          autoFocus
        />
      </form>
      <div className="list">
        {tab === 'people' && !searched ? (
          <button type="button" className="find-friends-row" onClick={() => nav('/friends')} data-testid="find-friends">
            <span>🤝</span><div>{tx("Find friends")}<small>{tx("Suggestions, your QR code and scanner")}</small></div>
          </button>
        ) : null}
        {busy ? <div className="spinner" /> : null}
        {searched && !busy && (tab === 'people' ? results.length === 0 : hits.length === 0) ? (
          <div className="empty"><h3>{t('search.emptyTitle')}</h3><p>{tab === 'messages' ? tx('No messages match that. Try another word.') : t('search.emptyBody')}</p></div>
        ) : null}
        {!busy && tab === 'people' ? results.map((u) => (
          <button type="button" key={u.uid} className="list-row user-result" data-testid={`user-${u.username}`} onClick={() => nav(`/u/${u.username}`)}>
            <Avatar name={u.displayName} photoURL={u.photoURL} size={52} />
            <div className="meta">
              <div className="name">{u.displayName}</div>
              <div className="preview"><p>@{u.username}</p></div>
            </div>
          </button>
        )) : null}
        {!busy && tab === 'messages' ? hits.map((h) => (
          <button type="button" key={`${h.chatId}/${h.msgId}`} className="list-row msg-hit" data-testid="msg-hit" onClick={() => nav(`/chat/${h.chatId}?m=${h.msgId}`)}>
            <Avatar name={h.title} photoURL={h.photo} size={44} />
            <div className="meta">
              <div className="name"><span>{h.title}</span><small>{formatListTime(h.at)}</small></div>
              <div className="snip">{h.sender ? <b>{h.sender}: </b> : null}{markText(h.text, qtext.trim())}</div>
            </div>
          </button>
        )) : null}
      </div>
    </div>
  )
}

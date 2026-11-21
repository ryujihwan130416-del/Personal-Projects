import { tx, localizeStored } from '../i18n'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useChatFilter } from '../lib/chatFilter'
import { IconEdit, IconSearch } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { formatListTime } from '../lib/format'
import { warmAndroid } from '../lib/pushPing'
import { usePresenceMap, useTyping } from '../lib/hooks'
import { otherMemberId } from '../lib/ids'
import type { ChatDoc } from '../types'
import { t, useT } from '../i18n'
import { UpcomingList } from '../components/EventBits'
import { setArchived, setPinned, useChatPrefs } from '../lib/chatPrefs'
import { useStoryRings } from '../components/Stories'

export function asChat(id: string, data: Record<string, unknown>): ChatDoc {
  return {
    id,
    type: (data.type as ChatDoc['type']) ?? 'dm',
    memberIds: (data.memberIds as string[]) ?? [],
    memberInfo: (data.memberInfo as ChatDoc['memberInfo']) ?? {},
    createdBy: String(data.createdBy ?? ''),
    createdAt: (data.createdAt as ChatDoc['createdAt']) ?? null,
    lastMessage: (data.lastMessage as ChatDoc['lastMessage']) ?? null,
    lastMessageAt: (data.lastMessageAt as ChatDoc['lastMessageAt']) ?? null,
    unread: (data.unread as Record<string, number>) ?? {},
    requestStatus: (data.requestStatus as ChatDoc['requestStatus']) ?? 'accepted',
    requestFrom: data.requestFrom as string | undefined,
    themeColor: data.themeColor as string | undefined,
    title: data.title as string | undefined,
    blockedUids: data.blockedUids as string[] | undefined,
    disappearAfter: typeof data.disappearAfter === 'number' ? data.disappearAfter : 0,
  }
}

export function useMyChats() {
  const { user } = useAuth()
  const [chats, setChats] = useState<ChatDoc[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!user) return
    const q = query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', user.uid))
    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => asChat(d.id, d.data()))
      list.sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0))
      setChats(list)
      setReady(true)
    }, () => setReady(true))
  }, [user])
  return { chats, ready }
}

export function chatTitle(chat: ChatDoc, uid: string): { name: string; photo?: string; username?: string; peerId?: string } {
  if (chat.type === 'group') {
    return { name: chat.title || t('inbox.groupFallback'), photo: undefined }
  }
  const peerId = otherMemberId(chat.memberIds, uid)
  const info = peerId ? chat.memberInfo[peerId] : undefined
  return { name: info?.displayName || t('inbox.unknown'), photo: info?.photoURL, username: info?.username, peerId }
}

export function previewText(chat: ChatDoc): string {
  if (!chat.lastMessage) return t('inbox.startHint')
  if (chat.lastMessage.type === 'photo') return t('inbox.photo')
  if (chat.lastMessage.type === 'sticker') return chat.lastMessage.text || '✨ Sticker'
  if (chat.lastMessage.type === 'game') return chat.lastMessage.text || t('inbox.gameInvite')
  if (chat.lastMessage.type === 'event') return chat.lastMessage.text || t('cal.planPreview', { title: t('cal.event') })
  return chat.lastMessage.text || t('inbox.message')
}

function TypingOr({ chatId, uid, live, children }: { chatId: string; uid: string; live: boolean; children: ReactNode }) {
  // One typing listener for the open chat. A listener on every row kept the inbox redrawing while anyone typed.
  const typers = useTyping(live ? chatId : undefined, uid)
  return typers.length ? <p className="typing-preview"><span className="dots"><i /><i /><i /></span>{tx("typing…")}</p> : <>{children}</>
}

export function InboxList({ mode }: { mode: 'inbox' | 'requests' | 'archived' }) {
  const { user, profile, isBlocked } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const { chats, ready } = useMyChats()
  const uid = user?.uid ?? ''
  const t = useT()
  const filter = useChatFilter()
  const shownPreview = (c: ChatDoc) => {
    const p = localizeStored(previewText(c))
    if (!c.lastMessage || c.lastMessage.senderId === uid || (c.lastMessage.type && c.lastMessage.type !== 'text')) return p
    const v = filter.view(p)
    return v.blur ? t('filter.hiddenShort') : v.text
  }
  const prefs = useChatPrefs()
  const rings = useStoryRings()
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const pressRef = useRef<number | undefined>(undefined)

  const incomingRequests = useMemo(
    () =>
      chats.filter(
        (c) =>
          c.requestStatus === 'pending' &&
          c.requestFrom &&
          c.requestFrom !== uid &&
          c.lastMessage &&
          !c.memberIds.some((id) => isBlocked(id)),
      ),
    [chats, uid, isBlocked],
  )
  const inbox = useMemo(
    () =>
      chats.filter((c) => {
        if (c.memberIds.some((id) => id !== uid && isBlocked(id)) && c.type === 'dm') return false
        if (c.requestStatus === 'declined') return false
        if (c.requestStatus === 'pending' && c.requestFrom !== uid) return false
        return true
      }),
    [chats, uid, isBlocked],
  )

  const archivedSet = useMemo(() => new Set(prefs.archived), [prefs.archived])
  const pinnedSet = useMemo(() => new Set(prefs.pinned), [prefs.pinned])
  const archivedList = useMemo(() => inbox.filter((c) => archivedSet.has(c.id)), [inbox, archivedSet])
  const mainList = useMemo(() => {
    const rest = inbox.filter((c) => !archivedSet.has(c.id))
    // Pinned chats stay on top (in pin order), the rest by latest message.
    const pins = prefs.pinned.map((id) => rest.find((c) => c.id === id)).filter((c): c is ChatDoc => !!c)
    return [...pins, ...rest.filter((c) => !pinnedSet.has(c.id))]
  }, [inbox, archivedSet, pinnedSet, prefs.pinned])
  const list = mode === 'requests' ? incomingRequests : mode === 'archived' ? archivedList : mainList
  const peerIds = list.flatMap((c) => (c.type === 'dm' ? [otherMemberId(c.memberIds, uid) ?? ''] : [])).filter(Boolean)
  const peerKey = peerIds.join(',')
  useEffect(() => { if (peerKey) warmAndroid(peerKey.split(',')) }, [peerKey])
  const presence = usePresenceMap(peerIds)

  const currentChat = loc.pathname.startsWith('/chat/') ? loc.pathname.slice(6) : ''

  return (
    <div className="screen" data-testid={mode === 'requests' ? 'requests-screen' : mode === 'archived' ? 'archived-screen' : 'inbox-screen'}>
      <div className="topbar">
        {mode === 'archived' ? <Link to="/" className="icon-btn" aria-label={t('common.back')} data-testid="archived-back">‹</Link> : null}
        <h1>{mode === 'archived' ? t('inbox.archived') : t('app.name')}</h1>
        <Link to="/search" className="icon-btn" aria-label={t('inbox.search')} data-testid="search-btn"><IconSearch /></Link>
        <Link to="/new-group" className="icon-btn" aria-label={t('inbox.newGroup')} data-testid="new-group-btn"><IconEdit /></Link>
        <Link to="/profile" aria-label={t('inbox.myProfile')} style={{ padding: '0 6px' }} data-testid="me-btn">
          <Avatar name={profile?.displayName ?? ''} photoURL={profile?.photoURL} size={32} />
        </Link>
      </div>
      <div className="tabs">
        <Link to="/" className={`tab ${mode === 'inbox' ? 'active' : ''}`} data-testid="tab-inbox">{t('inbox.messages')}</Link>
        <Link to="/requests" className={`tab ${mode === 'requests' ? 'active' : ''}`} data-testid="tab-requests">
          {t('inbox.requests')}
          {incomingRequests.length ? <span className="badge">{incomingRequests.length}</span> : null}
        </Link>
      </div>
      {mode === 'inbox' && uid ? <UpcomingList uid={uid} limit={3} testId="upcoming-home" /> : null}
      <div className="list">
        {mode === 'inbox' && archivedList.length ? (
          <Link to="/archived" className="list-row archived-link" data-testid="archived-link">
            <span className="arch-ico">🗄️</span>
            <div className="meta"><div className="name">{t('inbox.archived')}</div></div>
            <span className="unread-pill muted">{archivedList.length}</span>
          </Link>
        ) : null}
        {!ready ? <div className="skeleton-list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60 }} />)}</div> : null}
        {ready && list.length === 0 ? (
          <div className="empty">
            <h3>{mode === 'requests' ? t('inbox.emptyRequestsTitle') : t('inbox.emptyInboxTitle')}</h3>
            <p>{mode === 'requests' ? t('inbox.emptyRequestsBody') : t('inbox.emptyInboxBody')}</p>
          </div>
        ) : null}
        {list.map((c) => {
          const title = chatTitle(c, uid)
          const unread = c.unread?.[uid] ?? 0
          const online = title.peerId ? presence[title.peerId]?.state === 'online' : false
          const pendingOut = c.requestStatus === 'pending' && c.requestFrom === uid
          return (
            <div key={c.id} className={`list-row-wrap ${menuFor === c.id ? 'menu-open' : ''}`} onContextMenu={(e) => { if (mode === 'requests') return; e.preventDefault(); setMenuFor(c.id) }}
              onTouchStart={() => { if (mode === 'requests') return; window.clearTimeout(pressRef.current); pressRef.current = window.setTimeout(() => { setMenuFor(c.id); navigator.vibrate?.(10) }, 520) }}
              onTouchEnd={(e) => { if (menuFor === c.id) e.preventDefault(); window.clearTimeout(pressRef.current) }}
              onTouchMove={() => window.clearTimeout(pressRef.current)}>
            <button
              type="button"
              className={`list-row ${unread ? 'unread' : ''} ${currentChat === c.id ? 'active' : ''} ${pinnedSet.has(c.id) ? 'pinned' : ''}`}
              data-testid={`chat-row-${c.id}`}
              onClick={() => nav(`/chat/${c.id}`)}
            >
              <Avatar name={title.name} photoURL={title.photo} size={56} online={online} ring={title.peerId ? rings[title.peerId] : undefined} />
              <div className="meta">
                <div className="name-row">
                  <div className="name">{pinnedSet.has(c.id) ? <span className="pin-mark" aria-label={tx("Pinned")} data-testid="pin-mark">📌</span> : null}{title.name}{c.disappearAfter ? <span className="pin-mark" title={tx("Disappearing messages")}>⏳</span> : null}</div>
                  <div className="time">{formatListTime(c.lastMessageAt?.toMillis())}</div>
                </div>
                <div className="preview">
                  <TypingOr chatId={c.id} uid={uid} live={currentChat === c.id}><p>{pendingOut ? `${t('inbox.requested')} · ${previewText(c)}` : shownPreview(c)}</p></TypingOr>
                  {unread > 0 ? <span className="unread-pill">{unread > 99 ? '99+' : unread}</span> : null}
                </div>
              </div>
            </button>
            {mode !== 'requests' ? (
              <button type="button" className="row-more" aria-label={tx("Chat options")} data-testid={`row-more-${c.id}`} onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id) }}>⋯</button>
            ) : null}
            {menuFor === c.id ? (
              <div className="row-menu" data-testid="row-menu" onMouseLeave={() => setMenuFor(null)}>
                {!archivedSet.has(c.id) ? (
                  <button type="button" data-testid="pin-toggle" onClick={() => { void setPinned(uid, c.id, !pinnedSet.has(c.id)); setMenuFor(null) }}>{pinnedSet.has(c.id) ? '📌 Unpin' : '📌 Pin to top'}</button>
                ) : null}
                <button type="button" data-testid="archive-toggle" onClick={() => { void setArchived(uid, c.id, !archivedSet.has(c.id)); setMenuFor(null) }}>{archivedSet.has(c.id) ? '📤 Unarchive' : '🗄️ Archive'}</button>
                <button type="button" onClick={() => setMenuFor(null)}>{t('common.close')}</button>
              </div>
            ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

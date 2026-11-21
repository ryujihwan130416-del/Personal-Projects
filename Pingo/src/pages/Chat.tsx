import { pingMembers } from '../lib/pushPing'
import { isComposingNow, isImeEnter } from '../lib/ime'
import { dateLocale, tx } from '../i18n'
import { ReportDialog, type ReportTarget } from '../components/ReportDialog'
import { countMessage } from '../lib/activity'
import { autoFlag, preloadModerationConfig, type FlagCategory } from '../lib/moderation'
import { blockedBy } from '../lib/chatFilter'
import { Sticker, PACKS, pushRecent, recentStickers, stickerLabel } from '../lib/stickers'
import { cancelScheduled, deliverScheduled, editScheduled, scheduleMessage, useScheduled, type Scheduled } from '../lib/scheduled'
import { setArchived, setPinned, useChatPrefs } from '../lib/chatPrefs'
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { onDisconnect, ref as rref, remove, set } from 'firebase/database'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { IconSearch, IconBack, IconCal, IconCamera, IconClip, IconClose, IconFile, IconGame, IconMic, IconMore, IconPhone, IconSend, IconStop, IconVideo } from '../components/Icons'
import { Lightbox } from '../components/Lightbox'
import { MessageBubble, type ReadState } from '../components/MessageBubble'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from '../contexts/CallContext'
import { db, rtdb, fsCol } from '../firebase/app'
import { MAX_FILE_BYTES, MAX_VOICE_MS, VoiceRecorder, fileToInline, uploadImage } from '../lib/media'
import { formatDateDivider, formatLastActive, isSameDay } from '../lib/format'
import { THEME_COLORS, usePresenceMap, useTyping } from '../lib/hooks'
import type { ChatDoc, MessageDoc, ReplyPreview } from '../types'
import { chatTitle } from './Inbox'
import { useT } from '../i18n'
import { GAMES } from '../games/catalog'
import { EventForm } from '../components/EventForm'

function asMsg(id: string, data: Record<string, unknown>): MessageDoc {
  return {
    id,
    senderId: String(data.senderId ?? ''),
    text: String(data.text ?? ''),
    type: (data.type as MessageDoc['type']) ?? 'text',
    photoURL: data.photoURL as string | undefined,
    createdAt: (data.createdAt as MessageDoc['createdAt']) ?? null,
    unsent: Boolean(data.unsent),
    replyTo: data.replyTo as ReplyPreview | undefined,
    reactions: data.reactions as MessageDoc['reactions'],
    readBy: data.readBy as MessageDoc['readBy'],
    gameId: data.gameId as string | undefined,
    gameType: data.gameType as MessageDoc['gameType'],
    eventId: data.eventId as string | undefined,
    edited: Boolean(data.edited),
    fileURL: data.fileURL as string | undefined,
    fileName: data.fileName as string | undefined,
    fileSize: data.fileSize as number | undefined,
    fileType: data.fileType as string | undefined,
    audioURL: data.audioURL as string | undefined,
    duration: data.duration as number | undefined,
    stickerId: data.stickerId as string | undefined,
    expiresAt: (data.expiresAt as MessageDoc['expiresAt']) ?? null,
  }
}

export const DISAPPEAR_OPTIONS: [number, string][] = [[0, 'Off'], [3600, '1 hour'], [86400, '24 hours'], [604800, '7 days']]
// labels are translated where shown: tx(label)
export const disappearLabel = (sec: number) => tx(DISAPPEAR_OPTIONS.find(([v]) => v === sec)?.[1] ?? '{n} h', { n: Math.round(sec / 3600) })



/** System notes are stored in English; show them in the viewer's language. */
function sysText(text: string): string {
  let m = /^(.+) turned on disappearing messages · new messages vanish after (.+)$/.exec(text)
  if (m) return tx('{name} turned on disappearing messages · new messages vanish after {time}', { name: m[1], time: tx(m[2] === '1 hour' || m[2] === '24 hours' || m[2] === '7 days' ? m[2] : m[2].replace(/^(\d+) h$/, '{n} h'), { n: m[2].split(' ')[0] }) })
  m = /^(.+) turned off disappearing messages$/.exec(text)
  if (m) return tx('{name} turned off disappearing messages', { name: m[1] })
  return text
}

export function ChatPage() {
  const { chatId } = useParams()
  const { user, profile, isBlocked } = useAuth()
  const { startCall } = useCall()
  const nav = useNavigate()
  const toast = useToast()
  const t = useT()
  const [chat, setChat] = useState<ChatDoc | null>(null)
  const [messages, setMessages] = useState<MessageDoc[]>([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<MessageDoc | null>(null)
  const [menu, setMenu] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [gamePick, setGamePick] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hit, setHit] = useState(0)
  const [stickersOpen, setStickersOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState<null | { edit?: Scheduled }>(null)
  const [schedList, setSchedList] = useState(false)
  const [blockedNotes, setBlockedNotes] = useState<{ id: string; cats: FlagCategory[] }[]>([])
  const [disappearMenu, setDisappearMenu] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [params] = useSearchParams()
  const prefs = useChatPrefs()
  const scheduled = useScheduled(chatId)
  const bottomRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // True while the user is reading the newest messages; images that finish loading keep them pinned to the bottom.
  const stickRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<number>(0)
  const marked = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!chatId) return
    return onSnapshot(doc(db, ...fsCol('chats', chatId)), (snap) => {
      if (!snap.exists()) { setChat(null); return }
      const data = snap.data()
      setChat({
        id: snap.id,
        type: data.type,
        memberIds: data.memberIds,
        memberInfo: data.memberInfo ?? {},
        createdBy: data.createdBy,
        createdAt: data.createdAt ?? null,
        lastMessage: data.lastMessage ?? null,
        lastMessageAt: data.lastMessageAt ?? null,
        unread: data.unread ?? {},
        requestStatus: data.requestStatus,
        requestFrom: data.requestFrom,
        themeColor: data.themeColor,
        title: data.title,
        blockedUids: data.blockedUids,
        disappearAfter: typeof data.disappearAfter === 'number' ? data.disappearAfter : 0,
      })
    })
  }, [chatId])

  useEffect(() => {
    if (!chatId) return
    const qy = query(collection(db, ...fsCol('chats', chatId, 'messages')), orderBy('createdAt', 'asc'))
    return onSnapshot(qy, (snap) => {
      setMessages(snap.docs.map((d) => asMsg(d.id, d.data())))
    })
  }, [chatId])

  // Disappearing messages: hidden once expired, and deleted by whichever member's app sees them first.
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(id) }, [])
  const expiredDone = useRef(new Set<string>())
  const visible = useMemo(() => messages.filter((m) => !m.expiresAt || m.expiresAt.toMillis() > now), [messages, now])
  useEffect(() => {
    if (!chatId) return
    const gone = messages.filter((m) => m.expiresAt && m.expiresAt.toMillis() <= now && !expiredDone.current.has(m.id))
    if (!gone.length) return
    gone.forEach((m) => expiredDone.current.add(m.id))
    void Promise.allSettled(gone.map((m) => deleteDoc(doc(db, ...fsCol('chats', chatId, 'messages', m.id))))).then((r) => {
      r.forEach((x, i) => { if (x.status === 'rejected') expiredDone.current.delete(gone[i].id) })
    })
    const last = messages[messages.length - 1]
    if (last && gone.some((g) => g.id === last.id)) {
      void updateDoc(doc(db, ...fsCol('chats', chatId)), { lastMessage: { text: '⏳ Message disappeared', senderId: last.senderId, type: 'system', createdAt: last.createdAt ?? serverTimestamp() } }).catch(() => {})
    }
  }, [messages, now, chatId])

  const didInitialScroll = useRef(false)
  useEffect(() => { didInitialScroll.current = false }, [chatId])
  const uid = user?.uid ?? ''
  const title = chat && uid ? chatTitle(chat, uid) : { name: '' }
  const peerIds = (chat?.memberIds ?? []).filter((id) => id !== uid)
  const presence = usePresenceMap(peerIds)
  const typers = useTyping(chatId, uid)
  const incomingRequest = chat?.requestStatus === 'pending' && chat.requestFrom && chat.requestFrom !== uid
  const blocked = chat?.type === 'dm' && title.peerId ? isBlocked(title.peerId) || (chat.blockedUids ?? []).includes(uid) : false
  const peerOnline = title.peerId ? presence[title.peerId]?.state === 'online' : false
  const peerLast = title.peerId ? presence[title.peerId]?.lastActive : 0

  useEffect(() => {
    // First paint of a chat jumps straight to the newest message; later ones scroll smoothly.
    const first = !didInitialScroll.current && messages.length > 0
    if (messages.length > 0) didInitialScroll.current = true
    if (first || stickRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: first ? 'auto' : 'smooth', block: 'end' })
      stickRef.current = true
    }
  }, [messages.length, typers.length])

  useEffect(() => {
    if (!chatId || !uid || !chat) return
    if ((chat.unread?.[uid] ?? 0) > 0) {
      void updateDoc(doc(db, ...fsCol('chats', chatId)), { [`unread.${uid}`]: 0 })
    }
    const unreadMsgs = messages.filter((m) => m.senderId !== uid && !m.readBy?.[uid] && m.createdAt)
    for (const m of unreadMsgs) {
      if (marked.current.has(m.id)) continue
      marked.current.add(m.id)
      void updateDoc(doc(db, ...fsCol('chats', chatId, 'messages', m.id)), {
        [`readBy.${uid}`]: serverTimestamp(),
      }).catch((err) => {
        marked.current.delete(m.id)
        console.warn('read mark failed', m.id, err)
      })
    }
  }, [messages, chatId, uid, chat])

  const setTyping = (on: boolean) => {
    if (!chatId || !uid) return
    const r = rref(rtdb, `dmly/typing/${chatId}/${uid}`)
    if (on) {
      void set(r, true)
      void onDisconnect(r).remove()
    } else {
      void remove(r)
    }
  }

  const onChangeText = (value: string) => {
    setText(value)
    setTyping(true)
    window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => setTyping(false), 1400)
  }

  useEffect(() => () => { setTyping(false) }, [chatId, uid])

  const send = async (extra?: { text?: string; type?: 'text' | 'photo' | 'file' | 'voice' | 'sticker'; photoURL?: string; fields?: Record<string, unknown>; preview?: string }) => {
    if (!chatId || !user || !profile || !chat) return
    const body = (extra?.text ?? text).trim()
    const type = extra?.type ?? 'text'
    if (type === 'text' && !body) return
    if (blocked) { toast(t('chat.cantSend')); return }
    if (type === 'text' && body) {
      const stop = blockedBy(body)
      if (stop.length) {
        // Not sent. The sender gets a friendly note; the attempt is still flagged for the admin.
        setBlockedNotes((n) => [...n.slice(-2), { id: String(Date.now()), cats: stop }])
        void autoFlag({ chatId, messageId: `blocked-${doc(collection(db, ...fsCol('chats', chatId, 'messages'))).id}`, senderId: user.uid, text: `[blocked] ${body}`, flaggedBy: user.uid, source: 'send' })
        return
      }
    }
    // Clear the composer right away so the next message can be typed while this one is saving.
    const fromComposer = extra?.text === undefined && type === 'text'
    const replySnapshot = replyTo
    if (fromComposer) { setText(''); if (isComposingNow()) clearAfterIme.current = true }
    stickRef.current = true
    setReplyTo(null)
    setSending(true)
    try {
      const replyTo = replySnapshot
      const reply = replyTo
        ? { id: replyTo.id, text: replyTo.unsent ? t('chat.unsentShort') : (replyTo.text || (replyTo.type === 'voice' ? '🎤 Voice message' : replyTo.type === 'file' ? `📎 ${replyTo.fileName ?? 'File'}` : t('common.photo'))), senderId: replyTo.senderId }
        : null
      const msgRef = await addDoc(collection(db, ...fsCol('chats', chatId, 'messages')), {
        senderId: user.uid,
        text: body,
        type,
        photoURL: extra?.photoURL ?? null,
        ...(extra?.fields ?? {}),
        ...(chat.disappearAfter ? { expiresAt: Timestamp.fromMillis(Date.now() + chat.disappearAfter * 1000) } : {}),
        createdAt: serverTimestamp(),
        unsent: false,
        replyTo: reply,
        reactions: {},
        readBy: { [user.uid]: serverTimestamp() },
      })
      const unreadPatch: Record<string, unknown> = {
        lastMessage: { text: extra?.preview ?? (type === 'photo' ? t('common.photo') : body), senderId: user.uid, type, createdAt: serverTimestamp() },
        lastMessageAt: serverTimestamp(),
        [`memberInfo.${user.uid}`]: { displayName: profile.displayName, username: profile.username, photoURL: profile.photoURL },
      }
      for (const id of chat.memberIds) {
        if (id !== user.uid) unreadPatch[`unread.${id}`] = increment(1)
      }
      await updateDoc(doc(db, ...fsCol('chats', chatId)), unreadPatch)
      {
        const preview = String(extra?.preview ?? (type === 'photo' ? t('common.photo') : type === 'voice' ? '🎤 Voice message' : body) ?? '')
        const isGroup = chat.type === 'group'
        pingMembers(user.uid, chat.memberIds, msgRef.id, { kind: 'msg', chatId, title: isGroup ? `${chat.title || 'Group'} · ${profile.displayName}` : profile.displayName, body: preview, ...(isGroup ? { group: chat.title || 'Group' } : {}) })
      }
      countMessage()
      // Local content filter: the message is already sent; matches are flagged for the admin.
      if (body) void autoFlag({ chatId, messageId: msgRef.id, senderId: user.uid, text: body, flaggedBy: user.uid, source: 'send' })
      setTyping(false)
    } catch (err) {
      if (fromComposer) setText((cur) => cur || body)
      if (replySnapshot) setReplyTo((cur) => cur ?? replySnapshot)
      toast(err instanceof Error ? err.message : t('chat.sendFailed'))
    } finally {
      setSending(false)
    }
  }

  const sendPhoto = async (file: File) => {
    if (!chatId || !user) return
    setAttachOpen(false)
    stickRef.current = true
    setSending(true)
    try {
      const path = `chat-media/${chatId}/${user.uid}-${Date.now()}-${file.name}`
      const url = await uploadImage(path, file)
      await send({ text: '', type: 'photo', photoURL: url })
    } catch (err) {
      toast(err instanceof Error ? err.message : t('chat.photoFailed'))
      setSending(false)
    }
  }

  const react = async (m: MessageDoc, emoji: string) => {
    if (!chatId || !uid || m.unsent) return
    const cur = m.reactions?.[uid]
    const same = cur === emoji || (cur === 'heart' && emoji === '❤️')
    try {
      await updateDoc(doc(db, ...fsCol('chats', chatId, 'messages', m.id)), {
        [`reactions.${uid}`]: same ? deleteField() : emoji,
      })
    } catch (err) { toast(err instanceof Error ? err.message : tx('Could not react')) }
  }

  const editMsg = async (m: MessageDoc, value: string) => {
    if (!chatId) return
    if (blockedBy(value).length) { toast(t('filter.blockedShort')); return }
    try {
      await updateDoc(doc(db, ...fsCol('chats', chatId, 'messages', m.id)), { text: value, edited: true })
      if (user) void autoFlag({ chatId, messageId: m.id, senderId: m.senderId, text: value, flaggedBy: user.uid, source: 'edit' })
    } catch (err) { toast(err instanceof Error ? err.message : tx('Could not edit')) }
  }

  const unsend = async (m: MessageDoc) => {
    if (!chatId) return
    try {
      await updateDoc(doc(db, ...fsCol('chats', chatId, 'messages', m.id)), {
        unsent: true, text: '', photoURL: deleteField(), fileURL: deleteField(), audioURL: deleteField(),
      })
      // If it was the newest message, the inbox preview should not keep showing it.
      if (messages[messages.length - 1]?.id === m.id) {
        await updateDoc(doc(db, ...fsCol('chats', chatId)), {
          lastMessage: { text: 'Unsent message', senderId: m.senderId, type: 'text', createdAt: m.createdAt ?? serverTimestamp() },
        }).catch(() => { /* preview only */ })
      }
    } catch (err) { toast(err instanceof Error ? err.message : tx('Could not delete')) }
  }

  const sendFile = async (file: File) => {
    setAttachOpen(false)
    stickRef.current = true
    if (file.type.startsWith('image/')) { void sendPhoto(file); return }
    if (file.size > MAX_FILE_BYTES) { toast(tx('Files must be under {n} KB', { n: Math.round(MAX_FILE_BYTES / 1024) })); return }
    setSending(true)
    try {
      const f = await fileToInline(file)
      await send({ text: '', type: 'file', fields: { fileURL: f.url, fileName: f.name, fileSize: f.size, fileType: f.type }, preview: `📎 ${f.name}` })
    } catch (err) {
      toast(err instanceof Error ? err.message : tx('Could not send file'))
      setSending(false)
    }
  }

  const recorder = useRef<VoiceRecorder | null>(null)
  const [recMs, setRecMs] = useState<number | null>(null)
  useEffect(() => {
    if (recMs === null) return
    const id = window.setInterval(() => setRecMs(recorder.current?.elapsed() ?? 0), 200)
    return () => window.clearInterval(id)
  }, [recMs === null])
  useEffect(() => () => recorder.current?.cancel(), [chatId])
  const startVoice = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) { toast(tx("Voice messages are not supported in this browser")); return }
    try {
      const r = new VoiceRecorder()
      r.onAutoStop = () => void stopVoice(true)
      await r.start()
      recorder.current = r
      setRecMs(0)
    } catch {
      toast(tx("Microphone permission is needed for voice messages"))
    }
  }
  const stopVoice = async (sendIt: boolean) => {
    const r = recorder.current
    recorder.current = null
    setRecMs(null)
    if (!r) return
    if (!sendIt) { r.cancel(); return }
    const res = await r.stop()
    if (!res || res.duration < 600) { toast(tx("Hold on a bit longer to record")); return }
    if (res.url.length > 690000) { toast(tx("Voice message is too long")); return }
    await send({ text: '', type: 'voice', fields: { audioURL: res.url, duration: Math.min(res.duration, MAX_VOICE_MS) }, preview: '🎤 Voice message' })
  }

  const [attachOpen, setAttachOpen] = useState(false)
  useEffect(() => { preloadModerationConfig() }, [])
  const [reporting, setReporting] = useState<ReportTarget | null>(null)
  useEffect(() => {
    if (!attachOpen) return
    const close = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.attach')) setAttachOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [attachOpen])
  const jump = (id: string) => {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('flash')
    window.setTimeout(() => el.classList.remove('flash'), 1200)
  }
  const nameOf = (id: string) => (id === uid ? t('common.you') : chat?.memberInfo[id]?.displayName ?? t('common.peer'))
  const readStateOf = (m: MessageDoc): ReadState => {
    if (!m.createdAt) return 'pending'
    const others = (chat?.memberIds ?? []).filter((id) => id !== uid)
    return others.length && others.every((id) => m.readBy?.[id]) ? 'read' : 'sent'
  }

  const sendSticker = async (id: string) => {
    pushRecent(id)
    setStickersOpen(false)
    await send({ text: '', type: 'sticker', fields: { stickerId: id }, preview: `✨ ${stickerLabel(id)} sticker` })
  }
  const setDisappear = async (sec: number) => {
    if (!chatId || !user || !profile || !chat) return
    setDisappearMenu(false); setMenu(false)
    if ((chat.disappearAfter ?? 0) === sec) return
    try {
      await updateDoc(doc(db, ...fsCol('chats', chatId)), { disappearAfter: sec })
      await addDoc(collection(db, ...fsCol('chats', chatId, 'messages')), {
        senderId: user.uid, type: 'system', createdAt: serverTimestamp(), unsent: false, reactions: {}, readBy: { [user.uid]: serverTimestamp() },
        // Stored in English (canonical) and localized for each viewer by sysText().
        text: sec ? `${profile.displayName} turned on disappearing messages · new messages vanish after ${DISAPPEAR_OPTIONS.find(([v]) => v === sec)?.[1] ?? `${Math.round(sec / 3600)} h`}` : `${profile.displayName} turned off disappearing messages`,
      })
    } catch (e) { toast(e instanceof Error ? e.message : tx('Could not change the timer')) }
  }

  // In-chat search over the loaded conversation.
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return [] as MessageDoc[]
    return visible.filter((m) => !m.unsent && (m.text || '').toLowerCase().includes(term))
  }, [q, visible])
  useEffect(() => { setHit(matches.length ? matches.length - 1 : 0) }, [matches.length, q])
  useEffect(() => { const m = matches[hit]; if (m) window.setTimeout(() => jump(m.id), 30) }, [hit, matches]) // eslint-disable-line react-hooks/exhaustive-deps
  // Jump to a message from global search (?m=<id>).
  const jumped = useRef('')
  useEffect(() => {
    const m = params.get('m')
    if (!m || jumped.current === m || !visible.some((x) => x.id === m)) return
    jumped.current = m
    stickRef.current = false
    window.setTimeout(() => jump(m), 250)
  }, [params, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const acceptRequest = async () => {
    if (!chatId) return
    await updateDoc(doc(db, ...fsCol('chats', chatId)), { requestStatus: 'accepted' })
  }
  const declineRequest = async () => {
    if (!chatId) return
    await updateDoc(doc(db, ...fsCol('chats', chatId)), { requestStatus: 'declined' })
    nav('/requests')
  }

  const setThemeColor = async (color: string) => {
    if (!chatId) return
    await updateDoc(doc(db, ...fsCol('chats', chatId)), { themeColor: color })
    setMenu(false)
  }

  const clearAfterIme = useRef(false)
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isImeEnter(e)) {
      e.preventDefault()
      void send()
    }
  }

  const typersLabel = typers
    .map((id) => chat?.memberInfo[id]?.displayName ?? t('common.peer'))
    .join(', ')

  const lastMine = [...visible].reverse().find((m) => m.senderId === uid && !m.unsent && m.type !== 'system')
  const readReceipt = useMemo(() => {
    if (!lastMine || !chat) return ''
    const others = chat.memberIds.filter((id) => id !== uid)
    const seen = others.filter((id) => lastMine.readBy?.[id]).length
    if (chat.type === 'group') return seen ? tx('Seen by {n} of {total}', { n: seen, total: others.length }) : ''
    return seen && seen === others.length ? t('chat.read') : ''
  }, [lastMine, chat, uid])

  const typingText = typers.length === 1
    ? t('chat.typingOne', { name: typersLabel })
    : typers.length
      ? t('chat.typingMany', { names: typersLabel })
      : ''
  const sub = typers.length
    ? typingText
    : peerOnline
      ? '' // online: the green dot on the avatar says it; no "Active now" text
      : formatLastActive(peerLast)


  const inviteGame = async (type: import('../types').GameType) => {
    if (!profile || !chat || !user || !chatId) return
    const { gameInfo } = await import('../games/catalog')
    const { createRoom } = await import('../games/rooms')
    const info = gameInfo(type)
    const peers = chat.memberIds.filter((id) => id !== user.uid).map((id) => ({
      uid: id,
      displayName: chat.memberInfo[id]?.displayName ?? '',
      photoURL: chat.memberInfo[id]?.photoURL ?? '',
    }))
    const mode = chat.type === 'group' && info.modes.includes('party')
      ? 'party' as const
      : info.modes.includes('1v1') ? '1v1' as const : info.modes[0]
    try {
      const { id, code } = await createRoom({ type, mode, host: profile, inviteIds: peers, chatId: chat.id })
      await addDoc(collection(db, ...fsCol('chats', chatId, 'messages')), {
        senderId: user.uid,
        text: t('chat.inviteBody', { emoji: info.emoji, name: info.name, code }),
        type: 'game',
        gameId: id,
        gameType: type,
        createdAt: serverTimestamp(),
        unsent: false,
        reactions: {},
        readBy: { [user.uid]: serverTimestamp() },
      })
      const unreadPatch: Record<string, unknown> = {
        lastMessage: { text: t('chat.invitePreview', { name: info.name }), senderId: user.uid, type: 'game', createdAt: serverTimestamp() },
        lastMessageAt: serverTimestamp(),
      }
      for (const id2 of chat.memberIds) {
        if (id2 !== user.uid) unreadPatch[`unread.${id2}`] = increment(1)
      }
      await updateDoc(doc(db, ...fsCol('chats', chatId)), unreadPatch)
      setGamePick(false)
      nav(`/games/${id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('chat.inviteFailed'))
    }
  }

  if (!chat) return <div className="screen"><div className="spinner" /></div>

  return (
    <div className="chat" data-testid="chat-screen" style={{ ['--bubble-out' as string]: chat.themeColor || undefined }}>
      <div className="topbar chat-top">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')} data-testid="chat-back"><IconBack /></button>
        <button type="button" className="chat-peer" onClick={() => title.username && nav(`/u/${title.username}`)}>
          <Avatar name={title.name} photoURL={title.photo} size={36} online={peerOnline && chat.type === 'dm'} />
          <div className="who">
            <b>{title.name}</b>
            {(chat.type === 'group' || sub) ? <small data-testid="presence-label">{chat.type === 'group' ? t('chat.members', { n: chat.memberIds.length }) : typers.length ? typingText : sub}</small> : null}
          </div>
        </button>
        {chat.type === 'dm' && title.peerId ? (
          <>
            <button type="button" className="icon-btn" aria-label={t('chat.audioCall')} data-testid="audio-call" onClick={() => void startCall({ chatId: chat.id, peerId: title.peerId!, type: 'audio' })}>
              <IconPhone />
            </button>
            <button type="button" className="icon-btn" aria-label={t('chat.videoCall')} data-testid="video-call" onClick={() => void startCall({ chatId: chat.id, peerId: title.peerId!, type: 'video' })}>
              <IconVideo />
            </button>
          </>
        ) : null}
        <button type="button" className="icon-btn" aria-label={tx("Search in chat")} data-testid="chat-search-btn" onClick={() => { setSearchOpen((v) => !v); setQ('') }}><IconSearch /></button>
        <button type="button" className="icon-btn" aria-label={t('cal.plan')} data-testid="plan-event" onClick={() => setPlanOpen(true)}><IconCal /></button>
        <button type="button" className="icon-btn" aria-label={t('chat.game')} data-testid="game-invite" onClick={() => setGamePick(true)}><IconGame /></button>
        <button type="button" className="icon-btn" aria-label={t('chat.more')} onClick={() => setMenu(true)} data-testid="chat-menu"><IconMore /></button>
      </div>

      {searchOpen ? (
        <div className="chat-search" data-testid="chat-search">
          <input className="input" autoFocus placeholder={tx("Search this chat…")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="chat-search-input"
            onKeyDown={(e) => { if (e.key === 'Enter' && !isImeEnter(e)) { e.preventDefault(); if (matches.length) setHit((h) => (e.shiftKey ? (h + 1) % matches.length : (h - 1 + matches.length) % matches.length)) } if (e.key === 'Escape') setSearchOpen(false) }} />
          <span className="cs-count" data-testid="chat-search-count">{q.trim() ? (matches.length ? `${hit + 1} / ${matches.length}` : tx('No results')) : ''}</span>
          <button type="button" className="icon-btn" aria-label={tx("Older match")} disabled={!matches.length} onClick={() => setHit((h) => (h - 1 + matches.length) % matches.length)}>↑</button>
          <button type="button" className="icon-btn" aria-label={tx("Newer match")} disabled={!matches.length} onClick={() => setHit((h) => (h + 1) % matches.length)}>↓</button>
          <button type="button" className="icon-btn" aria-label={tx("Close search")} onClick={() => { setSearchOpen(false); setQ('') }}>×</button>
        </div>
      ) : null}
      {chat.disappearAfter ? (
        <button type="button" className="disappear-pill" onClick={() => setDisappearMenu(true)} data-testid="disappear-pill">{tx('⏳ Disappearing messages')} · {disappearLabel(chat.disappearAfter)}</button>
      ) : null}

      {incomingRequest ? (
        <div className="req-actions" data-testid="request-actions">
          <button className="btn btn-primary" type="button" onClick={() => void acceptRequest()} data-testid="accept-request">{t('chat.accept')}</button>
          <button className="btn btn-ghost" type="button" onClick={() => void declineRequest()} data-testid="decline-request">{t('chat.decline')}</button>
        </div>
      ) : null}

      <div
        className="messages"
        data-testid="messages"
        ref={listRef}
        onScroll={(e) => { const el = e.currentTarget; stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120 }}
        onLoadCapture={() => { const el = listRef.current; if (el && stickRef.current) el.scrollTop = el.scrollHeight }}
      >
        {visible.map((m, i) => {
          const messages = visible
          const prev = messages[i - 1]
          const ms = m.createdAt?.toMillis() ?? 0
          const pms = prev?.createdAt?.toMillis() ?? 0
          const showDay = !prev || (ms && pms && !isSameDay(ms, pms))
          const same = prev && prev.senderId === m.senderId && !showDay
          if (m.type === 'system') {
            return (
              <div key={m.id} id={`msg-${m.id}`}>
                {showDay && ms ? <div className="day-div">{formatDateDivider(ms)}</div> : null}
                <div className="sys-msg" data-testid="sys-msg">{sysText(m.text)}</div>
              </div>
            )
          }
          const isHit = !!q.trim() && matches[hit]?.id === m.id
          return (
            <div key={m.id} className={isHit ? 'search-current' : ''}>
              {showDay && ms ? <div className="day-div">{formatDateDivider(ms)}</div> : null}
              <div className={same ? 'same' : 'gap'}>
                <MessageBubble
                  msg={m}
                  mine={m.senderId === uid}
                  myUid={uid}
                  showTime={!messages[i + 1] || messages[i + 1].senderId !== m.senderId}
                  readState={m.senderId === uid && (!messages[i + 1] || messages[i + 1].senderId !== m.senderId) ? readStateOf(m) : undefined}
                  senderName={chat.type === 'group' && m.senderId !== uid && !same ? chat.memberInfo[m.senderId]?.displayName : undefined}
                  nameOf={nameOf}
                  onReply={(mm) => { setReplyTo(mm); inputRef.current?.focus() }}
                  onReact={(mm, e) => void react(mm, e)}
                  onEdit={editMsg}
                  onDelete={(mm) => void unsend(mm)}
                  onReport={(mm) => setReporting({ type: 'message', targetUid: mm.senderId, targetId: mm.id, chatId: chat.id, snapshot: { text: mm.text || (mm.type === 'photo' ? '[photo]' : mm.type === 'voice' ? '[voice message]' : mm.type === 'file' ? `[file] ${mm.fileName ?? ''}` : ''), kind: mm.type, name: nameOf(mm.senderId) } })}
                  onOpenPhoto={setPhoto}
                  onJump={jump}
                  highlight={searchOpen ? q.trim() : ''}
                />
              </div>
              {lastMine && m.id === lastMine.id ? (
                <div className="read-receipt" data-testid="read-receipt">{readReceipt}</div>
              ) : null}
            </div>
          )
        })}
        {typers.length ? (
          <div className="typing-row" data-testid="typing-indicator">
            <span className="dots"><i /><i /><i /></span>
            {typingText}
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {replyTo ? (
        <div className="reply-bar" data-testid="reply-bar">
          <div className="reply-bar-text">
            <b>{tx('Replying to {name}', { name: nameOf(replyTo.senderId) })}</b>
            <span className="clip">{replyTo.text || (replyTo.type === 'voice' ? '🎤 Voice message' : replyTo.type === 'file' ? `📎 ${replyTo.fileName ?? 'File'}` : t('common.photo'))}</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => setReplyTo(null)} aria-label={t('common.cancel')}>×</button>
        </div>
      ) : null}

      {blockedNotes.map((n) => (
        <div key={n.id} className="blocked-note" role="status" data-testid="blocked-note">
          <span>🚫</span>
          <p><b>{t('filter.blockedTitle')}</b>{t('filter.blockedBody', { cats: n.cats.map((c) => t(`filter.cat.${c}`)).join(', ') })}</p>
          <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={() => setBlockedNotes((x) => x.filter((y) => y.id !== n.id))}>×</button>
        </div>
      ))}
      {scheduled.length ? (
        <button type="button" className="sched-bar" onClick={() => setSchedList(true)} data-testid="sched-bar">{tx('⏰ {n} scheduled · next {when}', { n: scheduled.length, when: scheduled[0].sendAt.toDate().toLocaleString(dateLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' }) })}<b>{tx("View")}</b></button>
      ) : null}
      <div className={`composer ${recMs !== null ? 'recording' : ''}`}>
        {stickersOpen ? <StickerPanel onPick={(id) => void sendSticker(id)} onClose={() => setStickersOpen(false)} /> : null}
        {recMs !== null ? (
          <>
            <button type="button" className="icon-btn" aria-label={tx("Cancel recording")} data-testid="voice-cancel" onClick={() => void stopVoice(false)}><IconClose /></button>
            <div className="rec-indicator" data-testid="voice-recording"><i />{tx('Recording {s}s / {max}s', { s: Math.floor(recMs / 1000), max: MAX_VOICE_MS / 1000 })}</div>
            <button type="button" className="send" aria-label={tx("Send voice message")} data-testid="voice-send" onClick={() => void stopVoice(true)}><IconStop /></button>
          </>
        ) : (
          <>
            <div className="attach">
              <button type="button" className="icon-btn" aria-label={tx("Attach")} data-testid="attach-btn" disabled={blocked || !!incomingRequest} onClick={() => setAttachOpen((v) => !v)}><IconClip /></button>
              {attachOpen ? (
                <div className="attach-menu">
                  <label className="attach-item">
                    <span className="ai-ico photo"><IconCamera size={18} /></span>{tx('Photo')}
                    <input className="hidden-file" type="file" accept="image/*" data-testid="photo-send" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendPhoto(f); e.target.value = '' }} />
                  </label>
                  <label className="attach-item">
                    <span className="ai-ico file"><IconFile size={18} /></span>{tx("File")} <small>{tx('max {n} KB', { n: Math.round(MAX_FILE_BYTES / 1024) })}</small>
                    <input className="hidden-file" type="file" data-testid="file-send" onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f); e.target.value = '' }} />
                  </label>
                </div>
              ) : null}
            </div>
            <button type="button" className="icon-btn sticker-btn" aria-label={tx("Stickers")} data-testid="sticker-btn" disabled={blocked || !!incomingRequest} onClick={() => setStickersOpen((v) => !v)}>😊</button>
            <textarea
              ref={inputRef}
              className="input"
              data-testid="message-input"
              rows={1}
              placeholder={blocked ? t('chat.placeholderBlocked') : incomingRequest ? t('chat.placeholderRequest') : t('chat.placeholder')}
              value={text}
              disabled={blocked || !!incomingRequest}
              onChange={(e) => onChangeText(e.target.value)}
              onKeyDown={onKey}
              onCompositionEnd={() => { if (clearAfterIme.current) { clearAfterIme.current = false; setText(''); requestAnimationFrame(() => setText('')) } }}
              onPaste={(e) => { const f = e.clipboardData.files?.[0]; if (f) { e.preventDefault(); void sendFile(f) } }}
            />
            {text.trim() ? (
              <button type="button" className="icon-btn" aria-label={tx("Schedule message")} title={tx("Send later")} data-testid="schedule-btn" disabled={blocked || !!incomingRequest} onClick={() => setSchedOpen({})}>⏰</button>
            ) : null}
            {text.trim() ? (
              <button type="button" className="send" data-testid="send-btn" disabled={blocked || !!incomingRequest} onClick={() => void send()} aria-label={t('chat.sendAria')}>
                <IconSend />
              </button>
            ) : (
              <button type="button" className="send mic" data-testid="voice-btn" disabled={sending || blocked || !!incomingRequest} onClick={() => void startVoice()} aria-label={tx("Record voice message")}>
                <IconMic />
              </button>
            )}
          </>
        )}
      </div>

      {menu ? (
        <div className="backdrop" onClick={() => setMenu(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sheet-item" data-testid="menu-pin" onClick={() => { void setPinned(uid, chat.id, !prefs.pinned.includes(chat.id)); setMenu(false) }}>📌 {prefs.pinned.includes(chat.id) ? tx('Unpin chat') : tx('Pin chat to top')}</button>
            <button type="button" className="sheet-item" data-testid="menu-archive" onClick={() => { const on = !prefs.archived.includes(chat.id); void setArchived(uid, chat.id, on); setMenu(false); if (on) { toast(tx("Chat archived")); nav('/') } }}>🗄️ {prefs.archived.includes(chat.id) ? tx('Unarchive chat') : tx('Archive chat')}</button>
            <button type="button" className="sheet-item" data-testid="menu-disappear" onClick={() => { setMenu(false); setDisappearMenu(true) }}>{tx("⏳ Disappearing messages")} <small style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>{disappearLabel(chat.disappearAfter ?? 0)}</small></button>
            <button type="button" className="sheet-item" data-testid="menu-scheduled" onClick={() => { setMenu(false); setSchedList(true) }}>{tx("⏰ Scheduled messages")} <small style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}>{scheduled.length}</small></button>
            <div style={{ padding: '10px 16px 0', fontSize: 13, color: 'var(--text-secondary)' }}>{t('chat.themeColor')}</div>
            <div className="palette">
              {THEME_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`swatch ${chat.themeColor === c ? 'on' : ''}`}
                  style={{ background: c }}
                  onClick={() => void setThemeColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            {title.username ? (
              <button type="button" className="sheet-item" onClick={() => nav(`/u/${title.username}`)}>{t('chat.viewProfile')}</button>
            ) : null}
            <button type="button" className="sheet-item" onClick={() => setMenu(false)}>{t('common.close')}</button>
          </div>
        </div>
      ) : null}
      {gamePick ? (
        <div className="backdrop" onClick={() => setGamePick(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} data-testid="game-picker">
            <div style={{ padding: '10px 16px 4px', fontWeight: 800 }}>{t('chat.inviteTitle')}</div>
            {GAMES().map((g) => (
              <button key={g.id} type="button" className="sheet-item" data-testid={`invite-${g.id}`} onClick={() => void inviteGame(g.id)}>
                {g.emoji} {g.name}
              </button>
            ))}
            <button type="button" className="sheet-item" onClick={() => setGamePick(false)}>{t('common.close')}</button>
          </div>
        </div>
      ) : null}

      {planOpen && profile && chat && user && chatId ? (
        <div className="backdrop center" onClick={() => setPlanOpen(false)}>
          <div className="sheet cal-sheet" onClick={(e) => e.stopPropagation()} data-testid="plan-sheet">
            <div className="sheet-head">
              <h3>{t('cal.planTitle')}</h3>
            </div>
            <EventForm
              memberIds={chat.memberIds}
              chatId={chat.id}
              onCancel={() => setPlanOpen(false)}
              onSaved={async (id, title, when) => {
                const body = t('cal.planMessage', { title, when })
                await addDoc(collection(db, ...fsCol('chats', chatId, 'messages')), {
                  senderId: user.uid,
                  text: body,
                  type: 'event',
                  eventId: id,
                  createdAt: serverTimestamp(),
                  unsent: false,
                  reactions: {},
                  readBy: { [user.uid]: serverTimestamp() },
                })
                const unreadPatch: Record<string, unknown> = {
                  lastMessage: { text: t('cal.planPreview', { title }), senderId: user.uid, type: 'event', createdAt: serverTimestamp() },
                  lastMessageAt: serverTimestamp(),
                }
                for (const id2 of chat.memberIds) {
                  if (id2 !== user.uid) unreadPatch[`unread.${id2}`] = increment(1)
                }
                await updateDoc(doc(db, ...fsCol('chats', chatId)), unreadPatch)
                setPlanOpen(false)
              }}
            />
          </div>
        </div>
      ) : null}
      {disappearMenu ? (
        <div className="backdrop" onClick={() => setDisappearMenu(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} data-testid="disappear-sheet">
            <div className="sheet-head"><h3>{tx("⏳ Disappearing messages")}</h3></div>
            <p className="sheet-note">{tx("New messages in this chat vanish for everyone after the timer. Messages already sent aren’t affected.")}</p>
            {DISAPPEAR_OPTIONS.map(([v, l]) => (
              <button key={v} type="button" className={`sheet-item ${(chat.disappearAfter ?? 0) === v ? 'on' : ''}`} data-testid={`disappear-${v}`} onClick={() => void setDisappear(v)}>{(chat.disappearAfter ?? 0) === v ? '● ' : '○ '}{tx(l)}</button>
            ))}
          </div>
        </div>
      ) : null}
      {schedOpen ? (
        <ScheduleDialog
          initialText={schedOpen.edit?.text ?? text}
          initialWhen={schedOpen.edit ? schedOpen.edit.sendAt.toDate() : null}
          editing={!!schedOpen.edit}
          onClose={() => { if (schedOpen.edit) setSchedList(true); setSchedOpen(null) }}
          onSave={async (body, when) => {
            if (!user) return
            try {
              if (blockedBy(body).length) { toast(t('filter.blockedShort')); return }
              if (schedOpen.edit) await editScheduled(user.uid, schedOpen.edit, body, when)
              else { await scheduleMessage(user.uid, chat.id, body, when, title.name); setText('') }
              toast(tx('Scheduled for {when}', { when: when.toLocaleString(dateLocale(), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }))
              const wasEdit = !!schedOpen.edit
              setSchedOpen(null)
              if (wasEdit) setSchedList(true)
            } catch (e) { toast(e instanceof Error ? e.message : tx('Could not schedule')) }
          }}
        />
      ) : null}
      {schedList ? (
        <div className="backdrop" onClick={() => setSchedList(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} data-testid="sched-list">
            <div className="sheet-head"><h3>{tx("⏰ Scheduled messages")}</h3></div>
            <p className="sheet-note">{tx("Sent automatically while Pingo is open on one of your devices — or as soon as you next open it.")}</p>
            {scheduled.length === 0 ? <p className="sheet-note">{tx("Nothing scheduled. Type a message and tap ⏰.")}</p> : null}
            {scheduled.map((s) => (
              <div key={s.id} className="sched-row" data-testid="sched-row">
                <div><b>{s.sendAt.toDate().toLocaleString(dateLocale(), { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</b><p>{s.text}</p></div>
                <button type="button" className="mini-btn" data-testid="sched-edit" onClick={() => { setSchedList(false); setSchedOpen({ edit: s }) }}>{tx("Edit")}</button>
                <button type="button" className="mini-btn accent" data-testid="sched-now" onClick={() => { if (user && profile) void deliverScheduled(user.uid, profile, s.id) }}>{tx("Send now")}</button>
                <button type="button" className="mini-btn danger" data-testid="sched-cancel" onClick={() => { if (user) void cancelScheduled(user.uid, s.id) }}>{tx("Cancel")}</button>
              </div>
            ))}
            <button type="button" className="sheet-item" onClick={() => setSchedList(false)}>{t('common.close')}</button>
          </div>
        </div>
      ) : null}
      {photo ? <Lightbox src={photo} onClose={() => setPhoto(null)} /> : null}
      {reporting ? <ReportDialog target={reporting} onClose={() => setReporting(null)} /> : null}
    </div>
  )
}

function StickerPanel({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const recent = recentStickers()
  const [tab, setTab] = useState(recent.length ? 'recent' : PACKS[0].id)
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!(e.target as Element | null)?.closest?.('.sticker-panel, .sticker-btn')) onClose() }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [onClose])
  const ids = tab === 'recent' ? recent : PACKS.find((p) => p.id === tab)?.stickers.map((s) => s.id) ?? []
  return (
    <div className="sticker-panel" data-testid="sticker-panel">
      <div className="sticker-tabs">
        {recent.length ? <button type="button" className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>{tx("🕘 Recent")}</button> : null}
        {PACKS.map((p) => <button key={p.id} type="button" className={tab === p.id ? 'on' : ''} onClick={() => setTab(p.id)} data-testid={`sticker-tab-${p.id}`}>{p.icon} {tx(p.name)}</button>)}
      </div>
      <div className="sticker-grid">
        {ids.map((id) => <button key={id} type="button" onClick={() => onPick(id)} data-testid={`sticker-${id}`} title={stickerLabel(id)}><Sticker id={id} size={64} live /><span>{stickerLabel(id)}</span></button>)}
      </div>
      <div className="sticker-note">{tx("Original Pingo stickers · animated packs move in chat")}</div>
    </div>
  )
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function ScheduleDialog({ initialText, initialWhen, editing, onClose, onSave }: { initialText: string; initialWhen: Date | null; editing: boolean; onClose: () => void; onSave: (text: string, when: Date) => Promise<void> }) {
  const [body, setBody] = useState(initialText)
  const [when, setWhen] = useState(() => toLocalInput(initialWhen ?? new Date(Date.now() + 3600000)))
  const [busy, setBusy] = useState(false)
  const quick: [string, () => Date][] = [
    ['In 10 min', () => new Date(Date.now() + 600000)],
    ['In 1 hour', () => new Date(Date.now() + 3600000)],
    ['Tonight 8 PM', () => { const d = new Date(); d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); return d }],
    ['Tomorrow 9 AM', () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d }],
  ]
  const date = new Date(when)
  const valid = body.trim().length > 0 && !Number.isNaN(date.getTime()) && date.getTime() > Date.now() - 60000
  return (
    <div className="backdrop center" onClick={onClose}>
      <div className="sched-dialog" onClick={(e) => e.stopPropagation()} data-testid="sched-dialog">
        <h3>⏰ {editing ? tx('Edit scheduled message') : tx('Send later')}</h3>
        <textarea className="input" rows={3} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} data-testid="sched-text" />
        <div className="sched-quick">{quick.map(([l, f]) => <button key={l} type="button" className="mini-btn" onClick={() => setWhen(toLocalInput(f()))}>{l}</button>)}</div>
        <input className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} data-testid="sched-when" />
        <small className="a-note">{tx("Pingo sends it from your app — on time if it’s open, otherwise as soon as you open Pingo again.")}</small>
        <div className="result-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tx("Cancel")}</button>
          <button type="button" className="btn btn-primary" disabled={!valid || busy} data-testid="sched-save" onClick={async () => { setBusy(true); await onSave(body.trim(), date); setBusy(false) }}>{editing ? tx('Save') : tx('Schedule')}</button>
        </div>
      </div>
    </div>
  )
}

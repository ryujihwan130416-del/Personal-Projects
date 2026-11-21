import { collection, getDocs, getDocsFromCache, limitToLast, orderBy, query } from 'firebase/firestore'
import { db, fsCol } from '../firebase/app'
import type { ChatDoc, MessageDoc, ReplyPreview } from '../types'

/** How many messages the open room paints. Enough to fill a phone, small enough to open at once. */
export const OPEN_PAGE = 16

const chats = new Map<string, ChatDoc>()
const messages = new Map<string, MessageDoc[]>()
const listeners = new Set<() => void>()
const started = new Set<string>()
const queue: string[] = []
let pumping = false

export function asMsg(id: string, data: Record<string, unknown>): MessageDoc {
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

export function cachedChat(id: string): ChatDoc | null {
  return chats.get(id) ?? null
}
export function cachedChatList(): ChatDoc[] {
  return [...chats.values()].sort((a, b) => (b.lastMessageAt?.toMillis() ?? 0) - (a.lastMessageAt?.toMillis() ?? 0))
}
export function cachedMessages(id: string): MessageDoc[] | null {
  return messages.get(id) ?? null
}
export function rememberChat(chat: ChatDoc) {
  chats.set(chat.id, chat)
}
export function rememberChats(list: ChatDoc[]) {
  for (const chat of list) chats.set(chat.id, chat)
}
export function rememberMessages(id: string, list: MessageDoc[]) {
  messages.set(id, list)
}
export function subscribeChatCache(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function pageQuery(id: string) {
  return query(collection(db, ...fsCol('chats', id, 'messages')), orderBy('createdAt', 'asc'), limitToLast(OPEN_PAGE))
}

async function load(id: string) {
  const qy = pageQuery(id)
  try {
    const cached = await getDocsFromCache(qy)
    if (!cached.empty && !messages.has(id)) {
      messages.set(id, cached.docs.map((d) => asMsg(d.id, d.data())))
      listeners.forEach((fn) => fn())
    }
  } catch { /* nothing cached yet */ }
  try {
    const snap = await getDocs(qy)
    messages.set(id, snap.docs.map((d) => asMsg(d.id, d.data())))
    listeners.forEach((fn) => fn())
  } catch { /* offline; the live listener will fill the room */ }
}

/** Start this room's messages immediately (finger down, before the screen opens). */
export function prefetchNow(id: string) {
  if (!id || messages.has(id) || started.has(id)) return
  started.add(id)
  void load(id).finally(() => { /* keep started so we don't download twice */ })
}

/** Warm the rooms at the top of the inbox, one at a time, so opening one is a local paint. */
export function prefetchChats(ids: string[]) {
  for (const id of ids) {
    if (!id || messages.has(id) || started.has(id) || queue.includes(id)) continue
    queue.push(id)
  }
  if (!pumping) void pump()
}

async function pump() {
  pumping = true
  while (queue.length) {
    const id = queue.shift()!
    if (messages.has(id) || started.has(id)) continue
    started.add(id)
    await load(id)
    await new Promise((resolve) => window.setTimeout(resolve, 30))
  }
  pumping = false
}

import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, runTransaction, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import type { UserProfile } from '../types'
import { countMessage } from './activity'
import { autoFlag } from './moderation'
import { pingMembers } from './pushPing'

/**
 * Scheduled messages live privately at users/{uid}/scheduled/{id}. With no server, they are delivered
 * by the sender's own app: on time while it is open, or right away the next time it opens.
 * Delivery runs in a transaction that deletes the scheduled doc, so two open tabs can't double-send.
 */
export interface Scheduled { id: string; chatId: string; text: string; sendAt: Timestamp; chatTitle: string }

export function useScheduled(chatId?: string): Scheduled[] {
  const { user } = useAuth()
  const [list, setList] = useState<Scheduled[]>([])
  useEffect(() => {
    if (!user) return
    return onSnapshot(collection(db, ...fsCol('users', user.uid, 'scheduled')), (s) => {
      const all = s.docs.map((d) => ({ id: d.id, chatId: String(d.data().chatId), text: String(d.data().text ?? ''), sendAt: d.data().sendAt as Timestamp, chatTitle: String(d.data().chatTitle ?? '') }))
        .filter((x) => x.sendAt)
      all.sort((a, b) => a.sendAt.toMillis() - b.sendAt.toMillis())
      setList(all)
    }, () => setList([]))
  }, [user])
  return chatId ? list.filter((x) => x.chatId === chatId) : list
}

export async function scheduleMessage(uid: string, chatId: string, text: string, when: Date, chatTitle: string) {
  await addDoc(collection(db, ...fsCol('users', uid, 'scheduled')), { chatId, text: text.slice(0, 4000), sendAt: Timestamp.fromDate(when), chatTitle: chatTitle.slice(0, 80), createdAt: serverTimestamp() })
}
export async function editScheduled(uid: string, s: Scheduled, text: string, when: Date) {
  await updateDoc(doc(db, ...fsCol('users', uid, 'scheduled', s.id)), { text: text.slice(0, 4000), sendAt: Timestamp.fromDate(when), updatedAt: serverTimestamp() })
}
export async function cancelScheduled(uid: string, id: string) {
  await deleteDoc(doc(db, ...fsCol('users', uid, 'scheduled', id)))
}

/** Sends one scheduled message now (no-op if another tab already did). */
export async function deliverScheduled(uid: string, profile: UserProfile, id: string): Promise<boolean> {
  const sref = doc(db, ...fsCol('users', uid, 'scheduled', id))
  let sent: { chatId: string; text: string; memberIds: string[] } | null = null
  await runTransaction(db, async (tx) => {
    const s = await tx.get(sref)
    if (!s.exists()) return
    const { chatId, text } = s.data() as { chatId: string; text: string }
    const chat = await tx.get(doc(db, ...fsCol('chats', chatId)))
    if (!chat.exists()) { tx.delete(sref); return }
    const c = chat.data()
    const ttl = typeof c.disappearAfter === 'number' && c.disappearAfter > 0 ? c.disappearAfter : 0
    const sentAt = Timestamp.now()
    tx.delete(sref)
    tx.set(doc(db, ...fsCol('chats', chatId, 'messages', id)), {
      senderId: uid, text, type: 'text', photoURL: null, createdAt: sentAt, unsent: false, replyTo: null,
      reactions: {}, readBy: { [uid]: sentAt }, scheduled: true,
      ...(ttl ? { expiresAt: Timestamp.fromMillis(Date.now() + ttl * 1000) } : {}),
    })
    sent = { chatId, text, memberIds: (c.memberIds as string[]) ?? [] }
  })
  const done = sent as { chatId: string; text: string; memberIds: string[] } | null
  if (!done) return false
  const sentAt = Timestamp.now()
  pingMembers(uid, done.memberIds, id, { kind: 'msg', chatId: done.chatId, title: profile.displayName, body: done.text })
  const patch: Record<string, unknown> = {
    lastMessage: { text: done.text, senderId: uid, type: 'text', createdAt: sentAt },
    lastMessageAt: sentAt,
    [`memberInfo.${uid}`]: { displayName: profile.displayName, username: profile.username, photoURL: profile.photoURL },
  }
  for (const m of done.memberIds) if (m !== uid) patch[`unread.${m}`] = increment(1)
  await updateDoc(doc(db, ...fsCol('chats', done.chatId)), patch).catch(() => { /* preview only */ })
  countMessage()
  void autoFlag({ chatId: done.chatId, messageId: id, senderId: uid, text: done.text, flaggedBy: uid, source: 'send' })
  return true
}

/** Mounted in the app shell: fires due scheduled messages while the app is open. */
export function ScheduledRunner() {
  const { user, profile } = useAuth()
  const list = useScheduled()
  const busy = useRef(new Set<string>())
  useEffect(() => {
    if (!user || !profile) return
    const timers: number[] = []
    const fire = (id: string) => {
      if (busy.current.has(id)) return
      busy.current.add(id)
      void deliverScheduled(user.uid, profile, id).catch((e) => console.warn('scheduled send failed', e)).finally(() => busy.current.delete(id))
    }
    for (const s of list) {
      const wait = s.sendAt.toMillis() - Date.now()
      if (wait <= 0) fire(s.id)
      else if (wait < 2 ** 31 - 1) timers.push(window.setTimeout(() => fire(s.id), wait))
    }
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [list, user, profile])
  return null
}

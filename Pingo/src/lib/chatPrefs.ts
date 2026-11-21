import { arrayRemove, arrayUnion, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'

/** Private per-user chat list prefs (pinned / archived chat ids), at users/{uid}/private/chatPrefs. */
export interface ChatPrefs { pinned: string[]; archived: string[] }
const EMPTY: ChatPrefs = { pinned: [], archived: [] }

let cacheUid = ''
let cache: ChatPrefs = EMPTY
let unsub: (() => void) | null = null
const subs = new Set<(p: ChatPrefs) => void>()

function ensure(uid: string) {
  if (cacheUid === uid && unsub) return
  unsub?.()
  cacheUid = uid
  cache = EMPTY
  unsub = onSnapshot(doc(db, ...fsCol('users', uid, 'private', 'chatPrefs')), (s) => {
    const d = s.data() ?? {}
    cache = { pinned: Array.isArray(d.pinned) ? d.pinned : [], archived: Array.isArray(d.archived) ? d.archived : [] }
    subs.forEach((f) => f(cache))
  }, () => { unsub = null })
}

export function useChatPrefs(): ChatPrefs {
  const { user } = useAuth()
  const [p, setP] = useState<ChatPrefs>(cache)
  useEffect(() => {
    if (!user) return
    ensure(user.uid)
    subs.add(setP)
    setP(cache)
    return () => { subs.delete(setP) }
  }, [user])
  return user ? p : EMPTY
}

async function patch(uid: string, field: 'pinned' | 'archived', chatId: string, on: boolean) {
  await setDoc(doc(db, ...fsCol('users', uid, 'private', 'chatPrefs')), { [field]: on ? arrayUnion(chatId) : arrayRemove(chatId), updatedAt: serverTimestamp() }, { merge: true })
}
export const setPinned = (uid: string, chatId: string, on: boolean) => patch(uid, 'pinned', chatId, on)
export async function setArchived(uid: string, chatId: string, on: boolean) {
  await patch(uid, 'archived', chatId, on)
  if (on) await patch(uid, 'pinned', chatId, false)
}

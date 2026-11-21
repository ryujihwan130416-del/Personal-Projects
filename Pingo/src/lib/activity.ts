import { addDoc, collection, doc, increment, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, fsCol } from '../firebase/app'
import type { GameType } from '../types'

export type ActivityType = 'signup' | 'login' | 'report_filed' | 'report_received'

/** Lightweight audit trail for the admin console (dmly/app/activity). Never throws. */
export async function logActivity(actor: string, type: ActivityType, meta: Record<string, string> = {}, uid: string = actor) {
  try {
    await addDoc(collection(db, ...fsCol('activity')), { uid, actor, type, meta, at: serverTimestamp() })
  } catch { /* best effort */ }
}

/** Local calendar day, e.g. 2026-11-21 — the key of a dmly/app/stats/{day} doc. */
export function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Daily counters for the admin charts (client-side; there are no Cloud Functions). */
export function countMessage() {
  void setDoc(doc(db, ...fsCol('stats', dayKey())), { messages: increment(1), updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
}
export function countGamePlay(type: GameType) {
  void setDoc(doc(db, ...fsCol('stats', dayKey())), { games: { [type]: increment(1) }, updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
}

/**
 * Instant Android notifications without a server.
 *
 * Senders drop a tiny "ping" at /dmly/notify/{recipient}/{messageId} in the Realtime Database, but only for
 * recipients who registered the Android app (/dmly/devices/{uid}). The app's foreground service keeps its own
 * streaming connection to that node (native code, independent of the WebView), posts exactly one notification per
 * ping id and deletes it. Web/desktop browsers keep using the Firestore listener in components/Alerts.tsx.
 */
import { get, ref, remove, serverTimestamp, set } from 'firebase/database'
import { rtdb } from '../firebase/app'

export type PingKind = 'msg' | 'call' | 'call-end'
interface Ping { kind: PingKind; chatId: string; title: string; body?: string; video?: boolean; group?: string }

const devCache = new Map<string, { on: boolean; at: number }>()
async function hasAndroid(uid: string): Promise<boolean> {
  const c = devCache.get(uid)
  if (c && Date.now() - c.at < 120_000) return c.on
  let on = false
  try { const s = await get(ref(rtdb, `dmly/devices/${uid}`)); on = !!s.val()?.android } catch { on = c?.on ?? false }
  devCache.set(uid, { on, at: Date.now() })
  return on
}

/** Fire-and-forget: never blocks or fails a send. `id` is the dedupe key (message id / call id). */
export function pingMembers(from: string, recipients: string[], id: string, p: Ping) {
  const clean = id.replace(/[.#$[\]/]/g, '_').slice(0, 70)
  for (const uid of recipients) {
    if (uid === from) continue
    void hasAndroid(uid).then((on) => {
      if (!on) return
      return set(ref(rtdb, `dmly/notify/${uid}/${clean}`), {
        from, kind: p.kind, chatId: p.chatId, title: p.title.slice(0, 120), body: (p.body ?? '').slice(0, 300),
        ...(p.video ? { video: true } : {}), ...(p.group ? { group: p.group.slice(0, 80) } : {}), at: serverTimestamp(),
      })
    }).catch(() => {})
  }
}

/** The Android app registers itself so senders know to ping it (and unregisters on sign-out). */
export async function registerDevice(uid: string, on: boolean) {
  try {
    if (on) await set(ref(rtdb, `dmly/devices/${uid}`), { android: true, at: Date.now() })
    else await remove(ref(rtdb, `dmly/devices/${uid}`))
  } catch { /* offline */ }
}
/** Pings are consumed by the native service; the app also clears leftovers whenever it is open. */
export async function clearMyPings(uid: string) { try { await remove(ref(rtdb, `dmly/notify/${uid}`)) } catch { /* ignore */ } }

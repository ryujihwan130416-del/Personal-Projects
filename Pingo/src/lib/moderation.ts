import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../firebase/app'
import { DEFAULT_MODERATION, detect, normalizeConfig, type ModerationConfig } from './filter'

export * from './filter'

let cached: ModerationConfig = DEFAULT_MODERATION
let subscribed = false
let loaded: Promise<void> | null = null
const listeners = new Set<(c: ModerationConfig) => void>()
function ensureSub() {
  if (subscribed) return loaded!
  subscribed = true
  loaded = new Promise<void>((resolve) => {
    onSnapshot(doc(db, ...fsCol('config', 'moderation')), (snap) => {
      cached = normalizeConfig(snap.exists() ? (snap.data() as Partial<ModerationConfig>) : null)
      listeners.forEach((l) => l(cached))
      resolve()
    }, () => {
      // e.g. subscribed before sign-in finished: try again shortly while someone is listening.
      subscribed = false; resolve()
      setTimeout(() => { if (listeners.size && !subscribed) void ensureSub() }, 1500)
    })
  })
  return loaded
}
/** Starts loading the admin's word lists early (e.g. when a chat opens). */
export function preloadModerationConfig() { void ensureSub() }
export function getModerationConfig() { ensureSub(); return cached }
export function useModerationConfig() {
  const [cfg, setCfg] = useState(getModerationConfig())
  useEffect(() => { ensureSub(); listeners.add(setCfg); setCfg(cached); return () => { listeners.delete(setCfg) } }, [])
  return cfg
}

export const flagId = (chatId: string, messageId: string) => `${chatId}__${messageId}`

/** Writes an auto-flag for a message. Never blocks sending; errors are swallowed. */
export async function autoFlag(opts: { chatId: string; messageId: string; senderId: string; text: string; flaggedBy: string; source: 'send' | 'edit' }) {
  await Promise.race([ensureSub(), new Promise((r) => setTimeout(r, 2500))])
  const d = detect(opts.text, cached)
  if (!d) return null
  try {
    await setDoc(doc(db, ...fsCol('flags', flagId(opts.chatId, opts.messageId))), {
      messageId: opts.messageId, chatId: opts.chatId, senderId: opts.senderId,
      category: d.category, categories: d.categories, terms: d.terms,
      snippet: opts.text.slice(0, 280), createdAt: serverTimestamp(), source: opts.source, status: 'open', flaggedBy: opts.flaggedBy,
    })
  } catch { /* already flagged, or offline */ }
  return d
}

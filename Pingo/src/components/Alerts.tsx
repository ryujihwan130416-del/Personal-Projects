/**
 * App-wide alerts while signed in:
 *  - incoming call: ringtone (WebAudio) + system notification when Pingo isn't in front (web Notification or,
 *    in the Android app, a high-priority full-screen call notification that rings with the phone ringtone)
 *  - outgoing call: ringback tone until the other side answers
 *  - new messages: a "ding" + notification when you're not looking at that chat
 *  - Android app: keeps a foreground service running so all of this works in the background / screen off
 */
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCall } from '../contexts/CallContext'
import { db, fsCol } from '../firebase/app'
import { tx } from '../i18n'
import { alertPrefs, messageDing, startRingback, startRingtone, stopRingback, stopRingtone, useAlertPrefs } from '../lib/alertSounds'
import { appActive, appActiveNow, isNative, PingoNative, safe } from '../lib/native'
import { asChat, previewText } from '../pages/Inbox'
import { firebaseConfig } from '../firebase/config'
import { registerDevice } from '../lib/pushPing'
import type { ChatDoc } from '../types'

function webNotify(title: string, body: string, tag: string, onClick: () => void, requireInteraction = false): Notification | null {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null
    const n = new Notification(title, { body, tag, icon: '/favicon.svg', requireInteraction })
    n.onclick = () => { window.focus(); onClick(); n.close() }
    return n
  } catch { return null }
}
const titleOf = (c: ChatDoc, sender: string) => {
  const name = c.memberInfo[sender]?.displayName || tx('Someone')
  return c.type === 'group' ? `${c.title || tx('Group')} · ${name}` : name
}

/** True exactly once per key across all tabs/windows (persisted, so reloads don't re-alert either). */
const ALERTED = 'pingo-alerted-v1'
async function claimAlert(key: string): Promise<boolean> {
  const run = () => {
    let list: string[] = []
    try { list = JSON.parse(localStorage.getItem(ALERTED) || '[]') } catch { list = [] }
    if (list.includes(key)) return false
    list.push(key)
    try { localStorage.setItem(ALERTED, JSON.stringify(list.slice(-300))) } catch { /* ignore */ }
    return true
  }
  const locks = (navigator as Navigator & { locks?: LockManager }).locks
  if (locks?.request) { try { return await locks.request('pingo-alert', run) } catch { /* fall through */ } }
  return run()
}
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 100000 + 1000 }

export function Alerts() {
  const { user, isBlocked } = useAuth()
  const { phase, call } = useCall()
  const nav = useNavigate()
  const loc = useLocation()
  const [prefs] = useAlertPrefs()
  const chats = useRef(new Map<string, ChatDoc>())
  const path = useRef(loc.pathname)
  path.current = loc.pathname

  // Taps on Android notifications → open the chat / call.
  useEffect(() => {
    if (!isNative) return
    const h = PingoNative.addListener('open', (d) => { if (d.url) nav(d.url) })
    return () => { void h.then((x) => x.remove()).catch(() => {}) }
  }, [nav])

  // Android: foreground service keeps Pingo alive in the background and with the screen off.
  useEffect(() => {
    if (!isNative || !user) return
    if (prefs.background) void safe(() => PingoNative.startBackground({ title: 'Pingo', text: tx('Pingo is running so calls and messages reach you') }))
    else void safe(() => PingoNative.stopBackground())
  }, [user, prefs.background])
  useEffect(() => () => { if (isNative) void safe(() => PingoNative.stopBackground()) }, [])

  // Android app: hand the service its own Realtime Database stream (instant notifications while asleep).
  const { blockedIds } = useAuth()
  useEffect(() => {
    if (!isNative || !user) return
    const on = prefs.background
    void registerDevice(user.uid, on)
    void safe(() => PingoNative.setPushAuth(on
      ? { uid: user.uid, refreshToken: user.refreshToken, apiKey: firebaseConfig.apiKey, dbUrl: firebaseConfig.databaseURL ?? '', blocked: [...blockedIds] }
      : { uid: '', refreshToken: '', apiKey: '', dbUrl: '', blocked: [] }))
  }, [user, prefs.background, blockedIds])

  // New messages (web + Android app in the foreground). One alert per message, ever:
  // keyed by chat + message time + sender, claimed in localStorage under a cross-tab lock.
  const blockedRef = useRef(isBlocked)
  blockedRef.current = isBlocked
  useEffect(() => {
    if (!user) return
    const uid = user.uid
    let first = true
    const since = Date.now() - 5000
    const q = query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', uid))
    return onSnapshot(q, (snap) => {
      const wasFirst = first
      first = false
      if (wasFirst) { for (const d of snap.docs) chats.current.set(d.id, asChat(d.id, d.data())); return }
      for (const ch of snap.docChanges()) {
        const c = asChat(ch.doc.id, ch.doc.data())
        chats.current.set(c.id, c)
        if (ch.type === 'removed' || ch.doc.metadata.hasPendingWrites) continue
        const lm = c.lastMessage
        const at = lm?.createdAt?.toMillis?.() ?? 0
        if (!lm || !at || at < since || lm.senderId === uid || lm.type === 'system' || blockedRef.current(lm.senderId)) continue
        const key = `${c.id}:${at}:${lm.senderId}`
        const viewing = path.current === `/chat/${c.id}`
        void claimAlert(key).then(async (mine) => {
          if (!mine) return
          const active = await appActiveNow()
          if (viewing && active) return
          const p = alertPrefs()
          if (active) { messageDing(); return }
          if (!p.msgNotify) return
          // In the Android app the background service posts message notifications itself (one per message id).
          if (isNative) { if (!p.background) void safe(() => PingoNative.notify({ id: hash(c.id), title: titleOf(c, lm.senderId), body: previewText(c), url: `/chat/${c.id}` })); return }
          webNotify(titleOf(c, lm.senderId), previewText(c), `chat-${c.id}`, () => nav(`/chat/${c.id}`))
        })
      }
    }, () => {})
  }, [user, nav])

  // Calls: ringtone / ringback / call notification.
  const callNote = useRef<Notification | null>(null)
  useEffect(() => {
    if (phase === 'incoming' && call && user) {
      const callerId = call.callerId
      const fromChat = chats.current.get(call.chatId)?.memberInfo[callerId]?.displayName
      const name = fromChat || tx('Someone')
      const video = call.type === 'video'
      const title = video ? tx('📹 {name} is video calling…', { name }) : tx('📞 {name} is calling…', { name })
      const body = tx('Tap to answer in Pingo')
      // Android app in the background: the system call notification rings (never both at once).
      if (!isNative || appActive()) startRingtone()
      if (isNative) void safe(() => PingoNative.incomingCall({ title, body, url: `/chat/${call.chatId}`, video, key: call.id }))
      else if (!appActive()) callNote.current = webNotify(title, body, `call-${call.id}`, () => nav(`/chat/${call.chatId}`), true)
      // Missed after 45 s if nobody answers.
      const t = window.setTimeout(() => { stopRingtone(); if (isNative) void safe(() => PingoNative.cancelCall()) }, 45000)
      return () => { clearTimeout(t); stopRingtone(); callNote.current?.close(); callNote.current = null; if (isNative) void safe(() => PingoNative.cancelCall()) }
    }
    if (phase === 'outgoing') {
      startRingback()
      return () => stopRingback()
    }
    return undefined
  }, [phase, call?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Android app: hand ringing over between the in-app ringtone and the system call notification.
  const phaseRef = useRef(phase); phaseRef.current = phase
  const callRef = useRef(call); callRef.current = call
  useEffect(() => {
    if (!isNative) return
    const h = PingoNative.addListener('appState', ({ active }) => {
      const c = callRef.current
      if (phaseRef.current !== 'incoming' || !c) return
      if (active) startRingtone()
      else {
        stopRingtone()
        const name = chats.current.get(c.chatId)?.memberInfo[c.callerId]?.displayName || tx('Someone')
        const video = c.type === 'video'
        void safe(() => PingoNative.incomingCall({ title: video ? tx('📹 {name} is video calling…', { name }) : tx('📞 {name} is calling…', { name }), body: tx('Tap to answer in Pingo'), url: `/chat/${c.chatId}`, video, key: c.id }))
      }
    })
    return () => { void h.then((x) => x.remove()).catch(() => {}) }
  }, [])

  return null
}

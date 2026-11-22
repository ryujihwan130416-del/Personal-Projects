/**
 * Calendar reminders as real phone notifications in the Android app.
 * The web uses the Notification API while a tab is open (components/EventBits.tsx). Android's WebView has no
 * Notification API, so the app schedules each upcoming reminder with @capacitor/local-notifications: exact
 * alarms that fire even when Pingo is closed or the phone is asleep. Rescheduled whenever events change.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { eventOnDay, occurrenceOn, toYmd } from './events'
import { isNative } from './native'
import type { EventDoc } from '../types'

export const EVENT_CHANNEL = 'pingo_events'
let channelReady: Promise<void> | null = null
function channel() {
  channelReady ??= LocalNotifications.createChannel({ id: EVENT_CHANNEL, name: navigator.language.startsWith('ko') ? '일정 알림' : 'Event reminders', importance: 5, visibility: 1, vibration: true }).catch(() => {})
  return channelReady
}

export type NativePerm = 'granted' | 'denied' | 'default'
export async function nativeNotifyPermission(): Promise<NativePerm> {
  try { const p = await LocalNotifications.checkPermissions(); return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default' } catch { return 'default' }
}
export async function requestNativeNotify(): Promise<NativePerm> {
  try { const p = await LocalNotifications.requestPermissions(); return p.display === 'granted' ? 'granted' : 'denied' } catch { return 'denied' }
}

const idFor = (key: string) => { let h = 7; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0; return 100000 + (Math.abs(h) % 1_900_000_000) }

export async function nativeTestNotification(title: string, body: string) {
  await channel()
  await LocalNotifications.schedule({ notifications: [{ id: idFor('test-' + Date.now()), title, body, channelId: EVENT_CHANNEL, smallIcon: 'ic_stat_pingo', schedule: { at: new Date(Date.now() + 1500), allowWhileIdle: true } }] })
}

interface Fmt { now: (title: string) => string; soon: (title: string, n: number) => string; hours: (title: string, n: number) => string }
let lastSig = ''
/** Replace all scheduled event reminders with the next 14 days' worth. `enabled=false` clears them. */
export async function syncNativeReminders(events: EventDoc[], enabled: boolean, fmt: Fmt) {
  if (!isNative) return
  const items: { id: number; at: number; title: string; body: string; url: string }[] = []
  if (enabled) {
    const now = Date.now()
    for (let off = 0; off < 14; off++) {
      const d = new Date(); d.setDate(d.getDate() + off); const ymd = toYmd(d)
      for (const ev of events) {
        if (!ev.startAt || ev.reminder < 0 || !eventOnDay(ev, ymd)) continue
        const occ = occurrenceOn(ev, ymd)
        const startMs = ev.allDay ? occ.start.getTime() + 9 * 3600 * 1000 : occ.start.getTime()
        const at = startMs - ev.reminder * 60000
        if (at < now + 3000) continue
        const mins = ev.reminder
        const msg = mins <= 0 ? fmt.now(ev.title) : mins < 60 ? fmt.soon(ev.title, mins) : fmt.hours(ev.title, Math.round(mins / 60))
        const key = `${ev.id}-${ev.repeat === 'none' ? '' : ymd}-${ev.reminder}`
        items.push({ id: idFor(key), at, title: ev.title, body: `${msg.replace(/^⏰\s*/, '')}${ev.location ? ` · 📍 ${ev.location}` : ''}`, url: `/event/${ev.id}` })
      }
    }
    items.sort((a, b) => a.at - b.at); items.splice(60) // Android caps pending alarms per app; 60 is plenty for 2 weeks
  }
  const sig = JSON.stringify(items)
  if (sig === lastSig) return
  lastSig = sig
  try {
    const pending = await LocalNotifications.getPending()
    const ours = pending.notifications.filter((n) => (n.extra as { pingo?: string } | undefined)?.pingo === 'event')
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
    if (!items.length) return
    await channel()
    await LocalNotifications.schedule({
      notifications: items.map((i) => ({ id: i.id, title: i.title, body: i.body, channelId: EVENT_CHANNEL, smallIcon: 'ic_stat_pingo', extra: { pingo: 'event', url: i.url }, schedule: { at: new Date(i.at), allowWhileIdle: true } })),
    })
  } catch { lastSig = '' }
}

/** Tapping a reminder opens the event. */
export function onReminderTap(go: (url: string) => void) {
  if (!isNative) return () => {}
  const h = LocalNotifications.addListener('localNotificationActionPerformed', (a) => { const url = (a.notification.extra as { url?: string } | undefined)?.url; if (url) go(url) })
  return () => { void h.then((x) => x.remove()).catch(() => {}) }
}

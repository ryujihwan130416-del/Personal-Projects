import { tx } from '../i18n'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'
import {
  eventOnDay,
  formatOccWhen,
  occurrenceOn,
  setRsvp,
  toYmd,
  upcoming,
  useEventsFor,
  useRsvps,
} from '../lib/events'
import type { RsvpStatus } from '../types'
import { notifyEnabled } from '../lib/prefs'
import { isNative } from '../lib/native'
import { onReminderTap, syncNativeReminders } from '../lib/eventNotify'
import { useNavigate } from 'react-router-dom'

export function RsvpBar({ eventId, uid }: { eventId: string; uid: string }) {
  const t = useT()
  const toast = useToast()
  const map = useRsvps(eventId)
  const mine = map[uid]
  const pick = async (status: RsvpStatus) => {
    try { await setRsvp(eventId, uid, status) }
    catch (err) { toast(err instanceof Error ? err.message : t('cal.saveFailed')) }
  }
  return (
    <div className="rsvp-bar" data-testid={`rsvp-bar-${eventId}`}>
      {(['going', 'maybe', 'no'] as const).map((s) => (
        <button
          key={s}
          type="button"
          className={`btn ${mine === s ? 'btn-lime' : 'btn-ghost'}`}
          data-testid={`rsvp-${s}`}
          aria-pressed={mine === s}
          onClick={() => pick(s)}
        >
          {t(`cal.rsvp.${s}`)}{(() => { const n = Object.values(map).filter((v) => v === s).length; return n ? ` · ${n}` : '' })()}
        </button>
      ))}
    </div>
  )
}

/** Compact "✓3 ?1 ✕0" RSVP summary. */
export function RsvpCounts({ eventId }: { eventId: string }) {
  const map = useRsvps(eventId)
  const v = Object.values(map)
  const c = (s: RsvpStatus) => v.filter((x) => x === s).length
  return (
    <span className="rsvp-counts" data-testid={`rsvp-counts-${eventId}`} title={tx("Going / Maybe / No")}>
      <b>✓{c('going')}</b><span>?{c('maybe')}</span><span>✕{c('no')}</span>
    </span>
  )
}

export function UpcomingList({ uid, limit = 4, testId }: { uid: string; limit?: number; testId?: string }) {
  const t = useT()
  const events = useEventsFor(uid)
  const rows = upcoming(events, new Date(), limit)
  if (!rows.length) return null
  return (
    <div className="upcoming" data-testid={testId ?? 'upcoming-list'}>
      <h3 className="section">{t('cal.upcoming')}</h3>
      {rows.map((o) => (
        <Link key={o.ev.id} to={`/event/${o.ev.id}`} className="event-row compact" data-testid={`upcoming-${o.ev.id}`}>
          <span className="event-dot" style={{ background: o.ev.color }} />
          <span className="name">{o.ev.title}</span>
          <span className="when">{formatOccWhen(o)}</span>
        </Link>
      ))}
    </div>
  )
}

export function EventReminders() {
  const { user } = useAuth()
  const events = useEventsFor(user?.uid)
  const toast = useToast()
  const t = useT()

  const nav = useNavigate()
  // Android app: schedule reminders natively so they fire with the app closed / phone asleep.
  useEffect(() => {
    if (!isNative) return
    const sync = () => void syncNativeReminders(user ? events : [], !!user && notifyEnabled(), {
      now: (title) => t('cal.reminderNow', { title }), soon: (title, n) => t('cal.reminderSoon', { title, n }), hours: (title, n) => t('cal.reminderHours', { title, n }),
    })
    const h = window.setTimeout(sync, 800)
    window.addEventListener('pingo-notify-pref', sync)
    return () => { clearTimeout(h); window.removeEventListener('pingo-notify-pref', sync) }
  }, [events, user, t])
  useEffect(() => onReminderTap((url) => nav(url)), [nav])

  useEffect(() => {
    if (!user) return
    const tick = () => {
      const now = Date.now()
      for (let off = 0; off <= 1; off++) {
        const d = new Date()
        d.setDate(d.getDate() + off)
        const ymd = toYmd(d)
        for (const ev of events) {
          if (!ev.startAt || ev.reminder < 0 || !eventOnDay(ev, ymd)) continue
          const occ = occurrenceOn(ev, ymd)
          // All-day events remind relative to 9:00.
          const startMs = ev.allDay ? occ.start.getTime() + 9 * 3600 * 1000 : occ.start.getTime()
          const trigger = startMs - ev.reminder * 60000
          if (now < trigger || now > startMs + 5 * 60000) continue
          const key = `dmly-reminded-${ev.id}-${ev.repeat === "none" ? "" : ymd}-${ev.reminder}`
          try { if (sessionStorage.getItem(key)) continue } catch { /* ignore */ }
          try { sessionStorage.setItem(key, '1') } catch { /* ignore */ }
          const mins = Math.max(0, Math.round((startMs - now) / 60000))
          const msg = mins <= 0 ? t('cal.reminderNow', { title: ev.title })
            : mins < 60 ? t('cal.reminderSoon', { title: ev.title, n: mins })
              : t('cal.reminderHours', { title: ev.title, n: Math.round(mins / 60) })
          toast(msg)
          if (notifyEnabled() && !isNative) {
            try {
              const n = new Notification(ev.title, { body: `${msg.replace(/^⏰\s*/, '')}${ev.location ? ` · 📍 ${ev.location}` : ''}`, tag: key, icon: '/favicon.svg' })
              n.onclick = () => { window.focus(); window.location.assign(`/event/${ev.id}`) }
            } catch { /* some browsers only allow notifications from a service worker */ }
          }
        }
      }
    }
    tick()
    const id = window.setInterval(tick, 20000)
    return () => window.clearInterval(id)
  }, [events, user, toast, t])

  return null
}

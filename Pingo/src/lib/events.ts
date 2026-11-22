import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../firebase/app'
import { dateLocale, t } from '../i18n'
import type { EventDoc, RsvpStatus } from '../types'

export const EVENT_COLORS = ['#FF4D3A', '#3D9CFF', '#C8F542', '#7B5CFF', '#FF8A00', '#FF5FA8', '#2BB673']

export type Repeat = EventDoc['repeat']
export const CATEGORIES = [
  { id: 'personal', color: '#3D9CFF' },
  { id: 'work', color: '#7B5CFF' },
  { id: 'social', color: '#FF5FA8' },
  { id: 'health', color: '#2BB673' },
  { id: 'study', color: '#FF8A00' },
  { id: 'other', color: '#FF4D3A' },
] as const
export const REPEATS: Repeat[] = ['none', 'daily', 'weekly', 'monthly']
export const REMINDERS = [-1, 0, 10, 60, 1440] as const

export function asEvent(id: string, data: Record<string, unknown>): EventDoc {
  return {
    id,
    title: String(data.title ?? ''),
    note: String(data.note ?? ''),
    color: String(data.color ?? EVENT_COLORS[0]),
    allDay: Boolean(data.allDay),
    startAt: (data.startAt as EventDoc['startAt']) ?? null,
    endAt: (data.endAt as EventDoc['endAt']) ?? null,
    ownerId: String(data.ownerId ?? ''),
    chatId: (data.chatId as string | null) ?? null,
    memberIds: (data.memberIds as string[]) ?? [],
    category: String(data.category ?? 'other'),
    location: String(data.location ?? ''),
    repeat: (['daily', 'weekly', 'monthly'].includes(String(data.repeat)) ? data.repeat : 'none') as Repeat,
    reminder: typeof data.reminder === 'number' ? data.reminder : data.allDay ? -1 : 15,
    createdAt: (data.createdAt as EventDoc['createdAt']) ?? null,
    updatedAt: (data.updatedAt as EventDoc['updatedAt']) ?? null,
  }
}

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function fromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
}

export function hmOf(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function combine(ymd: string, hm: string): Date {
  const [h, min] = (hm || '09:00').split(':').map(Number)
  const d = fromYmd(ymd)
  d.setHours(h || 0, min || 0, 0, 0)
  return d
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function eventOnDay(ev: EventDoc, ymd: string): boolean {
  if (!ev.startAt) return false
  const start = ev.startAt.toMillis()
  if (ev.repeat !== 'none') {
    const sd = ev.startAt.toDate()
    if (ymd < toYmd(sd)) return false
    const day = fromYmd(ymd)
    if (ev.repeat === 'daily') return true
    if (ev.repeat === 'weekly') return day.getDay() === sd.getDay()
    return day.getDate() === sd.getDate()
  }
  const end = ev.endAt?.toMillis() ?? start
  const a = fromYmd(ymd).getTime()
  const b = a + 24 * 60 * 60 * 1000 - 1
  if (ev.allDay) return toYmd(new Date(start)) === ymd
  return start <= b && end >= a
}

export interface Occurrence { ev: EventDoc; ymd: string; start: Date; end: Date | null; allDay: boolean }

export function occurrenceOn(ev: EventDoc, ymd: string): Occurrence {
  const s0 = ev.startAt!.toDate()
  if (ev.repeat === 'none') return { ev, ymd, start: s0, end: ev.endAt ? ev.endAt.toDate() : null, allDay: ev.allDay }
  const start = ev.allDay ? fromYmd(ymd) : combine(ymd, hmOf(s0))
  const end = ev.endAt && !ev.allDay ? new Date(start.getTime() + (ev.endAt.toMillis() - s0.getTime())) : null
  return { ev, ymd, start, end, allDay: ev.allDay }
}

export function occurrencesOnDay(events: EventDoc[], ymd: string): Occurrence[] {
  return events
    .filter((e) => eventOnDay(e, ymd))
    .map((e) => occurrenceOn(e, ymd))
    .sort((a, b) => (a.allDay === b.allDay ? a.start.getTime() - b.start.getTime() : a.allDay ? -1 : 1))
}

/** First occurrence on or after `from`'s day (recurring events scan up to a year ahead). */
export function nextOccurrence(ev: EventDoc, from = new Date()): Occurrence | null {
  if (!ev.startAt) return null
  const dayStart = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  if (ev.repeat === 'none') {
    const endMs = ev.endAt?.toMillis() ?? ev.startAt.toMillis()
    return endMs >= dayStart.getTime() ? occurrenceOn(ev, toYmd(ev.startAt.toDate())) : null
  }
  const d = new Date(Math.max(dayStart.getTime(), fromYmd(toYmd(ev.startAt.toDate())).getTime()))
  for (let i = 0; i < 400; i++) {
    const ymd = toYmd(d)
    if (eventOnDay(ev, ymd)) return occurrenceOn(ev, ymd)
    d.setDate(d.getDate() + 1)
  }
  return null
}

export function occurrencesBetween(events: EventDoc[], fromYmd0: string, days: number): Occurrence[] {
  const out: Occurrence[] = []
  const d = fromYmd(fromYmd0)
  for (let i = 0; i < days; i++) {
    out.push(...occurrencesOnDay(events, toYmd(d)))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export function formatOccWhen(o: Occurrence): string {
  return formatWhenFromDates(o.start, o.end, o.allDay)
}

export function formatWhenFromDates(start: Date, end: Date | null, allDay: boolean): string {
  const loc = dateLocale()
  const day = start.toLocaleDateString(loc, { weekday: 'short', month: 'short', day: 'numeric' })
  if (allDay) return `${day} · ${t('cal.allDay')}`
  const time = start.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
  if (!end) return `${day} · ${time}`
  const endTime = end.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}–${endTime}`
}

export function formatEventWhen(ev: EventDoc): string {
  if (!ev.startAt) return ''
  return formatWhenFromDates(ev.startAt.toDate(), ev.endAt ? ev.endAt.toDate() : null, ev.allDay)
}

export function upcoming(events: EventDoc[], from = new Date(), limit = 5): Occurrence[] {
  return events
    .map((e) => nextOccurrence(e, from))
    .filter((o): o is Occurrence => !!o)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, limit)
}

export function useEventsFor(uid: string | undefined) {
  const [events, setEvents] = useState<EventDoc[]>([])
  useEffect(() => {
    if (!uid) { setEvents([]); return }
    const qy = query(
      collection(db, ...fsCol('events')),
      where('memberIds', 'array-contains', uid),
      orderBy('startAt', 'asc'),
    )
    return onSnapshot(qy, (snap) => {
      setEvents(snap.docs.map((d) => asEvent(d.id, d.data())))
    })
  }, [uid])
  return events
}

export function useRsvps(eventId: string | undefined) {
  const [map, setMap] = useState<Record<string, RsvpStatus>>({})
  useEffect(() => {
    if (!eventId) { setMap({}); return }
    return onSnapshot(collection(db, ...fsCol('events', eventId, 'rsvp')), (snap) => {
      const next: Record<string, RsvpStatus> = {}
      for (const d of snap.docs) {
        const s = d.data().status
        if (s === 'going' || s === 'maybe' || s === 'no') next[d.id] = s
      }
      setMap(next)
    })
  }, [eventId])
  return map
}

export async function createEvent(input: {
  title: string
  note: string
  color: string
  allDay: boolean
  start: Date
  end: Date | null
  ownerId: string
  chatId?: string | null
  memberIds: string[]
  category?: string
  location?: string
  repeat?: Repeat
  reminder?: number
}): Promise<EventDoc> {
  const payload = {
    title: input.title.trim(),
    note: input.note.trim(),
    color: input.color,
    allDay: input.allDay,
    startAt: input.start,
    endAt: input.end,
    ownerId: input.ownerId,
    chatId: input.chatId ?? null,
    memberIds: input.memberIds,
    category: input.category ?? 'personal',
    location: (input.location ?? '').trim(),
    repeat: input.repeat ?? 'none',
    reminder: input.reminder ?? 10,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, ...fsCol('events')), payload)
  if (input.chatId) {
    await setDoc(doc(db, ...fsCol('events', ref.id, 'rsvp', input.ownerId)), {
      status: 'going',
      updatedAt: serverTimestamp(),
    })
  }
  return {
    id: ref.id,
    title: payload.title,
    note: payload.note,
    color: payload.color,
    allDay: payload.allDay,
    startAt: null,
    endAt: null,
    ownerId: input.ownerId,
    chatId: input.chatId ?? null,
    memberIds: input.memberIds,
    category: payload.category,
    location: payload.location,
    repeat: payload.repeat,
    reminder: payload.reminder,
    createdAt: null,
    updatedAt: null,
  }
}

export async function patchEvent(id: string, patch: Record<string, unknown>) {
  await updateDoc(doc(db, ...fsCol('events', id)), { ...patch, updatedAt: serverTimestamp() })
}

export async function removeEvent(id: string) {
  await deleteDoc(doc(db, ...fsCol('events', id)))
}

export async function setRsvp(eventId: string, uid: string, status: RsvpStatus) {
  await setDoc(doc(db, ...fsCol('events', eventId, 'rsvp', uid)), { status, updatedAt: serverTimestamp() })
}


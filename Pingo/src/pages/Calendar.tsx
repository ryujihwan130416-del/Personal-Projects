import { tx } from '../i18n'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EventForm } from '../components/EventForm'
import { RsvpBar, RsvpCounts } from '../components/EventBits'
import { IconBack, IconClose } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { dateLocale, useT } from '../i18n'
import { useFluidRef } from '../lib/fluid'
import {
  CATEGORIES,
  asEvent,
  combine,
  createEvent,
  formatEventWhen,
  fromYmd,
  nextOccurrence,
  occurrenceOn,
  occurrencesBetween,
  occurrencesOnDay,
  removeEvent,
  startOfMonth,
  toYmd,
  useEventsFor,
  useRsvps,
  type Occurrence,
} from '../lib/events'
import type { EventDoc } from '../types'

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
type View = 'month' | 'week' | 'agenda'

const loc = () => dateLocale()

function monthCells(cursor: Date): Date[] {
  const first = startOfMonth(cursor)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const weeks = Math.ceil((first.getDay() + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function weekCells(ymd: string): Date[] {
  const d = fromYmd(ymd)
  d.setDate(d.getDate() - d.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return x
  })
}

function monthTitle(cursor: Date): string {
  return cursor.toLocaleDateString(loc(), { month: 'long', year: 'numeric' })
}

function dayLabel(ymd: string): string {
  return fromYmd(ymd).toLocaleDateString(loc(), { weekday: 'long', month: 'short', day: 'numeric' })
}

function timeLabel(o: Occurrence, allDay: string): string {
  return o.allDay ? allDay : o.start.toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' })
}

function EventRow({ occ, uid, showDate, onEdit }: { occ: Occurrence; uid: string; showDate?: boolean; onEdit: (ev: EventDoc) => void }) {
  const t = useT()
  const toast = useToast()
  const { ev } = occ
  const mine = ev.ownerId === uid
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    if (!confirm) return
    const id = window.setTimeout(() => setConfirm(false), 3000)
    return () => window.clearTimeout(id)
  }, [confirm])
  const del = async () => {
    if (!confirm) { setConfirm(true); return }
    try { await removeEvent(ev.id); toast(t('cal.deleted')) } catch (err) { toast(err instanceof Error ? err.message : t('cal.saveFailed')) }
  }
  const cat = CATEGORIES.find((c) => c.id === ev.category)
  return (
    <div className="ev-row" style={{ borderLeftColor: ev.color }} data-testid={`event-row-wrap-${ev.id}`}>
      <Link to={`/event/${ev.id}`} className="ev-main" data-testid={`event-row-${ev.id}`}>
        <span className="ev-time">{showDate ? occ.start.toLocaleDateString(loc(), { month: 'short', day: 'numeric' }) + ' · ' : ''}{timeLabel(occ, t('cal.allDay'))}</span>
        <span className="ev-title">{ev.title}{ev.repeat !== 'none' ? <em title={t(`cal.repeatOpt.${ev.repeat}`)}> ↻</em> : null}</span>
        <span className="ev-sub">
          {ev.location ? <span>📍 {ev.location}</span> : null}
          {cat ? <span>{t(`cal.cat.${cat.id}`)}</span> : null}
          {ev.chatId ? <span>{t('cal.shared')}</span> : null}
        </span>
      </Link>
      {ev.chatId ? <RsvpCounts eventId={ev.id} /> : null}
      {mine ? (
        <span className="ev-actions">
          <button type="button" className="mini-btn" data-testid={`event-row-edit-${ev.id}`} aria-label={t('cal.edit')} title={t('cal.edit')} onClick={() => onEdit(ev)}>✎</button>
          <button type="button" className={`mini-btn ${confirm ? 'danger' : ''}`} data-testid={`event-row-del-${ev.id}`} aria-label={t('common.delete')} title={t('common.delete')} onClick={() => void del()}>{confirm ? t('cal.sure') : '🗑'}</button>
        </span>
      ) : null}
    </div>
  )
}

function QuickAdd({ day, uid }: { day: string; uid: string }) {
  const t = useT()
  const toast = useToast()
  const [text, setText] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    let title = text.trim()
    if (!title) return
    setText('') // clear right away so typing the next one never waits on the network
    // "15:30 Lunch", "3pm Lunch" or "3:30pm Lunch" => timed event; otherwise all-day.
    let start = fromYmd(day)
    let allDay = true
    let end: Date | null = null
    const m = title.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+)$/i)
    if (m && (m[2] || m[3] || Number(m[1]) > 12)) {
      let h = Number(m[1])
      const mi = Number(m[2] ?? 0)
      if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
      if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0
      if (h < 24 && mi < 60) {
        start = combine(day, `${h}:${String(mi).padStart(2, '0')}`)
        end = new Date(start.getTime() + 3600000)
        allDay = false
        title = m[4]
      }
    }
    try {
      await createEvent({
        title: title.slice(0, 80), note: '', color: CATEGORIES[0].color, category: 'personal', reminder: allDay ? -1 : 10,
        allDay, start, end, ownerId: uid, chatId: null, memberIds: [uid],
      })
      toast(t('cal.created'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('cal.saveFailed'))
    }
  }
  return (
    <form className="quick-add" onSubmit={(e) => void submit(e)}>
      <input className="input" data-testid="quick-add" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} placeholder={t('cal.quickAdd', { day: fromYmd(day).toLocaleDateString(loc(), { month: 'short', day: 'numeric' }) })} />
      <button className="btn btn-lime" type="submit" disabled={!text.trim()} data-testid="quick-add-btn">+</button>
    </form>
  )
}

export function CalendarPage() {
  const { user } = useAuth()
  const t = useT()
  const todayYmd = toYmd(new Date())
  const [view, setView] = useState<View>('month')
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selected, setSelected] = useState(todayYmd)
  const [sheet, setSheet] = useState<{ event?: EventDoc; date?: string } | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')
  const events = useEventsFor(user?.uid)
  const uid = user?.uid ?? ''

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return events.filter((e) =>
      (cat === 'all' || e.category === cat) &&
      (!needle || `${e.title} ${e.location} ${e.note}`.toLowerCase().includes(needle)))
  }, [events, q, cat])

  const cells = useMemo(() => monthCells(cursor), [cursor])
  const week = useMemo(() => weekCells(selected), [selected])
  const dayOccs = useMemo(() => occurrencesOnDay(filtered, selected), [filtered, selected])
  const agendaOccs = useMemo(() => view === 'agenda' ? occurrencesBetween(filtered, todayYmd, 60).slice(0, 120) : [], [filtered, view, todayYmd])
  const searching = q.trim().length > 0
  const results = useMemo(() => {
    if (!searching) return []
    return filtered
      .map((e) => (e.startAt ? (nextOccurrence(e) ?? occurrenceOn(e, toYmd(e.startAt.toDate()))) : null))
      .filter((o): o is Occurrence => !!o)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 50)
  }, [filtered, searching])

  const dotsFor = (key: string) => occurrencesOnDay(filtered, key)

  const selectDay = (ymd: string) => {
    setSelected(ymd)
    const d = fromYmd(ymd)
    if (view === 'month' && (d.getMonth() !== cursor.getMonth() || d.getFullYear() !== cursor.getFullYear())) setCursor(startOfMonth(d))
  }
  const shift = (n: number) => {
    if (view === 'week') {
      const d = fromYmd(selected)
      d.setDate(d.getDate() + n * 7)
      setSelected(toYmd(d))
      setCursor(startOfMonth(d))
    } else {
      const d = new Date(cursor)
      d.setMonth(d.getMonth() + n)
      setCursor(startOfMonth(d))
    }
  }
  const goToday = () => { setSelected(todayYmd); setCursor(startOfMonth(new Date())) }
  const title = view === 'agenda' ? t('cal.next60')
    : view === 'week' ? `${week[0].toLocaleDateString(loc(), { month: 'short', day: 'numeric' })} – ${week[6].toLocaleDateString(loc(), { month: 'short', day: 'numeric', year: 'numeric' })}`
      : monthTitle(cursor)

  const bodyRef = useFluidRef<HTMLDivElement>()

  const dayPanel = (
    <div className="agenda" data-testid="agenda">
      <div className="agenda-head">
        <h3 className="section" data-testid="agenda-day">{dayLabel(selected)}</h3>
        <button type="button" className="mini-btn wide" data-testid="agenda-add" onClick={() => setSheet({ date: selected })}>{t('cal.addDetailed')}</button>
      </div>
      {uid ? <QuickAdd day={selected} uid={uid} /> : null}
      {dayOccs.length === 0 ? <p className="agenda-empty">{t('cal.noEvents')}</p> : null}
      {dayOccs.map((o) => <EventRow key={o.ev.id + o.ymd} occ={o} uid={uid} onEdit={(ev) => setSheet({ event: ev })} />)}
    </div>
  )

  return (
    <div className="screen calendar-screen" data-testid="calendar-screen">
      <div className="topbar">
        <h1>{t('cal.titlePage')}</h1>
        <button className="btn btn-primary" type="button" style={{ width: 'auto', padding: '8px 14px' }} data-testid="new-event-btn" onClick={() => setSheet({ date: selected })}>
          {t('cal.new')}
        </button>
      </div>
      <div className="cal-body" ref={bodyRef}>
        <div className="cal-bar">
          {view !== 'agenda' ? (
            <div className="cal-nav">
              <button type="button" className="icon-btn" data-testid="cal-prev" aria-label={t('cal.prevMonth')} onClick={() => shift(-1)}>‹</button>
              <h2 data-testid="cal-month">{title}</h2>
              <button type="button" className="icon-btn" data-testid="cal-next" aria-label={t('cal.nextMonth')} onClick={() => shift(1)}>›</button>
            </div>
          ) : <h2 className="cal-nav-title" data-testid="cal-month">{title}</h2>}
          <button type="button" className="mini-btn wide" data-testid="cal-today" onClick={goToday}>{t('cal.today')}</button>
          <div className="seg" role="tablist" aria-label={tx("View")}>
            {(['month', 'week', 'agenda'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} data-testid={`cal-view-${v}`} onClick={() => setView(v)}>{t(`cal.view.${v}`)}</button>
            ))}
          </div>
        </div>
        <div className="cal-filters">
          <input className="input cal-search" data-testid="cal-search" type="search" placeholder={t('cal.search')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips">
            <button type="button" className={`cat-chip ${cat === 'all' ? 'on' : ''}`} data-testid="cal-cat-all" onClick={() => setCat('all')}>{t('cal.all')}</button>
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={`cat-chip ${cat === c.id ? 'on' : ''}`} data-testid={`cal-cat-${c.id}`} onClick={() => setCat(cat === c.id ? 'all' : c.id)}>
                <i style={{ background: c.color }} />{t(`cal.cat.${c.id}`)}
              </button>
            ))}
          </div>
        </div>
        {searching ? (
          <div className="agenda" data-testid="cal-results">
            <h3 className="section">{t('cal.results', { n: results.length })}</h3>
            {results.length === 0 ? <p className="agenda-empty">{t('cal.noResults')}</p> : null}
            {results.map((o) => <EventRow key={o.ev.id} occ={o} uid={uid} showDate onEdit={(ev) => setSheet({ event: ev })} />)}
          </div>
        ) : view === 'agenda' ? (
          <div className="agenda" data-testid="cal-agenda-list">
            {agendaOccs.length === 0 ? <p className="agenda-empty">{t('cal.noEvents')}</p> : null}
            {agendaOccs.map((o, i) => (
              <div key={o.ev.id + o.ymd}>
                {i === 0 || agendaOccs[i - 1].ymd !== o.ymd ? <h3 className="section day-head">{dayLabel(o.ymd)}</h3> : null}
                <EventRow occ={o} uid={uid} onEdit={(ev) => setSheet({ event: ev })} />
              </div>
            ))}
          </div>
        ) : (
          <div className="cal-main">
            <div className="cal-card">
              {view === 'month' ? (
                <>
                  <div className="cal-dow">{DOW.map((d) => <span key={d}>{t(`cal.dow.${d}`)}</span>)}</div>
                  <div className="cal-grid">
                    {cells.map((d) => {
                      const key = toYmd(d)
                      const inMonth = d.getMonth() === cursor.getMonth()
                      const dots = dotsFor(key)
                      return (
                        <button
                          key={key}
                          type="button"
                          className={`cal-cell ${inMonth ? '' : 'muted'} ${key === todayYmd ? 'today' : ''} ${key === selected ? 'selected' : ''}`}
                          data-testid={`cal-day-${key}`}
                          aria-label={`${dayLabel(key)}${dots.length ? `, ${dots.length}` : ''}`}
                          onClick={() => selectDay(key)}
                          onDoubleClick={() => setSheet({ date: key })}
                        >
                          <span className="cal-num">{d.getDate()}</span>
                          <span className="cal-dots">
                            {dots.slice(0, 3).map((o) => <i key={o.ev.id} style={{ background: o.ev.color }} />)}
                            {dots.length > 3 ? <b>+</b> : null}
                          </span>
                          <span className="cal-titles">
                            {dots.slice(0, 2).map((o) => <em key={o.ev.id} style={{ background: o.ev.color + '33', borderLeftColor: o.ev.color }}>{o.ev.title}</em>)}
                            {dots.length > 2 ? <small>+{dots.length - 2}</small> : null}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="week-list" data-testid="cal-week">
                  {week.map((d) => {
                    const key = toYmd(d)
                    const occs = dotsFor(key)
                    return (
                      <button key={key} type="button" className={`week-row ${key === selected ? 'selected' : ''} ${key === todayYmd ? 'today' : ''}`} data-testid={`cal-day-${key}`} onClick={() => selectDay(key)} onDoubleClick={() => setSheet({ date: key })}>
                        <span className="wk-date"><small>{t(`cal.dow.${DOW[d.getDay()]}`)}</small><b>{d.getDate()}</b></span>
                        <span className="wk-events">
                          {occs.length === 0 ? <span className="wk-none">—</span> : null}
                          {occs.slice(0, 3).map((o) => <span key={o.ev.id} className="wk-pill" style={{ borderColor: o.ev.color }}><i style={{ background: o.ev.color }} />{o.ev.title}</span>)}
                          {occs.length > 3 ? <span className="wk-pill more">+{occs.length - 3}</span> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            {dayPanel}
          </div>
        )}
      </div>
      {sheet && user ? (
        <div className="backdrop center" onClick={() => setSheet(null)}>
          <div className="sheet cal-sheet" onClick={(e) => e.stopPropagation()} data-testid="event-sheet">
            <div className="sheet-head">
              <h3>{sheet.event ? t('cal.edit') : t('cal.new')}</h3>
              <button type="button" className="icon-btn" onClick={() => setSheet(null)} aria-label={t('common.close')}><IconClose /></button>
            </div>
            <EventForm
              event={sheet.event}
              defaultDate={sheet.date ?? selected}
              memberIds={sheet.event ? sheet.event.memberIds : [user.uid]}
              chatId={sheet.event?.chatId}
              onCancel={() => setSheet(null)}
              onSaved={() => setSheet(null)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const t = useT()
  const toast = useToast()
  const [event, setEvent] = useState<EventDoc | null>(null)
  const [missing, setMissing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const rsvps = useRsvps(eventId)

  useEffect(() => {
    if (!eventId) return
    return onSnapshot(doc(db, ...fsCol('events', eventId)), (s) => {
      if (!s.exists()) { setMissing(true); setEvent(null); return }
      setEvent(asEvent(s.id, s.data()))
    })
  }, [eventId])

  if (missing) {
    return (
      <div className="screen" data-testid="event-missing">
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
          <h2>{t('cal.titlePage')}</h2>
        </div>
        <div className="empty"><h3>{t('cal.notFound')}</h3></div>
      </div>
    )
  }
  if (!event || !user) {
    return <div className="screen"><div className="topbar"><div className="skeleton" style={{ width: 120, height: 22 }} /></div><div className="skeleton" style={{ margin: 16, height: 120, borderRadius: 16 }} /></div>
  }

  const mine = event.ownerId === user.uid
  const vals = Object.values(rsvps)
  const count = (s: string) => vals.filter((v) => v === s).length

  const del = async () => {
    if (!confirmDel) { setConfirmDel(true); window.setTimeout(() => setConfirmDel(false), 3000); return }
    await removeEvent(event.id)
    toast(t('cal.deleted'))
    nav('/calendar')
  }

  const rem = event.reminder < 0 ? t('cal.reminderOpt.none') : t(`cal.reminderOpt.${event.reminder}`)

  return (
    <div className="screen" data-testid="event-detail-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')} data-testid="event-back"><IconBack /></button>
        <h2>{t('cal.event')}</h2>
      </div>
      <div className="event-detail">
        <div className="event-hero" style={{ boxShadow: `3px 3px 0 ${event.color}` }}>
          <span className="event-dot lg" style={{ background: event.color }} />
          <h2 data-testid="event-detail-title">{event.title}</h2>
          <p>{formatEventWhen(event)}{event.repeat !== 'none' ? ` · ↻ ${t(`cal.repeatOpt.${event.repeat}`)}` : ''}</p>
          {event.location ? <p>📍 {event.location}</p> : null}
          <p className="shared-tag">{event.chatId ? t('cal.shared') : t('cal.personal')} · {t(`cal.cat.${event.category}`)} · ⏰ {rem}</p>
        </div>
        {event.note ? <p className="event-note">{event.note}</p> : null}
        {event.chatId ? (
          <>
            <h3 className="section">{t('cal.rsvpTitle')} · <span className="rsvp-counts"><b>✓{count('going')}</b><span>?{count('maybe')}</span><span>✕{count('no')}</span></span></h3>
            <RsvpBar eventId={event.id} uid={user.uid} />
          </>
        ) : null}
        {mine && !editing ? (
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="btn btn-ghost" type="button" data-testid="event-edit" onClick={() => setEditing(true)}>{t('cal.edit')}</button>
            <button className="btn btn-ghost danger" type="button" data-testid="event-delete" onClick={() => void del()}>{confirmDel ? t('cal.sure') : t('common.delete')}</button>
          </div>
        ) : null}
        {mine && editing ? (
          <EventForm
            event={event}
            memberIds={event.memberIds}
            chatId={event.chatId}
            onCancel={() => setEditing(false)}
            onSaved={() => setEditing(false)}
          />
        ) : null}
      </div>
    </div>
  )
}

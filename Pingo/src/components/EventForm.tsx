import { useState, type FormEvent } from 'react'
import { useToast } from './Toast'
import { useAuth } from '../contexts/AuthContext'
import { useT } from '../i18n'
import {
  CATEGORIES,
  EVENT_COLORS,
  REMINDERS,
  REPEATS,
  combine,
  createEvent,
  formatWhenFromDates,
  fromYmd,
  hmOf,
  patchEvent,
  toYmd,
  type Repeat,
} from '../lib/events'
import type { EventDoc } from '../types'

export function EventForm({
  event,
  defaultDate,
  chatId,
  memberIds,
  onSaved,
  onCancel,
}: {
  event?: EventDoc | null
  defaultDate?: string
  chatId?: string | null
  memberIds: string[]
  onSaved?: (id: string, title: string, when: string) => void
  onCancel?: () => void
}) {
  const { user } = useAuth()
  const t = useT()
  const toast = useToast()
  const start = event?.startAt?.toDate()
  const [title, setTitle] = useState(event?.title ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [category, setCategory] = useState(event?.category ?? 'personal')
  const [repeat, setRepeat] = useState<Repeat>(event?.repeat ?? 'none')
  const [reminder, setReminder] = useState<number>(event?.reminder ?? 10)
  const [date, setDate] = useState(start ? toYmd(start) : (defaultDate ?? toYmd(new Date())))
  const [allDay, setAllDay] = useState(event?.allDay ?? false)
  const [startHm, setStartHm] = useState(start && !event?.allDay ? hmOf(start) : '15:00')
  const [endHm, setEndHm] = useState(event?.endAt && !event.allDay ? hmOf(event.endAt.toDate()) : '16:00')
  const [color, setColor] = useState(event?.color ?? CATEGORIES[0].color)
  const [busy, setBusy] = useState(false)

  const pickCategory = (id: string, c: string) => {
    setCategory(id)
    if (!event) setColor(c)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const name = title.trim()
    if (!name) { toast(t('cal.needTitle')); return }
    const startDate = allDay ? fromYmd(date) : combine(date, startHm)
    let endDate: Date | null = null
    if (!allDay && endHm) {
      endDate = combine(date, endHm)
      if (endDate.getTime() <= startDate.getTime()) endDate = new Date(startDate.getTime() + 60 * 60 * 1000)
    }
    setBusy(true)
    try {
      if (event) {
        await patchEvent(event.id, {
          title: name,
          note: note.trim(),
          location: location.trim(),
          category,
          repeat,
          reminder,
          color,
          allDay,
          startAt: startDate,
          endAt: endDate,
        })
        toast(t('cal.saved'))
        onSaved?.(event.id, name, formatWhenFromDates(startDate, endDate, allDay))
      } else {
        const created = await createEvent({
          title: name,
          note: note.trim(),
          location,
          category,
          repeat,
          reminder,
          color,
          allDay,
          start: startDate,
          end: endDate,
          ownerId: user.uid,
          chatId: chatId ?? null,
          memberIds,
        })
        toast(t('cal.created'))
        onSaved?.(created.id, name, formatWhenFromDates(startDate, endDate, allDay))
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('cal.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="event-form" onSubmit={(e) => void submit(e)} data-testid="event-form">
      <label>
        {t('cal.title')}
        <input className="input" data-testid="event-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required />
      </label>
      <div className="time-row">
        <label>
          {t('cal.date')}
          <input className="input" type="date" data-testid="event-date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="check-row" style={{ alignSelf: 'end', paddingBottom: 12 }}>
          <input type="checkbox" data-testid="event-allday" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          {t('cal.allDay')}
        </label>
      </div>
      {!allDay ? (
        <div className="time-row">
          <label>
            {t('cal.start')}
            <input className="input" type="time" data-testid="event-start" value={startHm} onChange={(e) => setStartHm(e.target.value)} />
          </label>
          <label>
            {t('cal.end')}
            <input className="input" type="time" data-testid="event-end" value={endHm} onChange={(e) => setEndHm(e.target.value)} />
          </label>
        </div>
      ) : null}
      <label>
        {t('cal.location')}
        <input className="input" data-testid="event-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder={t('cal.locationHint')} />
      </label>
      <div className="time-row">
        <label>
          {t('cal.repeat')}
          <select className="input" data-testid="event-repeat" value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
            {REPEATS.map((r) => <option key={r} value={r}>{t(`cal.repeatOpt.${r}`)}</option>)}
          </select>
        </label>
        <label>
          {t('cal.reminder')}
          <select className="input" data-testid="event-reminder" value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
            {REMINDERS.map((r) => <option key={r} value={r}>{t(`cal.reminderOpt.${r < 0 ? 'none' : r}`)}</option>)}
          </select>
        </label>
      </div>
      <div className="cat-row" role="radiogroup" aria-label={t('cal.category')}>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cat-chip ${category === c.id ? 'on' : ''}`}
            data-testid={`event-cat-${c.id}`}
            aria-pressed={category === c.id}
            onClick={() => pickCategory(c.id, c.color)}
          >
            <i style={{ background: c.color }} />{t(`cal.cat.${c.id}`)}
          </button>
        ))}
      </div>
      <div className="color-row" role="radiogroup" aria-label={t('cal.color')}>
        {EVENT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-dot ${color === c ? 'on' : ''}`}
            style={{ background: c }}
            data-testid={`event-color-${c}`}
            aria-label={c}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <label>
        {t('cal.note')}
        <textarea className="textarea input" data-testid="event-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </label>
      <div className="form-actions">
        {onCancel ? <button className="btn btn-ghost" type="button" onClick={onCancel}>{t('common.cancel')}</button> : null}
        <button className="btn btn-primary" type="submit" disabled={busy} data-testid="event-save">{t('common.save')}</button>
      </div>
    </form>
  )
}

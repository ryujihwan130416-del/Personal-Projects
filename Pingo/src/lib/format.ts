import { dateLocale, t } from '../i18n'

const loc = dateLocale

export function formatTime(ms: number | null | undefined): string {
  if (!ms) return ''
  const d = new Date(ms)
  return d.toLocaleTimeString(loc(), { hour: 'numeric', minute: '2-digit' })
}

export function formatShortDate(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString(loc(), { month: 'long', day: 'numeric' })
}

export function formatListTime(ms: number | null | undefined): string {
  if (!ms) return ''
  const now = Date.now()
  const diff = Math.max(0, now - ms)
  const min = Math.floor(diff / 60000)
  if (min < 1) return t('time.justNow')
  if (min < 60) return t('time.minutes', { n: min })
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return t('time.hours', { n: hrs })
  const days = Math.floor(hrs / 24)
  if (days === 1) return t('time.yesterday')
  if (days < 7) return t('time.days', { n: days })
  return new Date(ms).toLocaleDateString(loc(), { month: 'numeric', day: 'numeric' })
}

export function formatLastActive(ms: number | null | undefined): string {
  if (!ms) return t('time.offline')
  const diff = Date.now() - ms
  if (diff < 2 * 60 * 1000) return t('time.activeJustNow')
  const min = Math.floor(diff / 60000)
  if (min < 60) return t('time.activeMinutes', { n: min })
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return t('time.activeHours', { n: hrs })
  const days = Math.floor(hrs / 24)
  return t('time.activeDays', { n: days })
}

export function formatDateDivider(ms: number): string {
  const d = new Date(ms)
  const today = new Date()
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  if (sameDay(d, today)) return t('time.today')
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (sameDay(d, yest)) return t('time.yesterday')
  return d.toLocaleDateString(loc(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

export function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

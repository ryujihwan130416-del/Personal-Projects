export function parseIsoDuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!match) return 0
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
  return hours * 3600 + minutes * 60 + seconds
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  const total = Math.round(sec)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatCount(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (!Number.isFinite(abs) || abs < 1000) return `${sign}${Math.round(abs || 0)}`
  const units = ['K', 'M', 'B']
  let scaled = abs
  let unit = ''
  for (const next of units) {
    if (scaled < 1000) break
    scaled /= 1000
    unit = next
  }
  const digits = scaled >= 10 || Math.abs(scaled - Math.round(scaled)) < 0.05 ? 0 : 1
  let text = scaled.toFixed(digits)
  if (text === '1000') {
    const order = units.indexOf(unit)
    text = '1'
    unit = units[Math.min(order + 1, units.length - 1)] ?? unit
  }
  return `${sign}${text.replace(/\.0$/, '')}${unit}`
}

export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = then - now.getTime()
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), 'second')
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 86_400_000 * 30) return rtf.format(Math.round(diff / 86_400_000), 'day')
  if (abs < 86_400_000 * 365) return rtf.format(Math.round(diff / (86_400_000 * 30)), 'month')
  return rtf.format(Math.round(diff / (86_400_000 * 365)), 'year')
}

export function isVideoId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id)
}

export function safeThumbnail(videoId: string, url: string): string {
  if (!isVideoId(videoId)) return ''
  if (/^https:\/\/(i\.ytimg\.com|i9\.ytimg\.com|yt3\.ggpht\.com)\//.test(url)) return url
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function safeYouTubeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    if (parsed.protocol === 'https:' && (host === 'www.youtube.com' || host === 'youtube.com' || host === 'youtu.be')) {
      return parsed.toString()
    }
  } catch {
    /* Ignore malformed URLs from unexpected payloads. */
  }
  return 'https://www.youtube.com'
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

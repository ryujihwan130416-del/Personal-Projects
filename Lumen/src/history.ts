export const RECOMMEND_AFTER = 3

const COUNT_KEY = 'lumen.searchCount'
const HISTORY_KEY = 'lumen.searchHistory'

export function nextHistory(history: string[], query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return history
  return [trimmed, ...history.filter((item) => item.trim().toLowerCase() !== trimmed.toLowerCase())].slice(0, 6)
}

export function recommendationQuery(history: string[], current: string): string | null {
  const normal = (value: string) => value.trim().toLowerCase()
  const cleaned = history.map((item) => item.trim()).filter(Boolean)
  const other = cleaned.find((item) => normal(item) !== normal(current))
  if (other) return other
  if (cleaned[0]) return cleaned[0]
  return current.trim() || null
}

export function readSearchCount(): number {
  try {
    const count = Number(localStorage.getItem(COUNT_KEY) || '0')
    return Number.isFinite(count) && count > 0 ? count : 0
  } catch {
    return 0
  }
}

export function readSearchHistory(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  } catch {
    return []
  }
}

export function rememberSearch(query: string): { count: number; history: string[] } {
  const trimmed = query.trim()
  const history = nextHistory(readSearchHistory(), trimmed)
  const count = readSearchCount() + (trimmed ? 1 : 0)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    localStorage.setItem(COUNT_KEY, String(count))
  } catch {
    /* The count still updates in memory for this session. */
  }
  return { count, history }
}

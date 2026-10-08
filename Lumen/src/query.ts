import { categoryName, languageName, regionName } from './options'
import type {
  Caption,
  CategoryOption,
  Chip,
  Definition,
  Dimension,
  Duration,
  EventType,
  Filters,
  License,
  Order,
  SafeSearch,
  Window,
} from './types'

export const DEFAULT_FILTERS: Filters = {
  q: '',
  order: 'relevance',
  videoDuration: 'any',
  publishedWithin: 'any',
  videoDefinition: 'any',
  videoCaption: 'any',
  videoLicense: 'any',
  videoDimension: 'any',
  safeSearch: 'moderate',
  eventType: 'any',
  videoCategoryId: '',
  regionCode: '',
  relevanceLanguage: '',
  videoEmbeddable: false,
  channelId: '',
  keywordOnly: false,
  maxResults: 12,
}

const ORDER_LABEL: Record<Order, string> = {
  relevance: 'Relevance',
  date: 'Newest',
  viewCount: 'Most viewed',
  rating: 'Top rated',
  title: 'Title',
}

const DURATION_LABEL: Record<Duration, string> = {
  any: 'Any length',
  short: 'Under 4 min',
  medium: '4–20 min',
  long: 'Over 20 min',
}

const WINDOW_LABEL: Record<Window, string> = {
  any: 'Any time',
  hour: 'Past hour',
  day: 'Today',
  week: 'This week',
  month: 'This month',
  year: 'This year',
}

const DEFINITION_LABEL: Record<Definition, string> = {
  any: 'Any quality',
  high: 'HD',
  standard: 'SD',
}

const CAPTION_LABEL: Record<Caption, string> = {
  any: 'Any captions',
  closedCaption: 'Captions',
  none: 'No captions',
}

const LICENSE_LABEL: Record<License, string> = {
  any: 'Any license',
  creativeCommon: 'Creative Commons',
  youtube: 'Standard license',
}

const DIMENSION_LABEL: Record<Dimension, string> = {
  any: 'Any dimension',
  '2d': '2D',
  '3d': '3D',
}

const SAFE_LABEL: Record<SafeSearch, string> = {
  none: 'Safe search off',
  moderate: 'Moderate',
  strict: 'Strict',
}

const EVENT_LABEL: Record<EventType, string> = {
  any: 'Any broadcast',
  live: 'Live',
  upcoming: 'Upcoming',
  completed: 'Replay',
}

export function eventTypeLocks(filters: Filters): boolean {
  return filters.eventType !== 'any'
}

export function hasSearchTarget(filters: Filters): boolean {
  return filters.q.trim().length > 0 || filters.channelId.trim().length > 0 || filters.eventType !== 'any'
}

export type SearchRoute = 'live' | 'sample' | 'needs-key'

/** Live YouTube is the default. The sample catalog runs only when the user opts in. */
export function searchRoute(apiKey: string, preferSample: boolean): SearchRoute {
  if (preferSample) return 'sample'
  if (apiKey.trim()) return 'live'
  return 'needs-key'
}

export function isChannelId(value: string): boolean {
  return /^UC[0-9A-Za-z_-]{22}$/.test(value.trim())
}

export function publishedAfter(within: Window, now: Date): string | null {
  const windows: Record<Window, number> = {
    any: 0,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
  }
  const span = windows[within]
  if (!span) return null
  return new Date(now.getTime() - span).toISOString()
}

export function matchesDuration(seconds: number, bucket: Duration): boolean {
  if (bucket === 'any') return true
  if (seconds <= 0) return false
  if (bucket === 'short') return seconds < 240
  if (bucket === 'medium') return seconds >= 240 && seconds <= 1200
  return seconds > 1200
}

export function matchesPublished(iso: string, within: Window, now: Date): boolean {
  const after = publishedAfter(within, now)
  if (!after) return true
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return false
  return time >= new Date(after).getTime()
}

export function buildSearchParams(filters: Filters, pageToken: string | undefined, now: Date): URLSearchParams {
  const params = new URLSearchParams()
  params.set('part', 'snippet')
  params.set('type', 'video')
  params.set('maxResults', String(clampResults(filters.maxResults)))
  params.set('order', filters.order)
  params.set('safeSearch', filters.safeSearch)

  const query = filters.q.trim()
  if (query) params.set('q', query)
  if (pageToken) params.set('pageToken', pageToken)
  if (filters.regionCode) params.set('regionCode', filters.regionCode)
  if (filters.relevanceLanguage) params.set('relevanceLanguage', filters.relevanceLanguage)

  const channel = filters.channelId.trim()
  if (isChannelId(channel)) params.set('channelId', channel)

  const after = publishedAfter(filters.publishedWithin, now)
  if (after) params.set('publishedAfter', after)

  if (eventTypeLocks(filters)) {
    params.set('eventType', filters.eventType)
    return params
  }

  if (filters.videoDuration !== 'any') params.set('videoDuration', filters.videoDuration)
  if (filters.videoDefinition !== 'any') params.set('videoDefinition', filters.videoDefinition)
  if (filters.videoCaption !== 'any') params.set('videoCaption', filters.videoCaption)
  if (filters.videoLicense !== 'any') params.set('videoLicense', filters.videoLicense)
  if (filters.videoDimension !== 'any') params.set('videoDimension', filters.videoDimension)
  if (filters.videoEmbeddable) params.set('videoEmbeddable', 'true')
  if (filters.videoCategoryId) params.set('videoCategoryId', filters.videoCategoryId)
  return params
}

export function clampResults(value: number): number {
  if (!Number.isFinite(value)) return 12
  return Math.min(50, Math.max(1, Math.round(value)))
}

export function activeChips(filters: Filters, categories: CategoryOption[] = []): Chip[] {
  const locked = eventTypeLocks(filters)
  const chips: Chip[] = []
  if (filters.order !== DEFAULT_FILTERS.order) {
    chips.push({ id: 'order', label: ORDER_LABEL[filters.order], patch: { order: 'relevance' } })
  }
  if (!locked && filters.videoDuration !== 'any') {
    chips.push({
      id: 'duration',
      label: DURATION_LABEL[filters.videoDuration],
      patch: { videoDuration: 'any' },
    })
  }
  if (filters.publishedWithin !== 'any') {
    chips.push({
      id: 'window',
      label: WINDOW_LABEL[filters.publishedWithin],
      patch: { publishedWithin: 'any' },
    })
  }
  if (!locked && filters.videoDefinition !== 'any') {
    chips.push({
      id: 'definition',
      label: DEFINITION_LABEL[filters.videoDefinition],
      patch: { videoDefinition: 'any' },
    })
  }
  if (!locked && filters.videoCaption !== 'any') {
    chips.push({
      id: 'caption',
      label: CAPTION_LABEL[filters.videoCaption],
      patch: { videoCaption: 'any' },
    })
  }
  if (!locked && filters.videoLicense !== 'any') {
    chips.push({
      id: 'license',
      label: LICENSE_LABEL[filters.videoLicense],
      patch: { videoLicense: 'any' },
    })
  }
  if (!locked && filters.videoDimension !== 'any') {
    chips.push({
      id: 'dimension',
      label: DIMENSION_LABEL[filters.videoDimension],
      patch: { videoDimension: 'any' },
    })
  }
  if (filters.safeSearch !== DEFAULT_FILTERS.safeSearch) {
    chips.push({
      id: 'safe',
      label: SAFE_LABEL[filters.safeSearch],
      patch: { safeSearch: 'moderate' },
    })
  }
  if (filters.eventType !== 'any') {
    chips.push({ id: 'event', label: EVENT_LABEL[filters.eventType], patch: { eventType: 'any' } })
  }
  if (!locked && filters.videoCategoryId) {
    chips.push({
      id: 'category',
      label: categoryName(filters.videoCategoryId, categories),
      patch: { videoCategoryId: '' },
    })
  }
  if (filters.regionCode) {
    chips.push({ id: 'region', label: regionName(filters.regionCode), patch: { regionCode: '' } })
  }
  if (filters.relevanceLanguage) {
    chips.push({
      id: 'language',
      label: languageName(filters.relevanceLanguage),
      patch: { relevanceLanguage: '' },
    })
  }
  if (!locked && filters.videoEmbeddable) {
    chips.push({ id: 'embed', label: 'Embeddable', patch: { videoEmbeddable: false } })
  }
  if (filters.channelId.trim()) {
    chips.push({ id: 'channel', label: filters.channelId.trim(), patch: { channelId: '' } })
  }
  if (filters.maxResults !== DEFAULT_FILTERS.maxResults) {
    chips.push({ id: 'size', label: `${filters.maxResults} / page`, patch: { maxResults: 12 } })
  }
  return chips
}

export { DURATION_LABEL, ORDER_LABEL }

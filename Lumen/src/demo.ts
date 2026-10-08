import { CATALOG } from './catalog'
import { categoryName } from './options'
import {
  clampResults,
  eventTypeLocks,
  matchesDuration,
  matchesPublished,
} from './query'
import type { Filters, SearchPage, VideoResult } from './types'

function haystack(video: VideoResult): string {
  return `${video.title} ${video.description} ${video.channelTitle} ${video.channelHandle} ${categoryName(video.categoryId)}`.toLowerCase()
}

function channelMatches(video: VideoResult, raw: string): boolean {
  const query = raw.trim().toLowerCase().replace(/^@/, '')
  if (!query) return true
  return (
    video.channelHandle.toLowerCase().includes(query) ||
    video.channelTitle.toLowerCase().includes(query) ||
    video.channelId.toLowerCase() === query
  )
}

export function filterCatalog(videos: VideoResult[], filters: Filters, now: Date): VideoResult[] {
  const locked = eventTypeLocks(filters)
  const terms = filters.q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)

  return videos.filter((video) => {
    if (terms.length > 0 && !terms.every((term) => haystack(video).includes(term))) return false
    if (!matchesPublished(video.publishedAt, filters.publishedWithin, now)) return false
    if (filters.eventType !== 'any' && video.liveBroadcastContent !== filters.eventType) return false
    if (!channelMatches(video, filters.channelId)) return false
    if (locked) return true
    if (!matchesDuration(video.durationSec, filters.videoDuration)) return false
    if (filters.videoDefinition === 'high' && video.definition !== 'hd') return false
    if (filters.videoDefinition === 'standard' && video.definition !== 'sd') return false
    if (filters.videoCaption === 'closedCaption' && !video.caption) return false
    if (filters.videoCaption === 'none' && video.caption) return false
    if (filters.videoLicense !== 'any' && video.license !== filters.videoLicense) return false
    if (filters.videoDimension !== 'any' && video.dimension !== filters.videoDimension) return false
    if (filters.videoEmbeddable && !video.embeddable) return false
    if (filters.videoCategoryId && video.categoryId !== filters.videoCategoryId) return false
    return true
  })
}

function bias(video: VideoResult, filters: Filters): number {
  let score = 0
  if (filters.regionCode && video.regionCode === filters.regionCode) score += 2
  if (filters.relevanceLanguage && video.language === filters.relevanceLanguage) score += 2
  return score
}

function relevance(video: VideoResult, filters: Filters): number {
  const terms = filters.q
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  const title = video.title.toLowerCase()
  const channel = `${video.channelTitle} ${video.channelHandle}`.toLowerCase()
  const description = video.description.toLowerCase()
  let score = bias(video, filters)
  for (const term of terms) {
    if (title.includes(term)) score += 6
    if (channel.includes(term)) score += 4
    if (description.includes(term)) score += 1
  }
  return score
}

function rating(video: VideoResult): number {
  if (video.likeCount == null) return -1
  return video.likeCount / Math.max(video.viewCount ?? 0, 1)
}

function compare(a: VideoResult, b: VideoResult, filters: Filters): number {
  let primary = 0
  switch (filters.order) {
    case 'date':
      primary = Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      break
    case 'viewCount':
      primary = (b.viewCount ?? -1) - (a.viewCount ?? -1)
      break
    case 'rating':
      primary = rating(b) - rating(a)
      break
    case 'title':
      primary = a.title.localeCompare(b.title, 'en', { sensitivity: 'base' })
      break
    default:
      primary = relevance(b, filters) - relevance(a, filters)
      if (primary === 0) primary = (b.viewCount ?? 0) - (a.viewCount ?? 0)
      break
  }
  if (primary !== 0) return primary
  if (filters.order !== 'relevance') {
    const tilt = bias(b, filters) - bias(a, filters)
    if (tilt !== 0) return tilt
  }
  return a.id.localeCompare(b.id)
}

export function searchDemo(filters: Filters, pageToken: string | undefined, now = new Date()): SearchPage {
  const sorted = filterCatalog(CATALOG, filters, now).sort((a, b) => compare(a, b, filters))
  const size = clampResults(filters.maxResults)
  const offset = pageToken && /^\d+$/.test(pageToken) ? Number(pageToken) : 0
  return {
    totalResults: sorted.length,
    results: sorted.slice(offset, offset + size),
    prevPageToken: offset > 0 ? String(Math.max(0, offset - size)) : undefined,
    nextPageToken: offset + size < sorted.length ? String(offset + size) : undefined,
  }
}

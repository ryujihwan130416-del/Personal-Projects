import { decodeEntities, parseIsoDuration, safeThumbnail, safeYouTubeUrl } from './format'
import { buildSearchParams, isChannelId } from './query'
import type { Broadcast, Filters, Picture, SearchPage, VideoResult } from './types'

export class YouTubeError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'YouTubeError'
    this.status = status
  }
}

const channelCache = new Map<string, string>()

export function explainError(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('quota')) {
    return `${message} Daily quota is used up — a search costs about 100 units. Switch to the sample catalog or try again tomorrow.`
  }
  if (lower.includes('api key')) {
    return `${message} Check the key, and confirm YouTube Data API v3 is enabled for its project.`
  }
  if (lower.includes('referer') || lower.includes('referrer')) {
    return `${message} Allow this site as a referrer on the key, or use an unrestricted key while developing locally.`
  }
  return message
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function count(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

function errorMessage(payload: unknown, fallback: string): string {
  const record = asRecord(payload)
  const error = asRecord(record?.error)
  const message = text(error?.message)
  return explainError(message || fallback)
}

async function getJson(url: URL, signal?: AbortSignal): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new YouTubeError('Network error. Check your connection and try again.', 0)
  }
  const payload = await readJson(response)
  if (!response.ok) throw new YouTubeError(errorMessage(payload, 'YouTube rejected the request.'), response.status)
  return payload
}

export async function resolveChannelId(apiKey: string, input: string, signal?: AbortSignal): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null
  if (isChannelId(trimmed)) return trimmed

  const handle = trimmed.replace(/^@/, '')
  const cacheKey = handle.toLowerCase()
  const cached = channelCache.get(cacheKey)
  if (cached) return cached

  const byHandle = new URL('https://www.googleapis.com/youtube/v3/channels')
  byHandle.searchParams.set('part', 'id')
  byHandle.searchParams.set('forHandle', handle)
  byHandle.searchParams.set('key', apiKey)
  try {
    const payload = await getJson(byHandle, signal)
    const id = text(asRecord(asArray(asRecord(payload)?.items)[0])?.id)
    if (id) {
      channelCache.set(cacheKey, id)
      return id
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof YouTubeError && error.status !== 400 && error.status !== 404) throw error
  }

  const byName = new URL('https://www.googleapis.com/youtube/v3/search')
  byName.searchParams.set('part', 'snippet')
  byName.searchParams.set('type', 'channel')
  byName.searchParams.set('maxResults', '1')
  byName.searchParams.set('q', handle)
  byName.searchParams.set('key', apiKey)
  const payload = await getJson(byName, signal)
  const id = text(asRecord(asRecord(asArray(asRecord(payload)?.items)[0])?.id)?.channelId)
  if (!id) return null
  channelCache.set(cacheKey, id)
  return id
}

function thumbnailOf(snippet: Record<string, unknown> | null, videoId: string): string {
  const thumbs = asRecord(snippet?.thumbnails)
  const best = asRecord(thumbs?.high) ?? asRecord(thumbs?.medium) ?? asRecord(thumbs?.default)
  return text(best?.url) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function broadcastOf(value: string): Broadcast {
  if (value === 'live' || value === 'upcoming' || value === 'completed') return value
  return 'none'
}

function pictureOf(value: string): Picture {
  if (value === 'hd' || value === 'sd') return value
  return 'unknown'
}

function mapVideo(item: unknown, detail: unknown): VideoResult | null {
  const row = asRecord(item)
  const videoId = text(asRecord(row?.id)?.videoId)
  if (!videoId) return null
  const snippet = asRecord(row?.snippet)
  const extra = asRecord(detail)
  const detailSnippet = asRecord(extra?.snippet)
  const content = asRecord(extra?.contentDetails)
  const stats = asRecord(extra?.statistics)
  const status = asRecord(extra?.status)
  const channelId = text(snippet?.channelId)
  const language = text(detailSnippet?.defaultAudioLanguage || detailSnippet?.defaultLanguage)
    .slice(0, 2)
    .toLowerCase()

  return {
    id: videoId,
    title: decodeEntities(text(snippet?.title) || 'Untitled'),
    description: decodeEntities(text(snippet?.description)),
    channelTitle: decodeEntities(text(snippet?.channelTitle)),
    channelId,
    channelHandle: '',
    channelUrl: safeYouTubeUrl(channelId ? `https://www.youtube.com/channel/${channelId}` : 'https://www.youtube.com'),
    publishedAt: text(snippet?.publishedAt),
    thumbnail: safeThumbnail(videoId, thumbnailOf(snippet, videoId)),
    durationSec: parseIsoDuration(text(content?.duration)),
    viewCount: count(stats?.viewCount),
    likeCount: count(stats?.likeCount),
    definition: pictureOf(text(content?.definition)),
    caption: text(content?.caption) === 'true',
    license: text(status?.license) === 'creativeCommon' ? 'creativeCommon' : 'youtube',
    dimension: text(content?.dimension) === '3d' ? '3d' : '2d',
    categoryId: text(detailSnippet?.categoryId),
    language,
    regionCode: '',
    liveBroadcastContent: broadcastOf(text(snippet?.liveBroadcastContent)),
    embeddable: status ? status.embeddable !== false : true,
  }
}

export async function searchYouTube(
  apiKey: string,
  filters: Filters,
  pageToken: string | undefined,
  signal?: AbortSignal,
  now = new Date(),
): Promise<SearchPage> {
  let next = filters
  const channel = filters.channelId.trim()
  if (channel && !isChannelId(channel)) {
    const resolved = await resolveChannelId(apiKey, channel, signal)
    if (!resolved) {
      throw new YouTubeError(
        `No channel found for “${channel}”. Try another name, or paste a channel ID that starts with UC.`,
        404,
      )
    }
    next = { ...filters, channelId: resolved }
  }

  const params = buildSearchParams(next, pageToken, now)
  params.set('key', apiKey)
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
  searchUrl.search = params.toString()
  const payload = asRecord(await getJson(searchUrl, signal))
  const items = asArray(payload?.items)
  const ids = items
    .map((item) => text(asRecord(asRecord(item)?.id)?.videoId))
    .filter(Boolean)

  const details = new Map<string, unknown>()
  if (ids.length > 0) {
    const detailUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    detailUrl.searchParams.set('part', 'snippet,contentDetails,statistics,status')
    detailUrl.searchParams.set('id', ids.join(','))
    detailUrl.searchParams.set('key', apiKey)
    try {
      const detailPayload = asRecord(await getJson(detailUrl, signal))
      for (const entry of asArray(detailPayload?.items)) {
        const id = text(asRecord(entry)?.id)
        if (id) details.set(id, entry)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (error instanceof YouTubeError && (error.status === 403 || error.status === 400)) throw error
    }
  }

  const pageInfo = asRecord(payload?.pageInfo)
  return {
    totalResults: count(pageInfo?.totalResults) ?? ids.length,
    nextPageToken: text(payload?.nextPageToken) || undefined,
    prevPageToken: text(payload?.prevPageToken) || undefined,
    results: items
      .map((item) => mapVideo(item, details.get(text(asRecord(asRecord(item)?.id)?.videoId))))
      .filter((video): video is VideoResult => video !== null),
  }
}

export async function fetchCategories(
  apiKey: string,
  regionCode: string,
  signal?: AbortSignal,
): Promise<{ id: string; name: string }[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videoCategories')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('regionCode', regionCode || 'US')
  url.searchParams.set('key', apiKey)
  const payload = asRecord(await getJson(url, signal))
  return asArray(payload?.items)
    .map((item) => {
      const row = asRecord(item)
      const snippet = asRecord(row?.snippet)
      if (snippet?.assignable === false) return null
      const id = text(row?.id)
      const name = text(snippet?.title)
      if (!id || !name) return null
      return { id, name }
    })
    .filter((category): category is { id: string; name: string } => category !== null)
}

import { namesMatch } from './channel'
import { filterCatalog, sortResults } from './demo'
import { decodeEntities, parseIsoDuration, safeThumbnail, safeYouTubeUrl } from './format'
import { buildSearchParams, isChannelId } from './query'
import type { Broadcast, ChannelHit, Filters, Picture, SearchPage, VideoResult } from './types'

export class YouTubeError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'YouTubeError'
    this.status = status
  }
}

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

type ResolvedChannel = ChannelHit & { id: string; uploadsId: string }

const browseCache = new Map<string, ResolvedChannel | null>()

function cacheKey(query: string): string {
  return query.trim().toLowerCase()
}

async function fetchChannel(
  apiKey: string,
  which: { id?: string; forHandle?: string },
  signal?: AbortSignal,
): Promise<ResolvedChannel | null> {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels')
  url.searchParams.set('part', 'snippet,contentDetails')
  if (which.id) url.searchParams.set('id', which.id)
  if (which.forHandle) url.searchParams.set('forHandle', which.forHandle)
  url.searchParams.set('key', apiKey)
  const payload = asRecord(await getJson(url, signal))
  const item = asRecord(asArray(payload?.items)[0])
  if (!item) return null
  const snippet = asRecord(item.snippet)
  const uploadsId = text(asRecord(asRecord(item.contentDetails)?.relatedPlaylists)?.uploads)
  const id = text(item.id)
  if (!id || !uploadsId) return null
  const handle = text(snippet?.customUrl).replace(/^@/, '')
  const title = decodeEntities(text(snippet?.title)) || handle || id
  const rawUrl = handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${id}`
  return { id, title, handle, url: safeYouTubeUrl(rawUrl), uploadsId }
}

async function lookupChannel(apiKey: string, query: string, signal?: AbortSignal): Promise<ResolvedChannel | null> {
  const trimmed = query.trim()
  const key = cacheKey(trimmed)
  if (!key) return null
  if (browseCache.has(key)) return browseCache.get(key) ?? null

  let resolved: ResolvedChannel | null = null
  if (isChannelId(trimmed)) {
    resolved = await fetchChannel(apiKey, { id: trimmed }, signal)
  } else {
    const handle = trimmed.replace(/^@+/, '').replace(/\s+/g, '')
    if (/^[\p{L}\p{N}._-]{3,30}$/u.test(handle)) {
      try {
        const byHandle = await fetchChannel(apiKey, { forHandle: handle }, signal)
        if (byHandle && (trimmed.startsWith('@') || namesMatch(byHandle.title, byHandle.handle, trimmed))) {
          resolved = byHandle
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        if (error instanceof YouTubeError && error.status !== 400 && error.status !== 404) throw error
      }
    }

    const needsNameSearch = !resolved && (/\s/.test(trimmed) || /[^\u0000-\u007f]/.test(trimmed))
    if (needsNameSearch) {
      const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
      searchUrl.searchParams.set('part', 'snippet')
      searchUrl.searchParams.set('type', 'channel')
      searchUrl.searchParams.set('maxResults', '5')
      searchUrl.searchParams.set('q', trimmed)
      searchUrl.searchParams.set('key', apiKey)
      const payload = asRecord(await getJson(searchUrl, signal))
      for (const item of asArray(payload?.items)) {
        const row = asRecord(item)
        const id = text(asRecord(row?.id)?.channelId)
        const title = decodeEntities(text(asRecord(row?.snippet)?.title))
        if (!id || !namesMatch(title, '', trimmed)) continue
        resolved = await fetchChannel(apiKey, { id }, signal)
        break
      }
    }
  }

  browseCache.set(key, resolved)
  return resolved
}

function hasDetailFilters(filters: Filters): boolean {
  return (
    filters.videoDuration !== 'any' ||
    filters.publishedWithin !== 'any' ||
    filters.videoDefinition !== 'any' ||
    filters.videoCaption !== 'any' ||
    filters.videoLicense !== 'any' ||
    filters.videoDimension !== 'any' ||
    filters.safeSearch !== 'moderate' ||
    filters.eventType !== 'any' ||
    filters.videoCategoryId !== '' ||
    filters.videoEmbeddable
  )
}

async function listChannelUploads(
  apiKey: string,
  channel: ResolvedChannel,
  filters: Filters,
  pageToken: string | undefined,
  signal: AbortSignal | undefined,
  now: Date,
): Promise<SearchPage> {
  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
  playlistUrl.searchParams.set('part', 'snippet,contentDetails')
  playlistUrl.searchParams.set('playlistId', channel.uploadsId)
  playlistUrl.searchParams.set('maxResults', String(Math.min(50, Math.max(filters.maxResults, 1))))
  if (pageToken) playlistUrl.searchParams.set('pageToken', pageToken)
  playlistUrl.searchParams.set('key', apiKey)
  const payload = asRecord(await getJson(playlistUrl, signal))
  const items = asArray(payload?.items)
  const ids = items
    .map((item) => {
      const row = asRecord(item)
      const snippet = asRecord(row?.snippet)
      return text(asRecord(row?.contentDetails)?.videoId) || text(asRecord(snippet?.resourceId)?.videoId)
    })
    .filter(Boolean)
  const details = new Map<string, unknown>()
  if (ids.length > 0) {
    const detailUrl = new URL('https://www.googleapis.com/youtube/v3/videos')
    detailUrl.searchParams.set('part', 'snippet,contentDetails,statistics,status')
    detailUrl.searchParams.set('id', ids.join(','))
    detailUrl.searchParams.set('key', apiKey)
    const detailPayload = asRecord(await getJson(detailUrl, signal))
    for (const entry of asArray(detailPayload?.items)) {
      const id = text(asRecord(entry)?.id)
      if (id) details.set(id, entry)
    }
  }

  const enriched = items
    .map((item) => {
      const row = asRecord(item)
      const snippet = asRecord(row?.snippet)
      const videoId = text(asRecord(row?.contentDetails)?.videoId) || text(asRecord(snippet?.resourceId)?.videoId)
      if (!videoId) return null
      return mapVideo({ id: { videoId }, snippet }, details.get(videoId))
    })
    .filter((video): video is VideoResult => video !== null)
    .map((video) => ({
      ...video,
      channelTitle: video.channelTitle || channel.title,
      channelId: video.channelId || channel.id,
      channelHandle: channel.handle,
      channelUrl: channel.url,
    }))

  const ignoreQuery = filters.q.trim() === '' || namesMatch(channel.title, channel.handle, filters.q)
  const scoped = { ...filters, channelId: '' }
  const order = filters.order === 'relevance' ? 'date' : filters.order
  const filtered = sortResults(filterCatalog(enriched, scoped, now, ignoreQuery), { ...scoped, order })
  const pageInfo = asRecord(payload?.pageInfo)
  const uploads = count(pageInfo?.totalResults)

  return {
    totalResults: hasDetailFilters(filters) || !ignoreQuery ? filtered.length : (uploads ?? filtered.length),
    nextPageToken: text(payload?.nextPageToken) || undefined,
    prevPageToken: text(payload?.prevPageToken) || undefined,
    results: filtered,
    channel: { title: channel.title, handle: channel.handle, url: channel.url },
  }
}

export async function searchYouTube(
  apiKey: string,
  filters: Filters,
  pageToken: string | undefined,
  signal?: AbortSignal,
  now = new Date(),
): Promise<SearchPage> {
  const browseQuery = filters.channelId.trim() || (filters.keywordOnly ? '' : filters.q.trim())
  if (browseQuery) {
    const channel = await lookupChannel(apiKey, browseQuery, signal)
    if (channel) return listChannelUploads(apiKey, channel, filters, pageToken, signal, now)
    if (filters.channelId.trim()) {
      throw new YouTubeError(
        `No channel found for “${filters.channelId.trim()}”. Try another name, or paste a channel ID that starts with UC.`,
        404,
      )
    }
  }

  const params = buildSearchParams(filters, pageToken, now)
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

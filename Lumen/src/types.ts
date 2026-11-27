export type Order = 'relevance' | 'date' | 'viewCount' | 'rating' | 'title'
export type Duration = 'any' | 'short' | 'medium' | 'long'
export type Window = 'any' | 'hour' | 'day' | 'week' | 'month' | 'year'
export type Definition = 'any' | 'high' | 'standard'
export type Caption = 'any' | 'closedCaption' | 'none'
export type License = 'any' | 'creativeCommon' | 'youtube'
export type Dimension = 'any' | '2d' | '3d'
export type SafeSearch = 'none' | 'moderate' | 'strict'
export type EventType = 'any' | 'live' | 'upcoming' | 'completed'
export type Picture = 'hd' | 'sd' | 'unknown'
export type Broadcast = 'none' | 'live' | 'upcoming' | 'completed'

export type Filters = {
  q: string
  order: Order
  videoDuration: Duration
  publishedWithin: Window
  videoDefinition: Definition
  videoCaption: Caption
  videoLicense: License
  videoDimension: Dimension
  safeSearch: SafeSearch
  eventType: EventType
  videoCategoryId: string
  regionCode: string
  relevanceLanguage: string
  videoEmbeddable: boolean
  channelId: string
  maxResults: number
}

export type VideoResult = {
  id: string
  title: string
  description: string
  channelTitle: string
  channelId: string
  channelHandle: string
  channelUrl: string
  publishedAt: string
  thumbnail: string
  durationSec: number
  viewCount: number | null
  likeCount: number | null
  definition: Picture
  caption: boolean
  license: 'youtube' | 'creativeCommon'
  dimension: '2d' | '3d'
  categoryId: string
  language: string
  regionCode: string
  liveBroadcastContent: Broadcast
  embeddable: boolean
}

export type SearchPage = {
  totalResults: number
  nextPageToken?: string
  prevPageToken?: string
  results: VideoResult[]
}

export type Chip = {
  id: string
  label: string
  patch: Partial<Filters>
}

export type CategoryOption = {
  id: string
  name: string
}

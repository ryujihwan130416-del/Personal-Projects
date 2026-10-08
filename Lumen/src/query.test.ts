import { describe, expect, it } from 'vitest'
import { activeChips, buildSearchParams, DEFAULT_FILTERS, publishedAfter } from './query'

const now = new Date('2026-10-08T12:00:00.000Z')

describe('YouTube search parameters', () => {
  it('turns relative upload windows into timestamps', () => {
    expect(publishedAfter('any', now)).toBeNull()
    expect(publishedAfter('hour', now)).toBe('2026-10-08T11:00:00.000Z')
    expect(publishedAfter('day', now)).toBe('2026-10-07T12:00:00.000Z')
    expect(publishedAfter('week', now)).toBe('2026-10-01T12:00:00.000Z')
    expect(publishedAfter('month', now)).toBe('2026-09-08T12:00:00.000Z')
    expect(publishedAfter('year', now)).toBe('2025-10-08T12:00:00.000Z')
  })

  it('sends video filters and omits an empty query', () => {
    const params = buildSearchParams(
      {
        ...DEFAULT_FILTERS,
        q: '  aurora  ',
        videoDuration: 'long',
        videoDefinition: 'high',
        videoCaption: 'closedCaption',
        videoLicense: 'creativeCommon',
        videoDimension: '3d',
        videoEmbeddable: true,
        videoCategoryId: '28',
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        safeSearch: 'strict',
        publishedWithin: 'week',
      },
      'NEXT',
      now,
    )
    expect(params.get('part')).toBe('snippet')
    expect(params.get('type')).toBe('video')
    expect(params.get('q')).toBe('aurora')
    expect(params.get('videoDuration')).toBe('long')
    expect(params.get('videoDefinition')).toBe('high')
    expect(params.get('videoCaption')).toBe('closedCaption')
    expect(params.get('videoLicense')).toBe('creativeCommon')
    expect(params.get('videoDimension')).toBe('3d')
    expect(params.get('videoEmbeddable')).toBe('true')
    expect(params.get('videoCategoryId')).toBe('28')
    expect(params.get('regionCode')).toBe('KR')
    expect(params.get('relevanceLanguage')).toBe('ko')
    expect(params.get('safeSearch')).toBe('strict')
    expect(params.get('publishedAfter')).toBe('2026-10-01T12:00:00.000Z')
    expect(params.get('pageToken')).toBe('NEXT')
    expect(params.get('key')).toBeNull()
    expect(params.get('eventType')).toBeNull()
  })

  it('drops conflicting filters when a broadcast is selected', () => {
    const params = buildSearchParams(
      {
        ...DEFAULT_FILTERS,
        q: 'radio',
        eventType: 'live',
        videoDuration: 'short',
        videoDefinition: 'high',
        videoCategoryId: '10',
        videoEmbeddable: true,
      },
      undefined,
      now,
    )
    expect(params.get('eventType')).toBe('live')
    expect(params.get('videoDuration')).toBeNull()
    expect(params.get('videoDefinition')).toBeNull()
    expect(params.get('videoCategoryId')).toBeNull()
    expect(params.get('videoEmbeddable')).toBeNull()
    expect(params.get('q')).toBe('radio')
  })

  it('only forwards a real channel id', () => {
    const named = buildSearchParams({ ...DEFAULT_FILTERS, q: 'talk', channelId: 'TED' }, undefined, now)
    const id = buildSearchParams(
      { ...DEFAULT_FILTERS, q: 'talk', channelId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' },
      undefined,
      now,
    )
    expect(named.get('channelId')).toBeNull()
    expect(id.get('channelId')).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw')
    expect(named.has('q')).toBe(true)
  })

  it('hides paused filters from the active chips', () => {
    const chips = activeChips({
      ...DEFAULT_FILTERS,
      q: 'cat',
      videoDuration: 'short',
      eventType: 'live',
      regionCode: 'JP',
    })
    const ids = chips.map((chip) => chip.id)
    expect(ids).toContain('event')
    expect(ids).toContain('region')
    expect(ids).not.toContain('duration')
  })
})

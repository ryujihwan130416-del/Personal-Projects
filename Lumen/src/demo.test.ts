import { describe, expect, it } from 'vitest'
import { CATALOG } from './catalog'
import { searchDemo } from './demo'
import { DEFAULT_FILTERS } from './query'

const now = new Date('2026-10-08T12:00:00.000Z')

describe('sample catalog', () => {
  it('filters by length, license, and broadcast without dropping the lock', () => {
    const shorts = searchDemo({ ...DEFAULT_FILTERS, videoDuration: 'short' }, undefined, now)
    expect(shorts.totalResults).toBe(10)
    expect(shorts.results.some((video) => video.id === 'jNQXAC9IVRw')).toBe(true)
    expect(shorts.results.some((video) => video.id === 'rfscVS0vtbw')).toBe(false)

    const commons = searchDemo({ ...DEFAULT_FILTERS, videoLicense: 'creativeCommon' }, undefined, now)
    expect(commons.totalResults).toBe(4)
    expect(commons.results.every((video) => video.license === 'creativeCommon')).toBe(true)

    const live = searchDemo(
      { ...DEFAULT_FILTERS, eventType: 'live', videoDuration: 'long' },
      undefined,
      now,
    )
    expect(live.results.map((video) => video.id)).toEqual(['5qap5aO4i9A'])
  })

  it('sorts by views, rating, title, and date', () => {
    expect(searchDemo({ ...DEFAULT_FILTERS, order: 'viewCount', maxResults: 1 }, undefined, now).results[0].id).toBe(
      'kJQP7kiw5Fk',
    )
    expect(searchDemo({ ...DEFAULT_FILTERS, order: 'rating', maxResults: 1 }, undefined, now).results[0].id).toBe(
      'HyWYpM_S-2c',
    )
    expect(searchDemo({ ...DEFAULT_FILTERS, order: 'title', maxResults: 1 }, undefined, now).results[0].title.startsWith('Adele')).toBe(
      true,
    )
    expect(searchDemo({ ...DEFAULT_FILTERS, order: 'date', maxResults: 1 }, undefined, now).results[0].id).toBe(
      '1La4QzGeaaQ',
    )
  })

  it('biases region without excluding other videos', () => {
    const page = searchDemo({ ...DEFAULT_FILTERS, regionCode: 'KR' }, undefined, now)
    expect(page.totalResults).toBe(CATALOG.length)
    expect(page.results[0].id).toBe('9bZkp7q19f0')
    expect(page.results.some((video) => video.regionCode !== 'KR')).toBe(true)
  })

  it('matches a day window and pages without overlap', () => {
    const day = searchDemo(
      { ...DEFAULT_FILTERS, publishedWithin: 'day' },
      undefined,
      new Date('2024-11-02T18:00:00.000Z'),
    )
    expect(day.results.map((video) => video.id)).toEqual(['1La4QzGeaaQ'])

    const year = searchDemo({ ...DEFAULT_FILTERS, publishedWithin: 'year' }, undefined, now)
    expect(year.totalResults).toBe(0)

    const first = searchDemo({ ...DEFAULT_FILTERS, q: 'official' }, undefined, now)
    const second = searchDemo({ ...DEFAULT_FILTERS, q: 'official' }, first.nextPageToken, now)
    const seen = new Set(first.results.map((video) => video.id))
    expect(first.results.length).toBe(12)
    expect(second.results.every((video) => !seen.has(video.id))).toBe(true)
  })

  it('lists every video from a channel when the query is that creator', () => {
    const ed = searchDemo({ ...DEFAULT_FILTERS, q: 'Ed Sheeran' }, undefined, now)
    expect(ed.channel?.title).toBe('Ed Sheeran')
    expect(ed.totalResults).toBe(2)
    expect(ed.results.every((video) => video.channelHandle === 'EdSheeran')).toBe(true)

    const queen = searchDemo({ ...DEFAULT_FILTERS, q: '@Queen' }, undefined, now)
    expect(queen.results.every((video) => video.channelTitle === 'Queen Official')).toBe(true)
    expect(queen.totalResults).toBeGreaterThan(0)

    const keyword = searchDemo({ ...DEFAULT_FILTERS, q: 'Ed Sheeran', keywordOnly: true }, undefined, now)
    expect(keyword.channel).toBeUndefined()

    const topic = searchDemo({ ...DEFAULT_FILTERS, q: 'official' }, undefined, now)
    expect(topic.channel).toBeUndefined()
    expect(topic.totalResults).toBeGreaterThan(4)
  })

  it('finds the open movies and the python course', () => {
    const films = searchDemo({ ...DEFAULT_FILTERS, q: 'blender' }, undefined, now)
    expect(films.totalResults).toBe(4)
    const course = searchDemo({ ...DEFAULT_FILTERS, q: 'python', videoDuration: 'long' }, undefined, now)
    expect(course.results[0]?.id).toBe('rfscVS0vtbw')
  })
})

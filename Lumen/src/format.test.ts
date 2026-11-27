import { describe, expect, it } from 'vitest'
import { decodeEntities, formatCount, formatDuration, parseIsoDuration, safeThumbnail, safeYouTubeUrl } from './format'

describe('duration and counts', () => {
  it('parses ISO 8601 durations', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('PT15M')).toBe(900)
    expect(parseIsoDuration('PT19S')).toBe(19)
    expect(parseIsoDuration('PT0S')).toBe(0)
    expect(parseIsoDuration('nope')).toBe(0)
  })

  it('formats clock time', () => {
    expect(formatDuration(19)).toBe('0:19')
    expect(formatDuration(213)).toBe('3:33')
    expect(formatDuration(16012)).toBe('4:26:52')
    expect(formatDuration(0)).toBe('')
  })

  it('compacts view counts', () => {
    expect(formatCount(42)).toBe('42')
    expect(formatCount(1500)).toBe('1.5K')
    expect(formatCount(10000)).toBe('10K')
    expect(formatCount(8_200_000_000)).toBe('8.2B')
  })

  it('keeps thumbnail and channel links on YouTube hosts', () => {
    expect(safeThumbnail('dQw4w9WgXcQ', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    expect(safeThumbnail('dQw4w9WgXcQ', 'javascript:alert(1)')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    )
    expect(safeThumbnail('not an id', 'https://i.ytimg.com/vi/x/hqdefault.jpg')).toBe('')
    expect(safeYouTubeUrl('https://www.youtube.com/@TED')).toBe('https://www.youtube.com/@TED')
    expect(safeYouTubeUrl('https://evil.example/phish')).toBe('https://www.youtube.com')
  })

  it('decodes the entities YouTube sometimes returns', () => {
    expect(decodeEntities('A &amp; B')).toBe('A & B')
    expect(decodeEntities('it&#39;s')).toBe("it's")
  })
})

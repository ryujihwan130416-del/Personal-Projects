import { describe, expect, it } from 'vitest'
import { nextHistory, recommendationQuery } from './history'

describe('search history recommendations', () => {
  it('keeps the newest query first and drops duplicates', () => {
    expect(nextHistory(['python', 'blender'], 'queen')).toEqual(['queen', 'python', 'blender'])
    expect(nextHistory(['Python', 'blender'], 'python')).toEqual(['python', 'blender'])
  })

  it('recommends a different recent search when one exists', () => {
    expect(recommendationQuery(['python', 'blender'], 'python')).toBe('blender')
    expect(recommendationQuery(['python'], 'python')).toBe('python')
    expect(recommendationQuery([], '')).toBeNull()
  })
})

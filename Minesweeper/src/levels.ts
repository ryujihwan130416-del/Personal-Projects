export type LevelId = 'beginner' | 'intermediate' | 'expert'

export interface Level {
  id: LevelId
  name: string
  subtitle: string
  rows: number
  cols: number
  mines: number
}

export const LEVELS: Level[] = [
  {
    id: 'beginner',
    name: '초급',
    subtitle: '9×9 · 지뢰 10',
    rows: 9,
    cols: 9,
    mines: 10,
  },
  {
    id: 'intermediate',
    name: '중급',
    subtitle: '16×16 · 지뢰 40',
    rows: 16,
    cols: 16,
    mines: 40,
  },
  {
    id: 'expert',
    name: '고급',
    subtitle: '16×30 · 지뢰 99',
    rows: 16,
    cols: 30,
    mines: 99,
  },
]

export function getLevel(id: LevelId): Level {
  const level = LEVELS.find((item) => item.id === id)
  if (!level) throw new Error(`Unknown level: ${id}`)
  return level
}

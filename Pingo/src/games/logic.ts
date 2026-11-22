import { getCatchWords, getChainWords, getQuiz } from '../i18n'

export function quizBank() {
  return getQuiz()
}

export function catchWords() {
  return getCatchWords()
}

export function normalizeWord(raw: string) {
  return raw.trim().toLowerCase().replace(/[^a-z]/g, '')
}

export type ChainError = 'short' | 'unknown' | 'used' | 'letter'

export function checkChainWord(word: string, prev: string, used: string[]): ChainError | null {
  const w = normalizeWord(word)
  if (w.length < 3) return 'short'
  const dict = new Set(getChainWords().map((x) => x.toLowerCase()))
  if (!dict.has(w)) return 'unknown'
  if (used.map((u) => u.toLowerCase()).includes(w)) return 'used'
  const letter = prev.slice(-1).toLowerCase()
  if (w[0] !== letter) return 'letter'
  return null
}

export function aiChainWord(prev: string, used: string[]): string | null {
  const letter = prev.slice(-1).toLowerCase()
  const usedSet = new Set(used.map((u) => u.toLowerCase()))
  const opts = getChainWords()
    .map((x) => x.toLowerCase())
    .filter((w) => w[0] === letter && !usedSet.has(w))
  if (!opts.length) return null
  return opts[Math.floor(Math.random() * opts.length)]
}

export function randomChainStart(): string {
  const words = getChainWords()
  return words[Math.floor(Math.random() * words.length)]
}

export const TTT_WINS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

export function tttWinner(board: string[]): string | 'draw' | null {
  for (const [a, b, c] of TTT_WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a]
  }
  if (board.every(Boolean)) return 'draw'
  return null
}

export function tttAi(board: string[], ai = 'O', hu = 'X'): number {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  for (const mark of [ai, hu]) {
    for (const i of empty) {
      const next = board.slice()
      next[i] = mark
      if (tttWinner(next) === mark) return i
    }
  }
  if (empty.includes(4)) return 4
  const corners = empty.filter((i) => [0, 2, 6, 8].includes(i))
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)]
  return empty[Math.floor(Math.random() * empty.length)]
}

export function c4Index(col: number, row: number) {
  return row * 7 + col
}

export function c4Drop(grid: number[], col: number, player: 1 | 2): number[] | null {
  const next = grid.slice()
  for (let r = 5; r >= 0; r--) {
    const i = c4Index(col, r)
    if (!next[i]) { next[i] = player; return next }
  }
  return null
}

export function c4Winner(grid: number[]): 1 | 2 | 'draw' | null {
  const dir = [[1, 0], [0, 1], [1, 1], [1, -1]]
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const p = grid[c4Index(c, r)]
      if (!p) continue
      for (const [dc, dr] of dir) {
        let n = 1
        for (let k = 1; k < 4; k++) {
          const cc = c + dc * k, rr = r + dr * k
          if (cc < 0 || cc > 6 || rr < 0 || rr > 5) break
          if (grid[c4Index(cc, rr)] === p) n++
          else break
        }
        if (n >= 4) return p as 1 | 2
      }
    }
  }
  if (grid.every(Boolean)) return 'draw'
  return null
}

export function c4Ai(grid: number[]): number {
  const cols = [3, 2, 4, 1, 5, 0, 6]
  for (const p of [2, 1] as const) {
    for (const c of cols) {
      const n = c4Drop(grid, c, p)
      if (n && c4Winner(n) === p) return c
    }
  }
  for (const c of cols) if (c4Drop(grid, c, 2)) return c
  return 3
}

export function rpsWinner(a: string, b: string): 0 | 1 | -1 {
  if (a === b) return 0
  if ((a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper')) return 1
  return -1
}

export function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function mineLayout(seed: number, w = 9, h = 9, mines = 10): boolean[] {
  const rng = mulberry(seed)
  const cells = Array(w * h).fill(false)
  let n = 0
  while (n < mines) {
    const i = Math.floor(rng() * cells.length)
    if (!cells[i]) { cells[i] = true; n++ }
  }
  return cells
}

export function mineCount(mines: boolean[], i: number, w = 9, h = 9): number {
  const x = i % w, y = Math.floor(i / w)
  let c = 0
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue
    const xx = x + dx, yy = y + dy
    if (xx >= 0 && xx < w && yy >= 0 && yy < h && mines[yy * w + xx]) c++
  }
  return c
}

export function spawn2048(board: number[], rng = Math.random): number[] {
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
  if (!empty.length) return board
  const next = board.slice()
  next[empty[Math.floor(rng() * empty.length)]] = rng() < 0.9 ? 2 : 4
  return next
}

export function slide2048(board: number[], dir: 'L' | 'R' | 'U' | 'D'): { board: number[]; score: number; moved: boolean } {
  const at = (x: number, y: number) => board[y * 4 + x]
  let score = 0
  const out = Array(16).fill(0)
  for (const [sx, sy, dx, dy] of (dir === 'L' || dir === 'R'
    ? Array.from({ length: 4 }, (_, y) => [dir === 'L' ? 0 : 3, y, dir === 'L' ? 1 : -1, 0])
    : Array.from({ length: 4 }, (_, x) => [x, dir === 'U' ? 0 : 3, 0, dir === 'U' ? 1 : -1])) ) {
    const line: number[] = []
    for (let k = 0; k < 4; k++) line.push(at(sx + dx * k, sy + dy * k))
    const compact = line.filter(Boolean)
    const merged: number[] = []
    for (let i = 0; i < compact.length; i++) {
      if (compact[i] === compact[i + 1]) {
        merged.push(compact[i] * 2)
        score += compact[i] * 2
        i++
      } else merged.push(compact[i])
    }
    while (merged.length < 4) merged.push(0)
    for (let k = 0; k < 4; k++) out[(sy + dy * k) * 4 + (sx + dx * k)] = merged[k]
  }
  const moved = out.some((v, i) => v !== board[i])
  return { board: out, score, moved }
}

export function shuffle<T>(arr: T[], seed: number): T[] {
  const rng = mulberry(seed)
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

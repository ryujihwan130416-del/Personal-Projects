export type CellState = {
  mine: boolean
  revealed: boolean
  flagged: boolean
  adjacent: number
}

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export type BoardConfig = {
  rows: number
  cols: number
  mines: number
}

export function createEmptyBoard(rows: number, cols: number): CellState[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adjacent: 0,
    })),
  )
}

function neighbors(rows: number, cols: number, r: number, c: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc])
    }
  }
  return out
}

export function placeMines(
  board: CellState[][],
  mines: number,
  safeR: number,
  safeC: number,
): CellState[][] {
  const rows = board.length
  const cols = board[0].length
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  const forbidden = new Set<string>()
  forbidden.add(`${safeR},${safeC}`)
  for (const [nr, nc] of neighbors(rows, cols, safeR, safeC)) {
    forbidden.add(`${nr},${nc}`)
  }

  const spots: Array<[number, number]> = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!forbidden.has(`${r},${c}`)) spots.push([r, c])
    }
  }

  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[spots[i], spots[j]] = [spots[j], spots[i]]
  }

  const count = Math.min(mines, spots.length)
  for (let i = 0; i < count; i++) {
    const [r, c] = spots[i]
    next[r][c].mine = true
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (next[r][c].mine) {
        next[r][c].adjacent = 0
        continue
      }
      next[r][c].adjacent = neighbors(rows, cols, r, c).filter(([nr, nc]) => next[nr][nc].mine).length
    }
  }

  return next
}

export function revealCell(board: CellState[][], r: number, c: number): CellState[][] {
  const rows = board.length
  const cols = board[0].length
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  const stack: Array<[number, number]> = [[r, c]]

  while (stack.length) {
    const [cr, cc] = stack.pop()!
    const cell = next[cr][cc]
    if (cell.revealed || cell.flagged) continue
    cell.revealed = true
    if (cell.mine || cell.adjacent > 0) continue
    for (const [nr, nc] of neighbors(rows, cols, cr, cc)) {
      if (!next[nr][nc].revealed && !next[nr][nc].flagged) stack.push([nr, nc])
    }
  }

  return next
}

export function toggleFlag(board: CellState[][], r: number, c: number): CellState[][] {
  const next = board.map((row) => row.map((cell) => ({ ...cell })))
  const cell = next[r][c]
  if (cell.revealed) return board
  cell.flagged = !cell.flagged
  return next
}

export function countFlags(board: CellState[][]): number {
  return board.flat().filter((cell) => cell.flagged).length
}

export function checkWin(board: CellState[][]): boolean {
  return board.every((row) =>
    row.every((cell) => (cell.mine ? !cell.revealed : cell.revealed)),
  )
}

export function revealAllMines(board: CellState[][]): CellState[][] {
  return board.map((row) =>
    row.map((cell) => (cell.mine ? { ...cell, revealed: true } : { ...cell })),
  )
}

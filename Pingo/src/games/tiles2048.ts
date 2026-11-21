/**
 * 2048 with tile identity, so tiles can glide (CSS transform transition) instead of
 * popping between cells. Same rules as slide2048 in logic.ts.
 */
export interface Tile { id: number; v: number; x: number; y: number; isNew?: boolean; merged?: boolean; gone?: boolean }
export type Dir = 'L' | 'R' | 'U' | 'D'

let nextId = 1
export function spawnTile(tiles: Tile[], rng = Math.random): Tile[] {
  const live = tiles.filter((t) => !t.gone)
  const taken = new Set(live.map((t) => t.y * 4 + t.x))
  const empty = Array.from({ length: 16 }, (_, i) => i).filter((i) => !taken.has(i))
  if (!empty.length) return tiles
  const i = empty[Math.floor(rng() * empty.length)]
  return [...tiles, { id: nextId++, v: rng() < 0.9 ? 2 : 4, x: i % 4, y: Math.floor(i / 4), isNew: true }]
}
export function newBoard(): Tile[] { return spawnTile(spawnTile([])) }

export function moveTiles(tiles: Tile[], dir: Dir): { tiles: Tile[]; score: number; moved: boolean } {
  // drop tiles that finished their merge animation last move, clear flags
  const live: Tile[] = tiles.filter((t) => !t.gone).map((t) => ({ ...t, isNew: false, merged: false }))
  const out: Tile[] = []
  let score = 0
  let moved = false
  for (let line = 0; line < 4; line++) {
    // cells in travel order (first = the wall we slide toward)
    const cells = Array.from({ length: 4 }, (_, k) => {
      const kk = dir === 'L' || dir === 'U' ? k : 3 - k
      return dir === 'L' || dir === 'R' ? { x: kk, y: line } : { x: line, y: kk }
    })
    const inLine = cells.map((c) => live.find((t) => t.x === c.x && t.y === c.y)).filter((t): t is Tile => !!t)
    let slot = 0
    for (let i = 0; i < inLine.length; i++) {
      const a = inLine[i]
      const b = inLine[i + 1]
      const target = cells[slot]
      if (b && b.v === a.v) {
        // both glide to target; a becomes the merged tile, b fades out underneath
        const merged = { ...a, x: target.x, y: target.y, v: a.v * 2, merged: true }
        out.push({ ...b, x: target.x, y: target.y, gone: true }, merged)
        score += a.v * 2
        moved = true
        i++
      } else {
        if (a.x !== target.x || a.y !== target.y) moved = true
        out.push({ ...a, x: target.x, y: target.y })
      }
      slot++
    }
  }
  return { tiles: moved ? out : tiles, score, moved }
}

export function canMove(tiles: Tile[]): boolean {
  const live = tiles.filter((t) => !t.gone)
  if (live.length < 16) return true
  return (['L', 'R', 'U', 'D'] as Dir[]).some((d) => moveTiles(live, d).moved)
}

export function tileColor(n: number): string {
  const pal = ['#eee4da', '#ede0c8', '#f2b179', '#f59563', '#f67c5f', '#f65e3b', '#edcf72', '#edcc61', '#edc850', '#edc53f', '#3c3a32']
  return pal[Math.min(Math.log2(n) - 1, pal.length - 1)]
}

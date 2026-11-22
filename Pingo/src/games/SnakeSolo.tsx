import { tx } from '../i18n'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { burst, confetti, sfx, shake } from '../lib/juice'
import { useT } from '../i18n'

// Pure client-side single-player snake: no room, no network. Fixed-step logic + requestAnimationFrame
// rendering with interpolation so movement looks continuous between ticks.
const N = 20
const CELL = 14
const PX = N * CELL
const BEST_KEY = 'pingo.snake.best'

type V = [number, number]
interface Sim { body: V[]; prev: V[]; dir: V; queue: V[]; food: V; lastTick: number; interval: number; alive: boolean; score: number }

function newSim(): Sim {
  const body: V[] = [[4, 10], [3, 10], [2, 10]]
  return { body, prev: body.map((p) => [...p] as V), dir: [1, 0], queue: [], food: [12, 10], lastTick: performance.now(), interval: 140, alive: true, score: 0 }
}

function placeFood(body: V[]): V {
  for (let i = 0; i < 200; i++) {
    const f: V = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]
    if (!body.some(([x, y]) => x === f[0] && y === f[1])) return f
  }
  return [0, 0]
}

function step(s: Sim, now: number) {
  if (s.queue.length) s.dir = s.queue.shift()!
  const head: V = [s.body[0][0] + s.dir[0], s.body[0][1] + s.dir[1]]
  const grow = head[0] === s.food[0] && head[1] === s.food[1]
  const checkBody = grow ? s.body : s.body.slice(0, -1)
  if (head[0] < 0 || head[0] >= N || head[1] < 0 || head[1] >= N || checkBody.some(([x, y]) => x === head[0] && y === head[1])) {
    s.alive = false
    return
  }
  const last = s.body[s.body.length - 1]
  s.prev = [...s.body, ...(grow ? [last] : [])].map((p) => [...p] as V)
  s.body = [head, ...(grow ? s.body : s.body.slice(0, -1))]
  if (grow) {
    s.score += 1
    s.food = placeFood(s.body)
    s.interval = Math.max(75, 140 - s.score * 3)
  }
  s.lastTick = now
}

export function SnakeSolo() {
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sim = useRef<Sim>(newSim())
  const paused = useRef(false)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) ?? 0))
  const touch = useRef<[number, number] | null>(null)

  const turn = useCallback((d: V) => {
    const s = sim.current
    if (!s.alive) return
    const ref = s.queue.length ? s.queue[s.queue.length - 1] : s.dir
    if (d[0] === -ref[0] && d[1] === -ref[1]) return
    if (d[0] === ref[0] && d[1] === ref[1]) return
    if (s.queue.length < 2) s.queue.push(d)
  }, [])

  const restart = useCallback(() => {
    sim.current = newSim()
    setScore(0)
    setOver(false)
  }, [])

  useEffect(() => {
    const keys: Record<string, V> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
    }
    const onKey = (e: KeyboardEvent) => {
      const d = keys[e.key] ?? keys[e.key.toLowerCase()]
      if (d) { e.preventDefault(); turn(d) }
      else if ((e.key === ' ' || e.key === 'Enter') && !sim.current.alive) { e.preventDefault(); restart() }
    }
    const onVis = () => { paused.current = document.hidden; if (!document.hidden) sim.current.lastTick = performance.now() }
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis) }
  }, [turn, restart])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Backing store follows the on-screen size so the board stays crisp at any scale.
    const fit = () => {
      const px = Math.max(PX, Math.round(canvas.clientWidth * dpr))
      if (canvas.width !== px) { canvas.width = px; canvas.height = px }
      const k = px / PX
      ctx.setTransform(k, 0, 0, k, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    const bg = document.createElement('canvas')
    bg.width = PX; bg.height = PX
    const bctx = bg.getContext('2d')!
    bctx.fillStyle = '#0e1a12'; bctx.fillRect(0, 0, PX, PX)
    bctx.fillStyle = 'rgba(255,255,255,0.04)'
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if ((x + y) % 2 === 0) bctx.fillRect(x * CELL, y * CELL, CELL, CELL)
    let raf = 0
    let reported = 0
    const best0 = Number(localStorage.getItem(BEST_KEY) ?? 0)
    const frame = (now: number) => {
      const s = sim.current
      if (s.alive && !paused.current) {
        let guard = 0
        while (s.alive && now - s.lastTick >= s.interval && guard++ < 4) step(s, s.lastTick + s.interval)
        if (!s.alive) {
          setOver(true)
          sfx('lose')
          shake(canvas)
          if (s.score > 0 && s.score >= best0) { window.setTimeout(() => { sfx('win'); confetti() }, 300) }
          setBest((b) => {
            const nb = Math.max(b, s.score)
            localStorage.setItem(BEST_KEY, String(nb))
            return nb
          })
        }
        if (s.score !== reported) {
          if (s.score > reported) { sfx('pop'); const r = canvas.getBoundingClientRect(); burst({ x: r.left + (s.body[0][0] + 0.5) * (r.width / N), y: r.top + (s.body[0][1] + 0.5) * (r.height / N) }, { count: 8, spread: 30, colors: ['#c8f542', '#2BB673', '#ffd23f'] }) }
          reported = s.score; setScore(s.score)
        }
      }
      const k = s.alive ? Math.min(1, (now - s.lastTick) / s.interval) : 1
      ctx.drawImage(bg, 0, 0, PX, PX)
      // food with a gentle pulse
      const pulse = 1 + Math.sin(now / 180) * 0.08
      ctx.fillStyle = '#c8f542'
      const fs = (CELL - 3) * pulse
      ctx.fillRect(s.food[0] * CELL + (CELL - fs) / 2, s.food[1] * CELL + (CELL - fs) / 2, fs, fs)
      ctx.fillStyle = s.alive ? '#2BB673' : '#666'
      for (let i = s.body.length - 1; i >= 0; i--) {
        const a = s.prev[i] ?? s.body[i]
        const b = s.body[i]
        const x = (a[0] + (b[0] - a[0]) * k) * CELL
        const y = (a[1] + (b[1] - a[1]) * k) * CELL
        ctx.globalAlpha = i === 0 ? 1 : 0.85
        ctx.fillRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    sim.current.lastTick = performance.now()
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  const onDown = (e: PointerEvent) => { touch.current = [e.clientX, e.clientY] }
  // Turn as soon as the finger has moved far enough (not on release), and allow chained turns in one swipe.
  const onMove = (e: PointerEvent) => {
    const s = touch.current
    if (!s) return
    const dx = e.clientX - s[0]
    const dy = e.clientY - s[1]
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
    touch.current = [e.clientX, e.clientY]
    turn(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1])
  }
  const onUp = () => { touch.current = null }

  return (
    <div className="board-wrap side snake-wrap" data-testid="board-snake-solo" data-score={score} data-over={over ? '1' : '0'}>
      <div className="board-side snake-hud">
        <span>{t('board.snakeScore', { n: score })}</span>
        <span>{t('board.snakeBest', { n: best })}</span>
      </div>
      <div className="snake-stage">
        <canvas className="snake-board" ref={canvasRef} style={{ touchAction: 'none' }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        {over ? (
          <div className="snake-over">
            <strong>{t('board.snakeOver')}</strong>
            <span>{t('board.snakeScore', { n: score })}</span>
            <button className="btn btn-lime" type="button" style={{ width: 'auto' }} data-testid="snake-restart" onClick={restart}>{t('board.snakeAgain')}</button>
          </div>
        ) : null}
      </div>
      <div className="pad-row">
        <button className="btn btn-ghost" type="button" aria-label={tx("Up")} onPointerDown={(e) => { e.preventDefault(); turn([0, -1]) }} onClick={(e) => { if (e.detail === 0) turn([0, -1]) }}>↑</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Left")} onPointerDown={(e) => { e.preventDefault(); turn([-1, 0]) }} onClick={(e) => { if (e.detail === 0) turn([-1, 0]) }}>←</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Down")} onPointerDown={(e) => { e.preventDefault(); turn([0, 1]) }} onClick={(e) => { if (e.detail === 0) turn([0, 1]) }}>↓</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Right")} onPointerDown={(e) => { e.preventDefault(); turn([1, 0]) }} onClick={(e) => { if (e.detail === 0) turn([1, 0]) }}>→</button>
      </div>
      <p className="snake-hint">{t('board.snakeHint')}</p>
    </div>
  )
}

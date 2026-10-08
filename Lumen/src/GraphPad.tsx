import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { compileExpression } from './graph'

type Point = { x: number; y: number }
type View = { panX: number; panY: number; scale: number }

const START_VIEW: View = { panX: 0, panY: 0, scale: 42 }

function paint(
  canvas: HTMLCanvasElement,
  view: View,
  formula: ((x: number) => number) | null,
  strokes: Point[][],
) {
  const rect = canvas.getBoundingClientRect()
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.floor(rect.width * ratio))
  const height = Math.max(1, Math.floor(rect.height * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  const cssWidth = rect.width
  const cssHeight = rect.height
  const originX = cssWidth / 2 + view.panX
  const originY = cssHeight / 2 + view.panY

  context.fillStyle = '#f4f0e6'
  context.fillRect(0, 0, cssWidth, cssHeight)

  const step = view.scale >= 28 ? 1 : view.scale >= 14 ? 2 : 5
  const startX = Math.floor((-originX) / view.scale / step) * step
  const endX = Math.ceil((cssWidth - originX) / view.scale / step) * step
  const startY = Math.floor((originY - cssHeight) / view.scale / step) * step
  const endY = Math.ceil(originY / view.scale / step) * step

  context.lineWidth = 1
  context.strokeStyle = 'rgba(70, 78, 90, 0.16)'
  context.beginPath()
  for (let x = startX; x <= endX; x += step) {
    const screenX = originX + x * view.scale
    context.moveTo(screenX, 0)
    context.lineTo(screenX, cssHeight)
  }
  for (let y = startY; y <= endY; y += step) {
    const screenY = originY - y * view.scale
    context.moveTo(0, screenY)
    context.lineTo(cssWidth, screenY)
  }
  context.stroke()

  context.strokeStyle = '#1d2430'
  context.lineWidth = 1.6
  context.beginPath()
  context.moveTo(0, originY)
  context.lineTo(cssWidth, originY)
  context.moveTo(originX, 0)
  context.lineTo(originX, cssHeight)
  context.stroke()

  context.fillStyle = '#5c6570'
  context.font = '12px "IBM Plex Mono", ui-monospace, monospace'
  context.fillText('x', cssWidth - 16, originY - 8)
  context.fillText('y', originX + 8, 16)

  if (formula) {
    context.strokeStyle = '#0f766e'
    context.lineWidth = 2.4
    context.beginPath()
    let drawing = false
    for (let pixel = 0; pixel <= cssWidth; pixel += 2) {
      const x = (pixel - originX) / view.scale
      const y = formula(x)
      if (!Number.isFinite(y)) {
        drawing = false
        continue
      }
      const screenY = originY - y * view.scale
      if (drawing) context.lineTo(pixel, screenY)
      else context.moveTo(pixel, screenY)
      drawing = true
    }
    context.stroke()
  }

  context.strokeStyle = '#c2410c'
  context.lineWidth = 2.2
  context.lineJoin = 'round'
  context.lineCap = 'round'
  for (const stroke of strokes) {
    if (stroke.length === 0) continue
    context.beginPath()
    stroke.forEach((point, index) => {
      const screenX = originX + point.x * view.scale
      const screenY = originY - point.y * view.scale
      if (index === 0) context.moveTo(screenX, screenY)
      else context.lineTo(screenX, screenY)
    })
    context.stroke()
  }
}

export function GraphPad({ onLearnMore }: { onLearnMore: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<View>(START_VIEW)
  const [expression, setExpression] = useState('sin(x)')
  const [formula, setFormula] = useState<((x: number) => number) | null>(() => compileExpression('sin(x)'))
  const [error, setError] = useState<string | null>(null)
  const [tool, setTool] = useState<'move' | 'draw'>('move')
  const [strokes, setStrokes] = useState<Point[][]>([])
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; drawing: boolean } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => paint(canvas, view, formula, strokes)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [view, formula, strokes])

  function plot(event: FormEvent) {
    event.preventDefault()
    const next = compileExpression(expression)
    if (!next) {
      setError('Use x, numbers, + − × ÷, ^, and sin cos tan sqrt abs.')
      setFormula(null)
      return
    }
    setError(null)
    setFormula(() => next)
  }

  function pointerPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const originX = rect.width / 2 + view.panX
    const originY = rect.height / 2 + view.panY
    return {
      x: (event.clientX - rect.left - originX) / view.scale,
      y: (originY - (event.clientY - rect.top)) / view.scale,
    }
  }

  return (
    <div className="graph-app">
      <header className="graph-bar">
        <div>
          <p className="graph-kicker">Plane</p>
          <h1>Graph</h1>
        </div>
        <form className="graph-form" onSubmit={plot}>
          <label htmlFor="expr">y =</label>
          <input
            id="expr"
            value={expression}
            spellCheck={false}
            autoCapitalize="off"
            onChange={(event) => setExpression(event.target.value)}
          />
          <button type="submit" className="graph-plot">
            Plot
          </button>
        </form>
        <div className="graph-tools" role="group" aria-label="Canvas tools">
          <button type="button" aria-pressed={tool === 'move'} onClick={() => setTool('move')}>
            Move
          </button>
          <button type="button" aria-pressed={tool === 'draw'} onClick={() => setTool('draw')}>
            Draw
          </button>
          <button
            type="button"
            onClick={() => setView((current) => ({ ...current, scale: Math.min(160, current.scale * 1.15) }))}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setView((current) => ({ ...current, scale: Math.max(12, current.scale / 1.15) }))}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => {
              setStrokes([])
              setView(START_VIEW)
            }}
          >
            Clear
          </button>
        </div>
      </header>
      {error ? <p className="graph-error">{error}</p> : null}
      <canvas
        ref={canvasRef}
        className={tool === 'draw' ? 'graph-canvas is-draw' : 'graph-canvas'}
        aria-label="Coordinate plane"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId)
          if (tool === 'draw') {
            const point = pointerPoint(event)
            setStrokes((current) => [...current, [point]])
            drag.current = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY, drawing: true }
            return
          }
          drag.current = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY, drawing: false }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          if (drag.current.drawing) {
            const point = pointerPoint(event)
            setStrokes((current) => {
              const next = current.slice()
              const last = next[next.length - 1]
              if (!last) return current
              next[next.length - 1] = [...last, point]
              return next
            })
            return
          }
          setView((current) => ({
            ...current,
            panX: drag.current!.panX + (event.clientX - drag.current!.x),
            panY: drag.current!.panY + (event.clientY - drag.current!.y),
          }))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onWheel={(event) => {
          event.preventDefault()
          const factor = event.deltaY > 0 ? 0.92 : 1.08
          setView((current) => ({ ...current, scale: Math.min(160, Math.max(12, current.scale * factor)) }))
        }}
      />
      <footer className="graph-foot">
        <p>This app searches public YouTube videos and plays them with filters.</p>
        <button type="button" onClick={onLearnMore}>
          Learn more
        </button>
      </footer>
    </div>
  )
}

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { compileExpression } from './graph'

type View = { panX: number; panY: number; scale: number }
type Expression = { id: string; source: string; color: string; visible: boolean }
type GraphSettings = {
  dark: boolean
  font: 'outfit' | 'syne' | 'mono' | 'serif'
  size: 'sm' | 'md' | 'lg'
  grid: boolean
}

const COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000']
const START_VIEW: View = { panX: 0, panY: 0, scale: 48 }
const STORAGE_KEY = 'lumen.graph.settings'

const FONTS: Record<GraphSettings['font'], string> = {
  outfit: 'Outfit, "Avenir Next", sans-serif',
  syne: 'Syne, Outfit, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  serif: 'Georgia, "Iowan Old Style", serif',
}

const SIZES: Record<GraphSettings['size'], string> = {
  sm: '14px',
  md: '16px',
  lg: '19px',
}

function loadSettings(): GraphSettings {
  const fallback: GraphSettings = { dark: false, font: 'outfit', size: 'md', grid: true }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as Partial<GraphSettings>
    return { ...fallback, ...parsed }
  } catch {
    return fallback
  }
}

function paint(
  canvas: HTMLCanvasElement,
  view: View,
  expressions: { color: string; formula: (x: number) => number }[],
  settings: GraphSettings,
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
  const dark = settings.dark

  context.fillStyle = dark ? '#1e1e1e' : '#ffffff'
  context.fillRect(0, 0, cssWidth, cssHeight)

  if (settings.grid) {
    const step = view.scale >= 28 ? 1 : view.scale >= 14 ? 2 : 5
    const startX = Math.floor(-originX / view.scale / step) * step
    const endX = Math.ceil((cssWidth - originX) / view.scale / step) * step
    const startY = Math.floor((originY - cssHeight) / view.scale / step) * step
    const endY = Math.ceil(originY / view.scale / step) * step
    context.lineWidth = 1
    context.strokeStyle = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
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
  }

  context.strokeStyle = dark ? 'rgba(255,255,255,0.85)' : '#222'
  context.lineWidth = 1.4
  context.beginPath()
  context.moveTo(0, originY)
  context.lineTo(cssWidth, originY)
  context.moveTo(originX, 0)
  context.lineTo(originX, cssHeight)
  context.stroke()

  context.fillStyle = dark ? 'rgba(255,255,255,0.7)' : '#555'
  context.font = `12px ${FONTS[settings.font]}`
  context.fillText('x', cssWidth - 18, Math.min(cssHeight - 8, Math.max(16, originY - 8)))
  context.fillText('y', Math.min(cssWidth - 16, Math.max(8, originX + 8)), 18)

  for (const expression of expressions) {
    context.strokeStyle = expression.color
    context.lineWidth = 2.6
    context.beginPath()
    let drawing = false
    for (let pixel = 0; pixel <= cssWidth; pixel += 2) {
      const x = (pixel - originX) / view.scale
      const y = expression.formula(x)
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
}

function nextId(): string {
  return Math.random().toString(36).slice(2, 8)
}

export function GraphPad({ onOpenSearch }: { onOpenSearch: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState<View>(START_VIEW)
  const [settings, setSettings] = useState<GraphSettings>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [rows, setRows] = useState<Expression[]>([
    { id: 'start', source: 'sin(x)', color: COLORS[0], visible: true },
    { id: 'second', source: '', color: COLORS[1], visible: true },
  ])
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  const plotted = rows.flatMap((row) => {
    if (!row.visible || !row.source.trim()) return []
    const formula = compileExpression(row.source)
    return formula ? [{ color: row.color, formula }] : []
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const draw = () => paint(canvas, view, plotted, settings)
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [view, plotted, settings])

  function pointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { x: event.clientX, y: event.clientY, panX: view.panX, panY: view.panY }
  }

  return (
    <div
      className={settings.dark ? 'graph-app is-dark' : 'graph-app'}
      style={{ fontFamily: FONTS[settings.font], fontSize: SIZES[settings.size] }}
    >
      <aside className="expr-list">
        <h1>Lumen</h1>
        <ul>
          {rows.map((row) => {
            const invalid = row.source.trim().length > 0 && !compileExpression(row.source)
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="swatch"
                  style={{ background: row.visible ? row.color : 'transparent', borderColor: row.color }}
                  aria-label={row.visible ? 'Hide expression' : 'Show expression'}
                  aria-pressed={row.visible}
                  onClick={() =>
                    setRows((current) =>
                      current.map((item) => (item.id === row.id ? { ...item, visible: !item.visible } : item)),
                    )
                  }
                />
                <input
                  aria-label="Expression"
                  value={row.source}
                  placeholder="expression"
                  spellCheck={false}
                  autoCapitalize="off"
                  className={invalid ? 'is-invalid' : undefined}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item) => (item.id === row.id ? { ...item, source: event.target.value } : item)),
                    )
                  }
                />
                <button
                  type="button"
                  className="expr-x"
                  aria-label="Remove expression"
                  onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          className="expr-add"
          onClick={() =>
            setRows((current) => [
              ...current,
              { id: nextId(), source: '', color: COLORS[current.length % COLORS.length], visible: true },
            ])
          }
        >
          + Add expression
        </button>
      </aside>
      <div className="graph-stage">
        <div className="graph-zoom">
          <button type="button" aria-label="Zoom in" onClick={() => setView((v) => ({ ...v, scale: Math.min(180, v.scale * 1.2) }))}>
            +
          </button>
          <button type="button" aria-label="Zoom out" onClick={() => setView((v) => ({ ...v, scale: Math.max(12, v.scale / 1.2) }))}>
            −
          </button>
          <button type="button" aria-label="Reset view" onClick={() => setView(START_VIEW)}>
            Home
          </button>
          <button type="button" aria-label="Settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}>
            Settings
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="graph-canvas"
          aria-label="Coordinate plane"
          onPointerDown={pointerDown}
          onPointerMove={(event) => {
            if (!drag.current) return
            const start = drag.current
            setView((current) => ({
              ...current,
              panX: start.panX + (event.clientX - start.x),
              panY: start.panY + (event.clientY - start.y),
            }))
          }}
          onPointerUp={() => {
            drag.current = null
          }}
          onWheel={(event) => {
            event.preventDefault()
            const factor = event.deltaY > 0 ? 0.9 : 1.1
            setView((current) => ({ ...current, scale: Math.min(180, Math.max(12, current.scale * factor)) }))
          }}
        />
      </div>
      {settingsOpen ? (
        <div className="settings-layer">
          <button type="button" className="settings-backdrop" aria-label="Close settings" onClick={() => setSettingsOpen(false)} />
          <aside className="settings-panel" role="dialog" aria-labelledby="settings-title">
            <div className="settings-head">
              <h2 id="settings-title">Settings</h2>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                Close
              </button>
            </div>
            <label className="settings-row">
              <span>Dark mode</span>
              <input
                type="checkbox"
                checked={settings.dark}
                onChange={(event) => setSettings((current) => ({ ...current, dark: event.target.checked }))}
              />
            </label>
            <label className="settings-row">
              <span>Font</span>
              <select
                value={settings.font}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, font: event.target.value as GraphSettings['font'] }))
                }
              >
                <option value="outfit">Outfit</option>
                <option value="syne">Syne</option>
                <option value="mono">Mono</option>
                <option value="serif">Serif</option>
              </select>
            </label>
            <fieldset className="settings-size">
              <legend>Text size</legend>
              <div>
                {(['sm', 'md', 'lg'] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={settings.size === size}
                    onClick={() => setSettings((current) => ({ ...current, size }))}
                  >
                    {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="settings-row">
              <span>Grid</span>
              <input
                type="checkbox"
                checked={settings.grid}
                onChange={(event) => setSettings((current) => ({ ...current, grid: event.target.checked }))}
              />
            </label>
            <section className="privacy">
              <h3>Privacy policy</h3>
              <p>
                Lumen stores your expressions, theme, and font choice on this device only. It does not create an
                account, and it does not sell personal information. Clearing the app’s data removes those settings.
              </p>
              <p>Expressions you type stay in the page until you delete them. This policy does not cover other sites you open from the device.</p>
              <button type="button" className="privacy-more" onClick={onOpenSearch}>
                Learn more
              </button>
            </section>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

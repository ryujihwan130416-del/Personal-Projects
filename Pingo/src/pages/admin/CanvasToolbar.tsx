import type { CSSProperties } from 'react'
import { FONTS, resolved, type Mode, type ThemeTokens } from '../../lib/theme'
import { EFFECTS, SHADOWS, type BaseStyle, type ElementOverride, type Fill } from '../../lib/uiElements'
import { at } from './adminI18n'

export type StyleClip = Omit<ElementOverride, 'text'>

/** Canva-style floating toolbar shown above the selected element on the canvas. */
export function CanvasToolbar({ style, count, o, theme, mode, setBase, setFill, setHide, reset, copy, paste, canPaste }: {
  style: CSSProperties; count: number; o: ElementOverride; theme: ThemeTokens; mode: Mode
  setBase: (patch: Partial<Record<keyof BaseStyle, unknown>>) => void; setFill: (f: Fill | undefined) => void; setHide: (h: boolean) => void
  reset: () => void; copy: () => void; paste: () => void; canPaste: boolean
}) {
  const b = o.base ?? {}
  const swatches = [...new Set([resolved(theme, mode, 'accent'), resolved(theme, mode, 'accent2'), resolved(theme, mode, 'surface'), resolved(theme, mode, 'text'), '#ffffff', '#1a1530', '#c8f542', '#ff4f9a', '#38c6ff', '#ffd23f'])].filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 8)
  const fs = b.fontSize ?? 15
  const hex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : '#000000')
  const bgColor = b.bg?.kind === 'solid' ? b.bg.color : b.bg?.kind === 'gradient' ? b.bg.from : undefined
  return (
    <div className="cv-toolbar" style={style} role="toolbar" aria-label={at("Element toolbar")} data-testid="ue-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      {count > 1 ? <span className="cv-tb-count">{count}</span> : null}
      <div className="cv-tb-group" title={at("Background")}>
        {swatches.map((c) => <button key={c} type="button" className={`cv-sw ${bgColor === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setFill({ kind: 'solid', color: c })} data-testid="tb-swatch" />)}
        <label className="cv-sw cv-sw-pick" title={at("Custom color")}><input type="color" value={hex(bgColor)} onChange={(e) => setFill({ kind: 'solid', color: e.target.value })} data-testid="tb-bg" />🎨</label>
        <button type="button" className="cv-sw cv-sw-grad" title={at("Gradient")} onClick={() => setFill({ kind: 'gradient', from: resolved(theme, mode, 'accent'), to: resolved(theme, mode, 'accent2'), angle: 135 })} data-testid="tb-grad" />
        {b.bg ? <button type="button" className="cv-tb-btn" title={at("Default")} onClick={() => setFill(undefined)}>⦸</button> : null}
      </div>
      <label className="cv-tb-color" title={at("Text color")}>A<input type="color" value={hex(b.color)} onChange={(e) => setBase({ color: e.target.value })} data-testid="tb-color" /><i style={{ background: b.color ?? 'currentColor' }} /></label>
      <select className="cv-tb-sel" value={b.font ?? ''} onChange={(e) => setBase({ font: e.target.value || undefined })} title={at("Font")} data-testid="tb-font">
        {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family || at('App font')}</option>)}
      </select>
      <div className="cv-tb-group">
        <button type="button" className="cv-tb-btn" onClick={() => setBase({ fontSize: Math.max(8, fs - 1) })} aria-label={at("Smaller text")} data-testid="tb-size-dec">−</button>
        <span className="cv-tb-num" data-testid="tb-size">{b.fontSize ?? '–'}</span>
        <button type="button" className="cv-tb-btn" onClick={() => setBase({ fontSize: Math.min(64, fs + 1) })} aria-label={at("Bigger text")} data-testid="tb-size-inc">+</button>
      </div>
      <button type="button" className={`cv-tb-btn ${(b.fontWeight ?? 0) >= 700 ? 'on' : ''}`} onClick={() => setBase({ fontWeight: (b.fontWeight ?? 0) >= 700 ? undefined : 800 })} aria-pressed={(b.fontWeight ?? 0) >= 700} aria-label={at("Bold")} data-testid="tb-bold"><b>B</b></button>
      <div className="cv-tb-group">
        {(['left', 'center', 'right'] as const).map((a) => <button key={a} type="button" className={`cv-tb-btn ${b.align === a ? 'on' : ''}`} onClick={() => setBase({ align: b.align === a ? undefined : a })} aria-label={at(a)} data-testid={`tb-align-${a}`}>{a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}</button>)}
      </div>
      <select className="cv-tb-sel" value={b.radius ?? ''} onChange={(e) => setBase({ radius: e.target.value === '' ? undefined : Number(e.target.value) })} title={at("Radius")} data-testid="tb-radius">
        <option value="">◜ {at("Radius")}</option>{[0, 6, 12, 20, 32, 999].map((r) => <option key={r} value={r}>{r === 999 ? at('Pill') : `${r}px`}</option>)}
      </select>
      <select className="cv-tb-sel" value={b.shadow ?? ''} onChange={(e) => setBase({ shadow: e.target.value || undefined })} title={at("Shadow")} data-testid="tb-shadow">
        <option value="">▣ {at("Shadow")}</option>{SHADOWS.map((s) => <option key={s} value={s}>{at(s)}</option>)}
      </select>
      <label className="cv-tb-op" title={at("Opacity")}>◐<input type="range" min={0.05} max={1} step={0.05} value={b.opacity ?? 1} onChange={(e) => setBase({ opacity: Number(e.target.value) >= 1 ? undefined : Number(e.target.value) })} data-testid="tb-opacity" /></label>
      <select className="cv-tb-sel" value={b.effect ?? ''} onChange={(e) => setBase({ effect: e.target.value || undefined })} title={at("Effect")} data-testid="tb-effect">
        <option value="">✨ {at("Effect")}</option>{EFFECTS.filter((x) => x !== 'none').map((x) => <option key={x} value={x}>{at(x)}</option>)}
      </select>
      <button type="button" className="cv-tb-btn" onClick={() => setHide(!o.hide)} aria-label={o.hide ? at("Show") : at("Hide")} title={at("Hide (Delete)")} data-testid="tb-hide">{o.hide ? '🙈' : '👁'}</button>
      <button type="button" className="cv-tb-btn" onClick={copy} title={at("Copy style (Ctrl+C)")} aria-label={at("Copy style (Ctrl+C)")} data-testid="tb-copy">⧉</button>
      <button type="button" className="cv-tb-btn" disabled={!canPaste} onClick={paste} title={at("Paste style (Ctrl+V)")} aria-label={at("Paste style (Ctrl+V)")} data-testid="tb-paste">📋</button>
      <button type="button" className="cv-tb-btn" onClick={reset} title={at("Reset this element")} aria-label={at("Reset this element")} data-testid="tb-reset">↺</button>
    </div>
  )
}

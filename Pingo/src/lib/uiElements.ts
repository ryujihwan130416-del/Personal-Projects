/**
 * Per-element overrides from the admin UI editor's inspector. Every meaningful element in the app carries a
 * stable `data-ui-id` (added at build time by ui-ids.plugin.ts). Overrides become one generated stylesheet
 * (colors, gradient, type, spacing, size, shape, hover/pressed, light/dark, hide, icon) plus a tiny DOM pass
 * for text. All values are validated and structured — never raw CSS — so a bad value can't inject styles.
 * Selectors are scoped with html:not([data-route="admin"]) so the admin console is never affected.
 * Escape hatch: open the app with ?safe-ui=1 to ignore every element override on that device/session.
 */
import { LOCALES, getLocale, onLocaleChange, type Locale } from '../i18n'
import { FONTS, ensureFont, isColor } from './theme'

export type Fill = { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number }
export interface ColorSet { bg?: Fill; color?: string; borderColor?: string }
export type Len = { v: number; unit: 'px' | '%' } | 'auto'
export const SHADOWS = ['none', 'soft', 'medium', 'strong', 'pop', 'glow'] as const
export type Shadow = (typeof SHADOWS)[number]
export const ALIGNS = ['left', 'center', 'right'] as const
export type Align = (typeof ALIGNS)[number]
export const EFFECTS = ['none', 'blur', 'grayscale', 'sepia', 'bright', 'saturate'] as const
export type Effect = (typeof EFFECTS)[number]
const EFFECT_CSS: Record<Effect, string> = { none: 'none', blur: 'blur(2px)', grayscale: 'grayscale(1)', sepia: 'sepia(.8)', bright: 'brightness(1.25)', saturate: 'saturate(1.8)' }
export interface BaseStyle extends ColorSet {
  font?: string; fontSize?: number; fontWeight?: number
  padY?: number; padX?: number; marY?: number; marX?: number; gap?: number
  width?: Len; height?: Len
  radius?: number; borderWidth?: number; shadow?: Shadow; opacity?: number; order?: number
  /** Canvas drag: visual offset in px (CSS translate; layout around it is unchanged). */
  tx?: number; ty?: number
  align?: Align; effect?: Effect
}
export interface ElementOverride {
  /** Text/label; 'all' applies to every language, a language code wins over it. */
  text?: Partial<Record<'all' | Locale, string>>
  /** '' keeps the icon; 'none' hides it; anything else is a short emoji/label shown instead. */
  icon?: string
  hide?: boolean
  base?: BaseStyle
  light?: ColorSet
  dark?: ColorSet
  hover?: ColorSet
  active?: ColorSet
}
export type ElementOverrides = Record<string, ElementOverride>

export const ID_RE = /^[a-z0-9][a-z0-9._*-]{0,95}$/
export const MAX_ELEMENTS = 400
export const LIMITS = {
  fontSize: [8, 64], fontWeight: [300, 900], padY: [0, 80], padX: [0, 80], marY: [-40, 80], marX: [-40, 80], gap: [0, 64],
  radius: [0, 999], move: [-1200, 1200], borderWidth: [0, 12], opacity: [0.05, 1], order: [-20, 20], angle: [0, 360], px: [0, 1600], pct: [0, 100],
} as const
const SHADOW_CSS: Record<Shadow, string> = {
  none: 'none',
  soft: '0 2px 8px rgba(0,0,0,.12)',
  medium: '0 6px 18px rgba(0,0,0,.18)',
  strong: '0 14px 34px rgba(0,0,0,.28)',
  pop: '4px 4px 0 var(--border)',
  glow: '0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent), 0 0 18px color-mix(in srgb, var(--accent) 45%, transparent)',
}
const LANG_KEYS = ['all', ...LOCALES.map((l) => l.id)] as const

// ---------- validation ----------
type Errs = string[]
const num = (v: unknown, [lo, hi]: readonly [number, number], path: string, errs: Errs): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'number' || !Number.isFinite(v)) { errs.push(`${path}: must be a number`); return undefined }
  if (v < lo || v > hi) { errs.push(`${path}: must be between ${lo} and ${hi}`); return undefined }
  return Math.round(v * 100) / 100
}
const color = (v: unknown, path: string, errs: Errs): string | undefined => {
  if (v === undefined || v === null || v === '') return undefined
  if (!isColor(v)) { errs.push(`${path}: not a valid color`); return undefined }
  return v
}
function fill(v: unknown, path: string, errs: Errs): Fill | undefined {
  if (v === undefined || v === null) return undefined
  const f = v as Record<string, unknown>
  if (f.kind === 'solid') { const c = color(f.color, `${path}.color`, errs); return c ? { kind: 'solid', color: c } : undefined }
  if (f.kind === 'gradient') {
    const from = color(f.from, `${path}.from`, errs), to = color(f.to, `${path}.to`, errs)
    const angle = num(f.angle ?? 135, LIMITS.angle, `${path}.angle`, errs) ?? 135
    return from && to ? { kind: 'gradient', from, to, angle } : undefined
  }
  errs.push(`${path}: kind must be "solid" or "gradient"`)
  return undefined
}
function colorSet(v: unknown, path: string, errs: Errs): ColorSet | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'object') { errs.push(`${path}: must be an object`); return undefined }
  const r = v as Record<string, unknown>
  const out: ColorSet = { bg: fill(r.bg, `${path}.bg`, errs), color: color(r.color, `${path}.color`, errs), borderColor: color(r.borderColor, `${path}.borderColor`, errs) }
  return prune(out)
}
function len(v: unknown, path: string, errs: Errs): Len | undefined {
  if (v === undefined || v === null || v === '') return undefined
  if (v === 'auto') return 'auto'
  const r = v as Record<string, unknown>
  if (r && (r.unit === 'px' || r.unit === '%')) {
    const n = num(r.v, r.unit === 'px' ? LIMITS.px : LIMITS.pct, `${path}.v`, errs)
    return n === undefined ? undefined : { v: n, unit: r.unit }
  }
  errs.push(`${path}: use "auto" or { v, unit: "px" | "%" }`)
  return undefined
}
function prune<T extends object>(o: T): T | undefined {
  const out = Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T
  return Object.keys(out).length ? out : undefined
}
/** Grapheme-ish limit for icon text (emoji or up to 4 characters). */
const shortText = (s: string) => [...s].length <= 4

export function validateElements(raw: unknown): { elements: ElementOverrides; errors: string[] } {
  const errors: string[] = []
  const elements: ElementOverrides = {}
  if (raw === undefined || raw === null) return { elements, errors }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { elements, errors: ['elements: must be an object keyed by element id'] }
  const entries = Object.entries(raw as Record<string, unknown>)
  if (entries.length > MAX_ELEMENTS) errors.push(`elements: at most ${MAX_ELEMENTS} elements (got ${entries.length}); extra ones dropped`)
  for (const [id, v] of entries.slice(0, MAX_ELEMENTS)) {
    const p = `elements.${id}`
    if (!ID_RE.test(id)) { errors.push(`${p}: invalid element id`); continue }
    if (!v || typeof v !== 'object') { errors.push(`${p}: must be an object`); continue }
    const r = v as Record<string, unknown>
    const o: ElementOverride = {}
    if (r.text !== undefined) {
      const t: ElementOverride['text'] = {}
      for (const [k, s] of Object.entries((r.text ?? {}) as Record<string, unknown>)) {
        if (!(LANG_KEYS as readonly string[]).includes(k)) { errors.push(`${p}.text.${k}: unknown language`); continue }
        if (typeof s !== 'string' || s.length > 300) { errors.push(`${p}.text.${k}: text up to 300 characters`); continue }
        if (s) t[k as 'all'] = s
      }
      if (Object.keys(t).length) o.text = t
    }
    if (r.icon !== undefined && r.icon !== '') {
      if (typeof r.icon !== 'string' || (r.icon !== 'none' && !shortText(r.icon))) errors.push(`${p}.icon: use "none" or an emoji / up to 4 characters`)
      else o.icon = r.icon
    }
    if (r.hide !== undefined) { if (typeof r.hide !== 'boolean') errors.push(`${p}.hide: must be true/false`); else if (r.hide) o.hide = true }
    if (r.base !== undefined) {
      const b = (r.base ?? {}) as Record<string, unknown>
      const bp = `${p}.base`
      let font: string | undefined
      if (b.font !== undefined && b.font !== '') { if (FONTS.some((f) => f.family === b.font)) font = b.font as string; else errors.push(`${bp}.font: pick one of the listed fonts`) }
      let shadow: Shadow | undefined
      if (b.shadow !== undefined && b.shadow !== '') { if ((SHADOWS as readonly string[]).includes(b.shadow as string)) shadow = b.shadow as Shadow; else errors.push(`${bp}.shadow: one of ${SHADOWS.join(', ')}`) }
      let align: Align | undefined
      if (b.align !== undefined && b.align !== '') { if ((ALIGNS as readonly string[]).includes(b.align as string)) align = b.align as Align; else errors.push(`${bp}.align: one of ${ALIGNS.join(', ')}`) }
      let effect: Effect | undefined
      if (b.effect !== undefined && b.effect !== '') { if ((EFFECTS as readonly string[]).includes(b.effect as string)) effect = b.effect as Effect; else errors.push(`${bp}.effect: one of ${EFFECTS.join(', ')}`) }
      const fw = num(b.fontWeight, LIMITS.fontWeight, `${bp}.fontWeight`, errors)
      const base: BaseStyle = {
        ...(colorSet({ bg: b.bg, color: b.color, borderColor: b.borderColor }, bp, errors) ?? {}),
        font, fontSize: num(b.fontSize, LIMITS.fontSize, `${bp}.fontSize`, errors), fontWeight: fw === undefined ? undefined : Math.round(fw / 100) * 100,
        padY: num(b.padY, LIMITS.padY, `${bp}.padY`, errors), padX: num(b.padX, LIMITS.padX, `${bp}.padX`, errors),
        marY: num(b.marY, LIMITS.marY, `${bp}.marY`, errors), marX: num(b.marX, LIMITS.marX, `${bp}.marX`, errors), gap: num(b.gap, LIMITS.gap, `${bp}.gap`, errors),
        width: len(b.width, `${bp}.width`, errors), height: len(b.height, `${bp}.height`, errors),
        radius: num(b.radius, LIMITS.radius, `${bp}.radius`, errors), borderWidth: num(b.borderWidth, LIMITS.borderWidth, `${bp}.borderWidth`, errors),
        shadow, opacity: num(b.opacity, LIMITS.opacity, `${bp}.opacity`, errors),
        order: (() => { const n = num(b.order, LIMITS.order, `${bp}.order`, errors); return n === undefined ? undefined : Math.round(n) })(),
        tx: num(b.tx, LIMITS.move, `${bp}.tx`, errors), ty: num(b.ty, LIMITS.move, `${bp}.ty`, errors), align, effect,
      }
      const pb = prune(base)
      if (pb) o.base = pb
    }
    for (const k of ['light', 'dark', 'hover', 'active'] as const) { const cs = colorSet(r[k], `${p}.${k}`, errors); if (cs) o[k] = cs }
    if (Object.keys(o).length) elements[id] = o
  }
  return { elements, errors }
}

// ---------- CSS ----------
const fillCss = (f: Fill) => (f.kind === 'solid' ? f.color : `linear-gradient(${f.angle}deg, ${f.from}, ${f.to})`)
const lenCss = (l: Len) => (l === 'auto' ? 'auto' : `${l.v}${l.unit}`)
/** CSS string literal with every character hex-escaped (safe for any emoji/label). */
const cssString = (s: string) => `"${[...s].map((ch) => `\\${ch.codePointAt(0)!.toString(16)} `).join('')}"`
function colorDecls(c: ColorSet | undefined): string[] {
  if (!c) return []
  const out: string[] = []
  if (c.bg) out.push(`background: ${fillCss(c.bg)} !important`)
  if (c.color) out.push(`color: ${c.color} !important`)
  if (c.borderColor) out.push(`border-color: ${c.borderColor} !important`)
  return out
}
export function elementsCss(elements: ElementOverrides): string {
  const rules: string[] = []
  const scope = (mode?: 'light' | 'dark') => `html${mode ? `[data-theme="${mode}"]` : ''}:not([data-route="admin"])`
  for (const [id, o] of Object.entries(elements)) {
    if (!ID_RE.test(id)) continue
    const at = `[data-ui-id="${id}"]`
    const sel = `${scope()} ${at}`
    if (o.hide) { rules.push(`${sel} { display: none !important; }`); continue }
    const b = o.base
    const d = colorDecls(b)
    if (b) {
      if (b.font) d.push(`font-family: '${b.font}', var(--font) !important`)
      if (b.fontSize !== undefined) d.push(`font-size: ${b.fontSize}px !important`)
      if (b.fontWeight !== undefined) d.push(`font-weight: ${b.fontWeight} !important`)
      if (b.padY !== undefined) d.push(`padding-top: ${b.padY}px !important`, `padding-bottom: ${b.padY}px !important`)
      if (b.padX !== undefined) d.push(`padding-left: ${b.padX}px !important`, `padding-right: ${b.padX}px !important`)
      if (b.marY !== undefined) d.push(`margin-top: ${b.marY}px !important`, `margin-bottom: ${b.marY}px !important`)
      if (b.marX !== undefined) d.push(`margin-left: ${b.marX}px !important`, `margin-right: ${b.marX}px !important`)
      if (b.gap !== undefined) d.push(`gap: ${b.gap}px !important`)
      if (b.width !== undefined) d.push(`width: ${lenCss(b.width)} !important`, 'max-width: 100% !important', 'flex: 0 0 auto !important')
      if (b.height !== undefined) d.push(`height: ${lenCss(b.height)} !important`)
      if (b.radius !== undefined) d.push(`border-radius: ${b.radius}px !important`)
      if (b.borderWidth !== undefined) d.push(`border-width: ${b.borderWidth}px !important`, b.borderWidth > 0 ? 'border-style: solid !important' : '')
      if (b.shadow) d.push(`box-shadow: ${SHADOW_CSS[b.shadow]} !important`)
      if (b.opacity !== undefined) d.push(`opacity: ${b.opacity} !important`)
      if (b.order !== undefined) d.push(`order: ${b.order} !important`)
      if (b.tx || b.ty) d.push(`translate: ${b.tx ?? 0}px ${b.ty ?? 0}px !important`)
      if (b.align) d.push(`text-align: ${b.align} !important`, `justify-content: ${b.align === 'left' ? 'flex-start' : b.align === 'right' ? 'flex-end' : 'center'}`)
      if (b.effect && b.effect !== 'none') d.push(`filter: ${EFFECT_CSS[b.effect]} !important`)
    }
    const decl = d.filter(Boolean)
    if (decl.length) rules.push(`${sel} { ${decl.join('; ')}; }`)
    for (const mode of ['light', 'dark'] as const) { const m = colorDecls(o[mode]); if (m.length) rules.push(`${scope(mode)} ${at} { ${m.join('; ')}; }`) }
    const hv = colorDecls(o.hover)
    if (hv.length) rules.push(`@media (hover: hover) { ${sel}:hover { ${hv.join('; ')}; } }`, `${sel}:focus-visible { ${hv.join('; ')}; }`)
    const ac = colorDecls(o.active)
    if (ac.length) rules.push(`${sel}:active, ${sel}[aria-pressed="true"] { ${ac.join('; ')}; }`)
    if (o.icon) {
      rules.push(`${sel} svg, ${sel} .icon { display: none !important; }`)
      if (o.icon !== 'none') rules.push(`${sel}::before { content: ${cssString(o.icon)}; display: inline-block; margin-inline-end: .3em; font-style: normal; }`)
    }
  }
  return rules.join('\n')
}

// ---------- text ----------
let textMap: Record<string, string> = {}
const originals = new WeakMap<Node, string>()
const touched = new Map<Node, string>() // node → id it was changed for
let observer: MutationObserver | null = null
let applying = false

const isAdminRoute = () => document.documentElement.dataset.route === 'admin'
function textTarget(el: Element): Text | null {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) return n as Text
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue?.trim() && !(n.parentElement?.closest('svg')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) })
  return walker.nextNode() as Text | null
}
function applyEl(el: Element) {
  const id = el.getAttribute('data-ui-id')
  if (!id) return
  const want = textMap[id]
  if (want === undefined) return
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.dataset.uiPh === undefined) el.dataset.uiPh = el.placeholder
    if (el.placeholder !== want) el.placeholder = want
    if (el instanceof HTMLInputElement && (el.type === 'submit' || el.type === 'button') && el.value !== want) el.value = want
    return
  }
  if (el.getAttribute('aria-label') !== null && !textTarget(el)) { if (el.getAttribute('aria-label') !== want) el.setAttribute('aria-label', want); return }
  const tn = textTarget(el)
  if (!tn) return
  if (!touched.has(tn)) originals.set(tn, tn.nodeValue ?? '')
  touched.set(tn, id)
  if (tn.nodeValue !== want) tn.nodeValue = want
}
function restoreAll(keep?: (id: string) => boolean) {
  for (const [node, id] of [...touched]) {
    if (keep?.(id)) continue
    const o = originals.get(node)
    if (o !== undefined && node.nodeValue !== o) node.nodeValue = o
    touched.delete(node)
  }
  document.querySelectorAll<HTMLInputElement>('[data-ui-ph]').forEach((el) => {
    const id = el.getAttribute('data-ui-id') ?? ''
    if (keep?.(id)) return
    el.placeholder = el.dataset.uiPh ?? ''
    delete el.dataset.uiPh
  })
}
function applyAll(root: ParentNode = document) {
  if (isAdminRoute()) return
  const ids = Object.keys(textMap)
  if (!ids.length) return
  applying = true
  try {
    if (root instanceof Element && root.hasAttribute('data-ui-id')) applyEl(root)
    root.querySelectorAll?.(ids.map((id) => `[data-ui-id="${id}"]`).join(',')).forEach(applyEl)
  } finally { applying = false }
}
function onMutations(list: MutationRecord[]) {
  if (applying) return
  if (isAdminRoute()) { if (touched.size) restoreAll(); return }
  if (!Object.keys(textMap).length) return
  applying = true
  try {
    for (const m of list) {
      if (m.type === 'characterData') {
        const node = m.target
        const id = touched.get(node)
        if (id !== undefined && textMap[id] !== undefined && node.nodeValue !== textMap[id]) { originals.set(node, node.nodeValue ?? ''); node.nodeValue = textMap[id] }
      } else if (m.type === 'childList') {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) { const el = n as Element; if (el.hasAttribute('data-ui-id') && textMap[el.getAttribute('data-ui-id')!] !== undefined) applyEl(el); el.querySelectorAll?.('[data-ui-id]').forEach((c) => { if (textMap[c.getAttribute('data-ui-id')!] !== undefined) applyEl(c) }) }
          else if (n.nodeType === 3 && n.parentElement) { const host = n.parentElement.closest('[data-ui-id]'); if (host && textMap[host.getAttribute('data-ui-id')!] !== undefined) applyEl(host) }
        })
      } else if (m.type === 'attributes' && m.target === document.documentElement) {
        applying = false
        applyAll()
        applying = true
      }
    }
  } finally { applying = false }
}

let lastElements: ElementOverrides = {}
function resolveTexts(): Record<string, string> {
  const loc = getLocale()
  const out: Record<string, string> = {}
  for (const [id, o] of Object.entries(lastElements)) {
    const s = o.text?.[loc] ?? o.text?.all
    if (s && !o.hide) out[id] = s
  }
  return out
}
function setTexts() {
  const next = resolveTexts()
  restoreAll((id) => next[id] !== undefined)
  textMap = next
  applyAll()
}

export function isSafeUi(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('safe-ui')
    if (q === '1') sessionStorage.setItem('pingo-safe-ui', '1')
    if (q === '0') sessionStorage.removeItem('pingo-safe-ui')
    return sessionStorage.getItem('pingo-safe-ui') === '1'
  } catch { return false }
}

let localeUnsub: (() => void) | null = null
/** Applies (or clears) all element overrides on this page. */
export function applyElements(raw: unknown) {
  if (typeof document === 'undefined') return
  const elements = isSafeUi() ? {} : validateElements(raw).elements
  lastElements = elements
  let style = document.getElementById('pingo-elements') as HTMLStyleElement | null
  if (!style) { style = document.createElement('style'); style.id = 'pingo-elements'; document.head.appendChild(style) }
  const css = elementsCss(elements)
  if (style.textContent !== css) style.textContent = css
  for (const o of Object.values(elements)) if (o.base?.font) ensureFont(o.base.font)
  if (!observer) {
    observer = new MutationObserver(onMutations)
    observer.observe(document.body, { subtree: true, childList: true, characterData: true })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-route'] })
    localeUnsub = onLocaleChange(() => queueMicrotask(setTexts))
  }
  setTexts()
}
export function stopElements() { observer?.disconnect(); observer = null; localeUnsub?.(); localeUnsub = null }

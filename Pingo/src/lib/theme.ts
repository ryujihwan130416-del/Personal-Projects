/**
 * Design tokens for the admin's real-time UI editor.
 * Every token is optional: an empty value means "use the built-in default", so a broken or partial config
 * always falls back to the stock look. Values are validated before they ever reach the page.
 */
export type Mode = 'light' | 'dark'

export const COLOR_TOKENS = [
  { key: 'accent', label: 'Primary / accent', group: 'Brand' },
  { key: 'accent2', label: 'Accent gradient end', group: 'Brand' },
  { key: 'onAccent', label: 'Text on accent', group: 'Brand' },
  { key: 'bg', label: 'Page background', group: 'Background' },
  { key: 'stop1', label: 'Gradient stop 1 (top left)', group: 'Background' },
  { key: 'stop2', label: 'Gradient stop 2 (top right)', group: 'Background' },
  { key: 'stop3', label: 'Gradient stop 3 (bottom right)', group: 'Background' },
  { key: 'stop4', label: 'Gradient stop 4 (bottom left)', group: 'Background' },
  { key: 'surface', label: 'Surface / glass colour', group: 'Surfaces' },
  { key: 'chip', label: 'Chips & hover', group: 'Surfaces' },
  { key: 'input', label: 'Input fields', group: 'Surfaces' },
  { key: 'border', label: 'Borders & outlines', group: 'Surfaces' },
  { key: 'text', label: 'Main text', group: 'Text' },
  { key: 'text2', label: 'Secondary text', group: 'Text' },
  { key: 'text3', label: 'Muted text', group: 'Text' },
  { key: 'link', label: 'Links', group: 'Text' },
  { key: 'mine', label: 'My bubble', group: 'Chat bubbles' },
  { key: 'mine2', label: 'My bubble gradient end', group: 'Chat bubbles' },
  { key: 'mineText', label: 'My bubble text', group: 'Chat bubbles' },
  { key: 'theirs', label: 'Their bubble', group: 'Chat bubbles' },
  { key: 'theirsText', label: 'Their bubble text', group: 'Chat bubbles' },
  { key: 'danger', label: 'Danger / delete', group: 'Status' },
  { key: 'online', label: 'Online dot', group: 'Status' },
] as const
export type ColorKey = (typeof COLOR_TOKENS)[number]['key']

export interface ModeTokens extends Partial<Record<ColorKey, string>> {
  /** 0–200 (%): how strong the background gradient blobs are. */
  bgStrength?: number
  /** 30–100 (%): glass panel opacity. */
  glass?: number
}

export interface SharedTokens {
  /** Corner roundness multiplier, 0–2. */
  radius?: number
  /** Hard (offset) shadow multiplier, 0–2. */
  shadow?: number
  /** Soft drop shadow strength, 0–2. */
  softShadow?: number
  /** Glass blur multiplier, 0–2. */
  blur?: number
  /** Google Fonts family (from FONTS) or '' for the built-in Nunito. */
  font?: string
  /** Base font size in px (13–19), 15 is the stock size. */
  fontSize?: number
  /** Spacing multiplier, 0.75–1.3. */
  density?: number
}

export interface ThemeTokens {
  light: ModeTokens
  dark: ModeTokens
  shared: SharedTokens
}

/** Built-in look, shown in pickers when a token is empty. Mirrors index.css. */
export const DEFAULTS: Record<Mode, Record<ColorKey, string>> & { shared: Required<SharedTokens>; bgStrength: number; glass: Record<Mode, number> } = {
  light: {
    accent: '#ff4d3a', accent2: '#ff7a55', onAccent: '#fffdf6', bg: '#fff3d6',
    stop1: '#ff4d3a', stop2: '#c8f542', stop3: '#7b5cff', stop4: '#3d9cff',
    surface: '#fffdf6', chip: '#ffe8bf', input: '#fffdf6', border: '#1a1530',
    text: '#1a1530', text2: '#5a5270', text3: '#8a8298', link: '#3d9cff',
    mine: '#ff4d3a', mine2: '#ff7a55', mineText: '#fffdf6', theirs: '#fffdf6', theirsText: '#1a1530',
    danger: '#d61f3a', online: '#22a85a',
  },
  dark: {
    accent: '#ff6d55', accent2: '#ff7a55', onAccent: '#1a1530', bg: '#16121f',
    stop1: '#ff6d55', stop2: '#9b86ff', stop3: '#5eb0ff', stop4: '#d4ff5e',
    surface: '#241e32', chip: '#2a2438', input: '#1c1826', border: '#5b5466',
    text: '#f8f1e3', text2: '#c8bdb0', text3: '#8e8578', link: '#5eb0ff',
    mine: '#ff6d55', mine2: '#ff7a55', mineText: '#1a1530', theirs: '#2a2438', theirsText: '#f8f1e3',
    danger: '#ff5a70', online: '#3ddc82',
  },
  shared: { radius: 1, shadow: 1, softShadow: 1, blur: 1, font: '', fontSize: 15, density: 1 },
  bgStrength: 100,
  glass: { light: 84, dark: 78 },
}

/** Curated Google Fonts with Latin + (where noted) Korean coverage. */
export const FONTS: { family: string; note: string; weights: string }[] = [
  { family: '', note: 'Nunito (built-in)', weights: '' },
  { family: 'Inter', note: 'Clean UI sans', weights: '400;600;700;800' },
  { family: 'Poppins', note: 'Geometric', weights: '400;600;700;800' },
  { family: 'DM Sans', note: 'Friendly sans', weights: '400;600;700;800' },
  { family: 'Outfit', note: 'Rounded geometric', weights: '400;600;700;800' },
  { family: 'Quicksand', note: 'Soft rounded', weights: '400;600;700' },
  { family: 'Fredoka', note: 'Playful rounded', weights: '400;600;700' },
  { family: 'Baloo 2', note: 'Bubbly', weights: '400;600;700;800' },
  { family: 'Rubik', note: 'Slightly rounded', weights: '400;600;700;800' },
  { family: 'Space Grotesk', note: 'Techy', weights: '400;600;700' },
  { family: 'Comfortaa', note: 'Round display', weights: '400;600;700' },
  { family: 'Lexend', note: 'Very readable', weights: '400;600;700;800' },
  { family: 'Pacifico', note: 'Fun script (names)', weights: '' },
  { family: 'Noto Sans KR', note: 'Korean + Latin', weights: '400;600;700;800' },
  { family: 'IBM Plex Sans KR', note: 'Korean + Latin', weights: '400;600;700' },
  { family: 'Gowun Dodum', note: 'Korean, soft', weights: '400' },
  { family: 'Jua', note: 'Korean, playful', weights: '400' },
  { family: 'Do Hyeon', note: 'Korean, bold display', weights: '400' },
  { family: 'Nanum Gothic', note: 'Korean classic', weights: '400;700;800' },
]

export const EMPTY_THEME: ThemeTokens = { light: {}, dark: {}, shared: {} }

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
export function isColor(v: unknown): v is string {
  if (typeof v !== 'string' || !v || v.length > 60) return false
  if (HEX.test(v)) return true
  if (!/^(rgb|rgba|hsl|hsla)\([\d\s.,%/+-]+\)$/i.test(v)) return false
  try { return typeof CSS !== 'undefined' && CSS.supports('color', v) } catch { return false }
}
function num(v: unknown, min: number, max: number): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined
}

/** Keeps only valid values; returns the clean copy plus a list of what was dropped. */
export function validateTheme(raw: unknown): { theme: ThemeTokens; errors: string[] } {
  const errors: string[] = []
  const out: ThemeTokens = { light: {}, dark: {}, shared: {} }
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  for (const mode of ['light', 'dark'] as const) {
    const m = (r[mode] && typeof r[mode] === 'object' ? r[mode] : {}) as Record<string, unknown>
    for (const { key } of COLOR_TOKENS) {
      const v = m[key]
      if (v === undefined || v === '' || v === null) continue
      if (isColor(v)) out[mode][key] = v
      else errors.push(`${mode}.${key}: "${String(v).slice(0, 30)}" is not a colour`)
    }
    if (m.bgStrength !== undefined) { const n = num(m.bgStrength, 0, 200); if (n === undefined) errors.push(`${mode}.bgStrength must be 0–200`); else out[mode].bgStrength = n }
    if (m.glass !== undefined) { const n = num(m.glass, 30, 100); if (n === undefined) errors.push(`${mode}.glass must be 30–100`); else out[mode].glass = n }
  }
  const s = (r.shared && typeof r.shared === 'object' ? r.shared : {}) as Record<string, unknown>
  const ranges: [keyof SharedTokens, number, number][] = [['radius', 0, 2], ['shadow', 0, 2], ['softShadow', 0, 2], ['blur', 0, 2], ['fontSize', 13, 19], ['density', 0.75, 1.3]]
  for (const [k, min, max] of ranges) {
    if (s[k] === undefined) continue
    const n = num(s[k], min, max)
    if (n === undefined) errors.push(`shared.${k} must be ${min}–${max}`)
    else (out.shared as Record<string, number>)[k] = n
  }
  if (s.font !== undefined && s.font !== '') {
    if (typeof s.font === 'string' && FONTS.some((f) => f.family === s.font)) out.shared.font = s.font
    else errors.push(`shared.font: "${String(s.font).slice(0, 30)}" is not in the font list`)
  }
  return { theme: out, errors }
}

function rgbOf(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null
  let h = hex.slice(1)
  if (h.length <= 4) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function lum([r, g, b]: [number, number, number]) {
  const f = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
/** WCAG contrast ratio for two hex colours, or 0 when either isn't plain hex. */
export function contrast(a: string, b: string): number {
  const x = rgbOf(a), y = rgbOf(b)
  if (!x || !y) return 0
  const [hi, lo] = [lum(x), lum(y)].sort((p, q) => q - p)
  return (hi + 0.05) / (lo + 0.05)
}

/** Token → value with defaults filled in (for pickers and contrast checks). */
export function resolved(theme: ThemeTokens, mode: Mode, key: ColorKey): string {
  const v = theme[mode][key]
  if (v) return v
  if (key === 'mine' || key === 'stop1') return theme[mode].accent || DEFAULTS[mode][key]
  if (key === 'mine2') return theme[mode].accent2 || DEFAULTS[mode][key]
  if (key === 'mineText') return theme[mode].onAccent || DEFAULTS[mode][key]
  return DEFAULTS[mode][key]
}

function modeCss(t: ModeTokens, mode: Mode): string {
  const v: string[] = []
  const put = (name: string, val?: string | number) => { if (val !== undefined && val !== '') v.push(`${name}: ${val}`) }
  if (t.accent) ['--coral', '--accent', '--accent-strong', '--unread'].forEach((n) => put(n, t.accent))
  if (t.accent2) ['--coral-2', '--accent-2'].forEach((n) => put(n, t.accent2))
  put('--on-accent', t.onAccent)
  put('--bubble-out', t.mine || t.accent)
  put('--bubble-out-2', t.mine2 || t.accent2)
  put('--bubble-out-text', t.mineText || t.onAccent)
  put('--bubble-in-custom', t.theirs)
  put('--bubble-in-text', t.theirsText)
  put('--bg', t.bg)
  put('--bg-s1', t.stop1); put('--bg-s2', t.stop2); put('--bg-s3', t.stop3); put('--bg-s4', t.stop4)
  if (t.bgStrength !== undefined) put('--bg-k', (t.bgStrength / 100).toFixed(2))
  put('--bg-elevated', t.surface)
  if (t.chip) { put('--bg-chip', t.chip); put('--bg-hover', t.chip) }
  put('--bg-input', t.input)
  if (t.border) { put('--border', t.border); put('--hairline', `color-mix(in srgb, ${t.border} 14%, transparent)`) }
  if (t.text) { put('--text', t.text); put('--ink', t.text); put('--bubble-in-text', t.theirsText || t.text) }
  put('--text-secondary', t.text2)
  put('--text-tertiary', t.text3)
  put('--sky', t.link)
  put('--danger', t.danger)
  put('--online', t.online)
  if (t.glass !== undefined) { put('--glass-a', `${t.glass}%`); put('--glass-b', `${Math.min(100, t.glass + 10)}%`) }
  if (!v.length) return ''
  return `html:root[data-theme='${mode}'] { ${v.join('; ')}; }`
}

export function fontStack(family?: string) {
  const base = "var(--font-cjk), 'Segoe UI', sans-serif"
  return family ? `'${family}', 'Nunito', ${base}` : `'Nunito', ${base}`
}

/** CSS text for a validated theme. Empty string = stock look. */
export function themeCss(theme: ThemeTokens): string {
  const out = [modeCss(theme.light, 'light'), modeCss(theme.dark, 'dark')].filter(Boolean)
  const s = theme.shared
  const v: string[] = []
  if (s.radius !== undefined) v.push(`--rad-k: ${s.radius}`)
  if (s.shadow !== undefined) v.push(`--sh-k: ${s.shadow}`)
  if (s.blur !== undefined) v.push(`--blur-k: ${s.blur}`)
  if (s.fontSize !== undefined) v.push(`--fs-k: ${(s.fontSize / 15).toFixed(3)}`)
  if (s.density !== undefined) v.push(`--dens-k: ${s.density}`)
  if (s.font) v.push(`--font: ${fontStack(s.font)}`)
  if (v.length) out.push(`html:root { ${v.join('; ')}; }`)
  if (s.softShadow !== undefined) {
    const k = s.softShadow
    out.push(`html:root[data-theme='light'] { --lift: calc(4px * var(--sh-k, 1)) calc(4px * var(--sh-k, 1)) 0 var(--border), 0 22px 44px -26px rgba(26, 21, 48, ${(0.45 * k).toFixed(2)}); --lift-sm: calc(3px * var(--sh-k, 1)) calc(3px * var(--sh-k, 1)) 0 var(--border), 0 12px 26px -18px rgba(26, 21, 48, ${(0.4 * k).toFixed(2)}); }`)
    out.push(`html:root[data-theme='dark'] { --lift: calc(4px * var(--sh-k, 1)) calc(4px * var(--sh-k, 1)) 0 rgba(0, 0, 0, 0.55), 0 24px 48px -24px rgba(0, 0, 0, ${(0.8 * k).toFixed(2)}); --lift-sm: calc(3px * var(--sh-k, 1)) calc(3px * var(--sh-k, 1)) 0 rgba(0, 0, 0, 0.5), 0 14px 28px -18px rgba(0, 0, 0, ${(0.7 * k).toFixed(2)}); }`)
  }
  return out.join('\n')
}

const loadedFonts = new Set<string>()
export function ensureFont(family?: string) {
  if (!family || loadedFonts.has(family) || typeof document === 'undefined') return
  const f = FONTS.find((x) => x.family === family)
  if (!f) return
  loadedFonts.add(family)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}${f.weights ? `:wght@${f.weights}` : ''}&display=swap`
  link.dataset.pingoFont = family
  document.head.appendChild(link)
}

/** Writes the theme into one <style> tag (no reload). */
export function applyThemeTokens(theme: ThemeTokens) {
  if (typeof document === 'undefined') return
  let el = document.getElementById('pingo-theme') as HTMLStyleElement | null
  if (!el) { el = document.createElement('style'); el.id = 'pingo-theme'; document.head.appendChild(el) }
  const css = themeCss(theme)
  if (el.textContent !== css) el.textContent = css
  ensureFont(theme.shared.font)
  const accent = theme[(document.documentElement.dataset.theme as Mode) || 'light']?.accent
  if (accent) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', accent)
}

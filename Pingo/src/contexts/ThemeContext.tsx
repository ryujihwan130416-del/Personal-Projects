import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ColorScheme } from '../types'

const KEY = 'dmly-theme'
const ACCENT_KEY = 'pingo-accent'

/** Accent palettes: main colour, a second stop for gradients, and readable text on top. */
export const ACCENTS = [
  { id: 'coral', name: 'Coral', c: '#ff4d3a', c2: '#ff8a3d', on: '#fffdf6' },
  { id: 'sky', name: 'Sky', c: '#2f8cff', c2: '#38c6ff', on: '#ffffff' },
  { id: 'violet', name: 'Violet', c: '#7b5cff', c2: '#c05cff', on: '#ffffff' },
  { id: 'mint', name: 'Mint', c: '#14b886', c2: '#5ee0a0', on: '#06231a' },
  { id: 'pink', name: 'Bubblegum', c: '#ff4f9a', c2: '#ff8ac2', on: '#ffffff' },
  { id: 'sun', name: 'Sunshine', c: '#f5a300', c2: '#ffd23f', on: '#1a1530' },
] as const
/** 'default' = no personal pick: the app-wide accent from the admin UI editor (or stock coral) applies. */
export type AccentId = (typeof ACCENTS)[number]['id'] | 'default'

type ThemeCtx = {
  theme: ColorScheme
  accent: AccentId
  toggle: () => void
  setTheme: (t: ColorScheme) => void
  setAccent: (a: AccentId) => void
}

const Ctx = createContext<ThemeCtx | null>(null)

function initialTheme(): ColorScheme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* ignore */ }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch { /* ignore */ }
  return 'light'
}

function initialAccent(): AccentId {
  try {
    const a = localStorage.getItem(ACCENT_KEY)
    // Older builds always saved 'coral'; treat that as "no pick" so app-wide theme changes reach those people.
    if (a !== 'coral' && ACCENTS.some((x) => x.id === a)) return a as AccentId
  } catch { /* ignore */ }
  return 'default'
}

const ACCENT_PROPS = ['--coral', '--accent', '--accent-2', '--accent-strong', '--on-accent', '--bubble-out', '--bubble-out-2', '--bubble-out-text', '--unread']

export function applyAccent(id: AccentId) {
  const r = document.documentElement.style
  if (id === 'default') {
    ACCENT_PROPS.forEach((p) => r.removeProperty(p))
    document.documentElement.dataset.accent = 'default'
    return
  }
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0]
  r.setProperty('--coral', a.c)
  r.setProperty('--accent', a.c)
  r.setProperty('--accent-2', a.c2)
  r.setProperty('--accent-strong', a.c)
  r.setProperty('--on-accent', a.on)
  r.setProperty('--bubble-out', a.c)
  r.setProperty('--bubble-out-2', a.c2)
  r.setProperty('--bubble-out-text', a.on)
  r.setProperty('--unread', a.c)
  document.documentElement.dataset.accent = a.id
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', a.c)
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ColorScheme>(initialTheme)
  const [accent, setAccentState] = useState<AccentId>(initialAccent)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => {
    applyAccent(accent)
    try { if (accent === 'default') localStorage.removeItem(ACCENT_KEY); else localStorage.setItem(ACCENT_KEY, accent) } catch { /* ignore */ }
  }, [accent])

  const setTheme = useCallback((t: ColorScheme) => setThemeState(t), [])
  const setAccent = useCallback((a: AccentId) => setAccentState(a), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ theme, accent, toggle, setTheme, setAccent }), [theme, accent, toggle, setTheme, setAccent])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTheme() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme')
  return ctx
}

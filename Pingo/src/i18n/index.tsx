import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { createContext, useContext } from 'react'
import { catchWordsEn, chainWordsEn, en, quizEn } from './en'
import { catchWordsKo, ko, quizKo } from './ko'
import { PHRASES } from './phrases'
import { catchWordsEs, es, quizEs } from './es'
import { catchWordsZh, quizZh, zh } from './zh'
import { catchWordsJa, ja, quizJa } from './ja'
import { catchWordsFr, fr, quizFr } from './fr'

export type Locale = 'en' | 'es' | 'zh' | 'ko' | 'ja' | 'fr'
export const LOCALES: { id: Locale; name: string; tag: string }[] = [
  { id: 'en', name: 'English', tag: 'en-US' },
  { id: 'es', name: 'Español', tag: 'es-ES' },
  { id: 'zh', name: '简体中文', tag: 'zh-CN' },
  { id: 'ko', name: '한국어', tag: 'ko-KR' },
  { id: 'ja', name: '日本語', tag: 'ja-JP' },
  { id: 'fr', name: 'Français', tag: 'fr-FR' },
]
export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v)
/** BCP-47 tag for Intl date/number formatting in the active language. */
export function dateLocale(): string { return LOCALES.find((l) => l.id === locale)?.tag ?? 'en-US' }
/** First visit: pick the closest supported browser language, else English. */
export function detectLocale(): Locale {
  try {
    for (const raw of navigator.languages ?? [navigator.language]) {
      const base = String(raw).toLowerCase().split('-')[0]
      if (isLocale(base)) return base
    }
  } catch { /* ignore */ }
  return 'en'
}
export type Dict = typeof en
export type Translate = (key: string, vars?: Record<string, string | number>) => string

const KEY = 'dmly-locale'

function readStored(): Locale {
  try {
    const v = localStorage.getItem(KEY)
    if (isLocale(v)) return v
  } catch { /* ignore */ }
  return detectLocale()
}

let locale: Locale = typeof window === 'undefined' ? 'en' : readStored()
const listeners = new Set<() => void>()

const DICTS: Record<Locale, unknown> = { en, es, zh, ko, ja, fr }
function dict(): Dict {
  return (DICTS[locale] ?? en) as Dict
}

function lookup(obj: unknown, key: string): unknown {
  let cur: unknown = obj
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in cur) cur = (cur as Record<string, unknown>)[part]
    else return undefined
  }
  return cur
}

/** Load a Noto CJK web font for zh/ja/ko so devices without local CJK fonts still render nicely (Google Fonts splits by unicode-range). */
const CJK_FONT: Partial<Record<Locale, string>> = { zh: 'Noto+Sans+SC', ja: 'Noto+Sans+JP', ko: 'Noto+Sans+KR' }
function ensureCjkFont(l: Locale) {
  const fam = CJK_FONT[l]
  if (!fam || typeof document === 'undefined' || document.getElementById(`cjk-${l}`)) return
  const link = document.createElement('link')
  link.id = `cjk-${l}`
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${fam}:wght@500;700;800&display=swap`
  document.head.appendChild(link)
}
function applyDocLang() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = dateLocale()
  ensureCjkFont(locale)
}

export function getLocale(): Locale {
  return locale
}

export function setLocale(next: Locale, opts?: { persist?: boolean }) {
  if (!isLocale(next)) return
  locale = next
  if (opts?.persist !== false) try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  applyDocLang()
  listeners.forEach((fn) => fn())
}

/** App-wide copy overrides from the admin UI editor (keyed like 'auth.tagline'). */
let overrides: Record<string, string> = {}
let rev = 0
export function setCopyOverrides(next: Record<string, string>) {
  const same = JSON.stringify(next) === JSON.stringify(overrides)
  if (same) return
  overrides = next
  rev++
  listeners.forEach((fn) => fn())
}
/** The stock (non-overridden) English/Korean text for a key, or undefined. */
export function baseText(key: string, in_?: Locale): string | undefined {
  const found = lookup(in_ ? DICTS[in_] : dict(), key) ?? lookup(en, key)
  return typeof found === 'string' ? found : undefined
}
export function allKeys(): string[] {
  const out: string[] = []
  const walk = (o: unknown, pre: string) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string') out.push(pre + k)
      else walk(v, `${pre}${k}.`)
    }
  }
  walk(en, '')
  return out
}

export function t(key: string, vars?: Record<string, string | number>): string {
  // Admin copy overrides: a per-language one ("key@es") wins over an all-languages one ("key").
  const ov = overrides[`${key}@${locale}`] || overrides[key]
  let found = ov ? ov : lookup(dict(), key)
  if (typeof found !== 'string') found = lookup(en, key)
  let s = typeof found === 'string' ? found : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

/** Some app-written previews (e.g. "Unsent message") are stored as text; show them in the viewer's language. */
const STORED_KEYS = ['chat.unsentShort', 'chat.unsent']
export function localizeStored(text: string): string {
  for (const key of STORED_KEYS) for (const d of Object.values(DICTS)) if (lookup(d, key) === text) return t(key)
  return text
}

/** Phrase-style translation for newer UI strings: the English text is the key. */
export function tx(en: string, vars?: Record<string, string | number>): string {
  const ov = overrides[`${en}@${locale}`] || overrides[en]
  let s = ov || (locale === 'en' ? en : phraseDict()[en] ?? en)
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}
function phraseDict(): Record<string, string> { return (PHRASES as Record<string, Record<string, string>>)[locale] ?? {} }

const QUIZ: Partial<Record<Locale, typeof quizEn>> = { en: quizEn, ko: quizKo, es: quizEs, zh: quizZh, ja: quizJa, fr: quizFr }
const CATCH: Partial<Record<Locale, string[]>> = { en: catchWordsEn, ko: catchWordsKo, es: catchWordsEs, zh: catchWordsZh, ja: catchWordsJa, fr: catchWordsFr }
export function getQuiz() {
  return QUIZ[getLocale()] ?? quizEn
}

export function getCatchWords() {
  return CATCH[getLocale()] ?? catchWordsEn
}

export function getChainWords(): string[] {
  return chainWordsEn
}

const I18nContext = createContext<{ locale: Locale; t: Translate; setLocale: (l: Locale) => void }>({
  locale,
  t,
  setLocale,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<Locale>(locale)
  const [ver, setVer] = useState(rev)
  useEffect(() => {
    const fn = () => { setLoc(locale); setVer(rev) }
    listeners.add(fn)
    applyDocLang()
    return () => { listeners.delete(fn) }
  }, [])
  const translate = useCallback<Translate>((key, vars) => t(key, vars), [loc, ver])
  const change = useCallback((next: Locale) => { setLocale(next) }, [])
  return (
    <I18nContext.Provider value={{ locale: loc, t: translate, setLocale: change }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useT(): Translate {
  return useContext(I18nContext).t
}

export function useLocale() {
  return useContext(I18nContext)
}

export { chainWordsEn }

/** Non-React subscription to language / copy changes (used by the element text overrides). */
export function onLocaleChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

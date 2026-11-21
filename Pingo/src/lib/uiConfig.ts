import { doc, onSnapshot, type Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../firebase/app'
import { getLocale, isLocale, setCopyOverrides, setLocale } from '../i18n'
import { applyThemeTokens, validateTheme, type Mode, type ThemeTokens } from './theme'
import { applyElements, type ElementOverrides } from './uiElements'
import { INSPECT_MSG, PICK_MSG, countOf, requestTree, setInspect } from './inspector'

/** App-wide look, copy & layout set from the admin console's UI editor (dmly/app/config/ui, publicly readable). */
export interface UiConfig {
  tagline?: string
  signupTagline?: string
  defaultAccent?: string
  defaultTheme?: 'light' | 'dark' | ''
  hiddenTabs?: string[]
  emptyTitle?: string
  emptyBody?: string
  /** Design tokens for light + dark (see lib/theme). */
  theme?: ThemeTokens
  /** Copy overrides keyed by i18n key, e.g. { 'auth.tagline': 'Hi!' }. */
  copy?: Record<string, string>
  /** Per-element overrides from the inspector, keyed by data-ui-id. */
  elements?: ElementOverrides
  version?: number
  updatedAt?: Timestamp | null
  updatedBy?: string
}

export const PREVIEW_MSG = 'pingo-ui-preview'
export const PREVIEW_READY = 'pingo-ui-preview-ready'

let live: UiConfig = {}
let preview: UiConfig | null = null
let previewMode: Mode | null = null
let started = false
const subs = new Set<(c: UiConfig) => void>()
const current = () => preview ?? live
function emit() {
  const c = current()
  applyUi(c)
  if (previewMode && document.documentElement.dataset.theme !== previewMode) document.documentElement.dataset.theme = previewMode
  subs.forEach((f) => f(c))
}
function start() {
  if (started) return
  started = true
  onSnapshot(doc(db, ...fsCol('config', 'ui')), (s) => { live = (s.data() as UiConfig) ?? {}; emit() }, () => { started = false })
}

/** Legacy single-purpose text fields map onto copy keys; explicit copy wins. */
export function effectiveCopy(c: UiConfig): Record<string, string> {
  const out: Record<string, string> = {}
  if (c.tagline) out['auth.tagline'] = c.tagline
  if (c.signupTagline) out['auth.signupTagline'] = c.signupTagline
  if (c.emptyTitle) out['shell.pickTitle'] = c.emptyTitle
  if (c.emptyBody) out['shell.pickBody'] = c.emptyBody
  for (const [k, v] of Object.entries(c.copy ?? {})) if (typeof v === 'string' && v.trim() && v.length <= 300) out[k] = v
  return out
}

function applyUi(c: UiConfig) {
  applyThemeTokens(validateTheme(c.theme).theme)
  setCopyOverrides(effectiveCopy(c))
  applyElements(c.elements)
}

export function useUiConfig() {
  const [c, setC] = useState(current)
  useEffect(() => { start(); subs.add(setC); setC(current()); return () => { subs.delete(setC) } }, [])
  return c
}

/** Mounted once at the app root: keeps the theme live, and inside the editor's preview iframe listens for drafts. */
export function UiEngine() {
  useEffect(() => {
    start()
    applyUi(current())
    if (window.parent === window) return
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return
      const d = e.data as { type?: string; config?: UiConfig; mode?: Mode; lang?: string; on?: boolean; selected?: string[] | string }
      if (d?.type === INSPECT_MSG) {
        setInspect(!!d.on, d.selected)
        const sel = Array.isArray(d.selected) ? d.selected[d.selected.length - 1] ?? '' : d.selected ?? ''
        window.parent.postMessage({ type: PICK_MSG + '-count', id: sel, count: sel ? countOf(sel) : 0 }, location.origin)
        requestTree()
        return
      }
      if (d?.type !== PREVIEW_MSG) return
      preview = d.config ?? null
      if (d.mode === 'light' || d.mode === 'dark') previewMode = d.mode
      // Preview in the language the editor is working on, without changing the admin's saved language.
      if (isLocale(d.lang) && d.lang !== getLocale()) setLocale(d.lang, { persist: false })
      emit()
    }
    // The app's own theme sync must not undo the mode the editor is previewing.
    const mo = new MutationObserver(() => { if (previewMode && document.documentElement.dataset.theme !== previewMode) document.documentElement.dataset.theme = previewMode })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ type: PREVIEW_READY }, location.origin)
    return () => { window.removeEventListener('message', onMsg); mo.disconnect(); setInspect(false) }
  }, [])
  return null
}

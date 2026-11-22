import { adminConfirm, at } from './adminI18n'
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { db, fsCol } from '../../firebase/app'
import { LOCALES, allKeys, baseText, getLocale, isLocale, type Locale } from '../../i18n'
import { COLOR_TOKENS, DEFAULTS, EMPTY_THEME, FONTS, contrast, ensureFont, isColor, resolved, validateTheme, type ColorKey, type Mode, type SharedTokens, type ThemeTokens } from '../../lib/theme'
import { PREVIEW_MSG, PREVIEW_READY, effectiveCopy, useUiConfig, type UiConfig } from '../../lib/uiConfig'
import { validateElements, type ElementOverride, type ElementOverrides } from '../../lib/uiElements'
import { INSPECT_MSG, KEY_MSG, PICK_MSG, RECT_MSG, TREE_MSG, XFORM_MSG, type PickInfo, type TreeNode, type XForm } from '../../lib/inspector'
import { CanvasToolbar, type StyleClip } from './CanvasToolbar'
import { ElementInspector } from './ElementInspector'
import { useAdmin } from './shared'

/** What the editor edits and publishes (config/ui minus bookkeeping). */
interface Draft {
  theme: ThemeTokens
  copy: Record<string, string>
  hiddenTabs: string[]
  defaultTheme: '' | 'light' | 'dark'
  /** Per-element overrides keyed by data-ui-id. */
  elements: ElementOverrides
}
type Device = 'desktop' | 'tablet' | 'mobile' | 'landscape'
const DEVICES: Record<Device, { w: number; h: number; icon: string; label: string }> = {
  desktop: { w: 1280, h: 800, icon: '🖥️', label: 'Desktop' },
  tablet: { w: 820, h: 1180, icon: '📟', label: 'Tablet' },
  mobile: { w: 390, h: 844, icon: '📱', label: 'Phone' },
  landscape: { w: 844, h: 390, icon: '📱↔', label: 'Phone landscape' },
}
type LeftTab = 'screens' | 'layers' | 'styles' | 'brand' | 'text'
interface HistoryRow { id: string; version: number; note: string; at: Timestamp | null; by: string; config: Draft }

const DRAFT_KEY = 'pingo-ui-draft'
const HISTORY_MAX = 10
const TABS = [['feed', 'Feed'], ['calendar', 'Calendar'], ['games', 'Games']] as const
const COPY_KEYS: [string, string][] = [
  ['app.name', 'App name (header & login)'],
  ['auth.tagline', 'Login tagline'],
  ['auth.signupTagline', 'Sign-up tagline'],
  ['shell.pickTitle', 'Desktop empty state — title'],
  ['shell.pickBody', 'Desktop empty state — text'],
  ['inbox.emptyInboxTitle', 'Empty inbox — title'],
  ['inbox.emptyInboxBody', 'Empty inbox — text'],
  ['chat.placeholder', 'Message box placeholder'],
  ['nav.chats', 'Tab: Chats'], ['nav.feed', 'Tab: Feed'], ['nav.calendar', 'Tab: Calendar'], ['nav.games', 'Tab: Games'], ['nav.profile', 'Tab: Profile'],
]
const PRESETS: { name: string; light: Partial<Record<ColorKey, string>>; dark: Partial<Record<ColorKey, string>> }[] = [
  { name: 'Ocean', light: { accent: '#2f8cff', accent2: '#38c6ff', onAccent: '#ffffff', bg: '#e9f4ff', stop1: '#2f8cff', stop2: '#5ee0d0', stop3: '#7b5cff', stop4: '#38c6ff', surface: '#fbfdff', chip: '#dcecff' }, dark: { accent: '#5eb0ff', accent2: '#38c6ff', onAccent: '#071a2c', bg: '#0c1422', surface: '#16233a', chip: '#1d2c47', input: '#111c2e' } },
  { name: 'Forest', light: { accent: '#14b886', accent2: '#5ee0a0', onAccent: '#06231a', bg: '#eefaf2', stop1: '#14b886', stop2: '#d4f542', stop3: '#2fa36b', stop4: '#5ec4ff', surface: '#fbfffc', chip: '#d8f3e3' }, dark: { accent: '#3ddc9a', accent2: '#8ef0b8', onAccent: '#06231a', bg: '#0d1a14', surface: '#152a20', chip: '#1c3529', input: '#10211a' } },
  { name: 'Candy', light: { accent: '#ff4f9a', accent2: '#ff8ac2', onAccent: '#ffffff', bg: '#fff0f7', stop1: '#ff4f9a', stop2: '#ffd23f', stop3: '#c05cff', stop4: '#38c6ff', surface: '#fffafd', chip: '#ffe0ef' }, dark: { accent: '#ff70ad', accent2: '#ffa0cf', onAccent: '#2a0716', bg: '#1d0f18', surface: '#2c1824', chip: '#3a1f30', input: '#231420' } },
  { name: 'Midnight', light: { accent: '#7b5cff', accent2: '#c05cff', onAccent: '#ffffff', bg: '#f3f0ff', surface: '#fdfcff', chip: '#e6e0ff' }, dark: { accent: '#9b86ff', accent2: '#d08cff', onAccent: '#140b33', bg: '#0b0a18', surface: '#17152c', chip: '#211e3d', input: '#121024' } },
]

function emptyDraft(): Draft { return { theme: structuredClone(EMPTY_THEME), copy: {}, hiddenTabs: [], defaultTheme: '', elements: {} } }
function fromConfig(c: UiConfig): Draft {
  return {
    theme: validateTheme(c.theme).theme,
    copy: effectiveCopy(c),
    hiddenTabs: Array.isArray(c.hiddenTabs) ? c.hiddenTabs.filter((x) => typeof x === 'string') : [],
    defaultTheme: c.defaultTheme === 'light' || c.defaultTheme === 'dark' ? c.defaultTheme : '',
    elements: validateElements(c.elements).elements,
  }
}
/** Validates any imported/restored object into a Draft; returns every problem found. */
export function parseDraft(raw: unknown): { draft: Draft; errors: string[] } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const looksBare = 'light' in r || 'dark' in r || 'shared' in r
  const { theme, errors } = validateTheme(looksBare ? r : r.theme)
  const keys = new Set(allKeys())
  const copy: Record<string, string> = {}
  const rc = (r.copy && typeof r.copy === 'object' ? r.copy : {}) as Record<string, unknown>
  for (const [k, v] of Object.entries(rc)) {
    // 'key' applies to every language; 'key@es' only to that language (and wins over 'key').
    const [base, lang, extra] = k.split('@')
    if (extra !== undefined || (lang !== undefined && !isLocale(lang))) { errors.push(`copy.${k}: unknown language suffix (use @${LOCALES.map((l) => l.id).join(', @')})`); continue }
    if (!keys.has(base)) { errors.push(`copy.${k}: unknown text key`); continue }
    if (typeof v !== 'string' || v.length > 300) { errors.push(`copy.${k}: must be text up to 300 characters`); continue }
    if (v.trim()) copy[k] = v
  }
  const hidden = Array.isArray(r.hiddenTabs) ? r.hiddenTabs.filter((x): x is string => typeof x === 'string' && TABS.some(([id]) => id === x)) : []
  const dt = r.defaultTheme === 'light' || r.defaultTheme === 'dark' ? r.defaultTheme : ''
  const ve = validateElements(r.elements)
  errors.push(...ve.errors)
  return { draft: { theme, copy, hiddenTabs: hidden, defaultTheme: dt, elements: ve.elements }, errors }
}
/** Drops undefined / empty-string / empty-object leaves so a cleared field leaves no trace. */
function prune(v: unknown): unknown {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v !== 'object' || Array.isArray(v)) return v
  const out: Record<string, unknown> = {}
  for (const [k, x] of Object.entries(v)) { const p = prune(x); if (p !== undefined) out[k] = p }
  return Object.keys(out).length ? out : undefined
}
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)
const fmt = (t: Timestamp | null) => (t ? t.toDate().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '…')

export function UiEditor() {
  const { toast } = useAdmin()
  const { user, profile } = useAuth()
  const live = useUiConfig()
  const liveDraft = useMemo(() => fromConfig(live), [live])
  const [d, setD] = useState<Draft>(() => {
    try { const s = localStorage.getItem(DRAFT_KEY); if (s) return parseDraft(JSON.parse(s)).draft } catch { /* ignore */ }
    return fromConfig(live)
  })
  const [touched, setTouched] = useState(() => { try { return !!localStorage.getItem(DRAFT_KEY) } catch { return false } })
  const [mode, setMode] = useState<Mode>('light')
  /** '' = edit the all-languages text; otherwise edit the 'key@lang' override for that language. */
  const [copyLang, setCopyLang] = useState<'' | Locale>('')
  const ck = (k: string) => (copyLang ? `${k}@${copyLang}` : k)
  const [screen, setScreen] = useState('/ui-preview?screen=chat')
  const [device, setDevice] = useState<Device>('desktop')
  const [zoom, setZoom] = useState<number | 'fit'>('fit')
  const [leftTab, setLeftTab] = useState<LeftTab>('styles')
  const [propsOpen, setPropsOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [importErrs, setImportErrs] = useState<string[]>([])
  const [extraKey, setExtraKey] = useState('')
  const frame = useRef<HTMLIFrameElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  // Until the admin edits something, the draft follows what is live.
  useEffect(() => { if (!touched) setD(liveDraft) }, [liveDraft, touched])
  useEffect(() => { if (touched) try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)) } catch { /* ignore */ } }, [d, touched])
  const dirty = !same(d, liveDraft)
  // Undo/redo: rapid edits (typing, dragging a slider) within 700ms collapse into one step.
  const dRef = useRef(d)
  dRef.current = d
  const past = useRef<Draft[]>([])
  const future = useRef<Draft[]>([])
  const lastEdit = useRef(0)
  const [, rerender] = useState(0)
  const update = (fn: (x: Draft) => Draft) => {
    const cur = dRef.current
    const next = fn(structuredClone(cur))
    if (same(next, cur)) return
    const now = Date.now()
    if (now - lastEdit.current > 700) { past.current.push(cur); if (past.current.length > 100) past.current.shift() }
    lastEdit.current = now
    future.current = []
    dRef.current = next
    setD(next); setTouched(true); rerender((n) => n + 1)
  }
  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(dRef.current); dRef.current = prev; lastEdit.current = 0
    setD(prev); setTouched(true); rerender((n) => n + 1)
  }, [])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(dRef.current); dRef.current = next; lastEdit.current = 0
    setD(next); setTouched(true); rerender((n) => n + 1)
  }, [])
  // Element inspector state (selection lives only in the editor; overrides live in the draft).
  const [inspecting, setInspecting] = useState(true)
  const [sel, setSel] = useState<string[]>([])
  const selected = sel[sel.length - 1] ?? ''
  const setSelected = (id: string) => setSel(id ? [id] : [])
  const [tree, setTree] = useState<TreeNode[]>([])
  const [layerQ, setLayerQ] = useState('')
  const [, setSelRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [clip, setClip] = useState<StyleClip | null>(null)
  const [pick, setPick] = useState<PickInfo | null>(null)
  const [selCount, setSelCount] = useState<number | null>(null)
  const setEl = (id: string, fn: (o: ElementOverride) => ElementOverride) => update((x) => {
    // Keep what was typed (even half-typed colors) so inputs don't fight the user; invalid values are listed
    // under Validation, skipped by the preview, and dropped on publish.
    const o = prune(fn(structuredClone(x.elements[id] ?? {}))) as ElementOverride | undefined
    if (o) x.elements[id] = o; else delete x.elements[id]
    return x
  })
  const resetEl = (id: string) => update((x) => { delete x.elements[id]; return x })
  /** Apply one change to every selected element (multi-select with Shift). */
  const setSelEls = (fn: (o: ElementOverride) => ElementOverride) => update((x) => {
    for (const id of sel) { const o = prune(fn(structuredClone(x.elements[id] ?? {}))) as ElementOverride | undefined; if (o) x.elements[id] = o; else delete x.elements[id] }
    return x
  })
  const setBaseSel = (patch: Record<string, unknown>) => setSelEls((o) => ({ ...o, base: { ...(o.base ?? {}), ...patch } }))
  const applyXform = (x: XForm) => setEl(x.id, (o) => {
    const b = { ...(o.base ?? {}) }
    if (x.tx !== undefined) b.tx = x.tx || undefined
    if (x.ty !== undefined) b.ty = x.ty || undefined
    if (x.w !== undefined) b.width = { v: x.w, unit: 'px' }
    if (x.h !== undefined) b.height = { v: x.h, unit: 'px' }
    return { ...o, base: b }
  })
  const copyStyle = () => { const o = d.elements[selected]; if (!o) return; const { text: _t, ...style } = structuredClone(o); void _t; setClip(style); toast(at('Style copied')) }
  const pasteStyle = () => { if (!clip || !sel.length) return; setSelEls((o) => ({ ...structuredClone(clip), text: o.text })); toast(at('Style pasted to {0} element(s)', [sel.length])) }
  const handleKey = (key: string, shift: boolean, mod: boolean): boolean => {
    const k = key.toLowerCase()
    if (mod && k === 'z') { if (shift) redo(); else undo(); return true }
    if (mod && k === 'y') { redo(); return true }
    if (!sel.length) return false
    if (mod && k === 'c') { copyStyle(); return true }
    if (mod && k === 'v') { pasteStyle(); return true }
    if (key === 'Escape') { setSel([]); return true }
    if (key === 'Delete' || key === 'Backspace') { setSelEls((o) => ({ ...o, hide: true })); return true }
    const step = shift ? 10 : 1
    const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (mv[key]) { const [dx, dy] = mv[key]; setSelEls((o) => ({ ...o, base: { ...(o.base ?? {}), tx: ((o.base?.tx ?? 0) + dx) || undefined, ty: ((o.base?.ty ?? 0) + dy) || undefined } })); return true }
    return false
  }
  const keyRef = useRef(handleKey)
  keyRef.current = handleKey
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === 'INPUT' && !/^(checkbox|radio|range|color|button)$/.test((t as HTMLInputElement).type)))) return
      if (!(e.ctrlKey || e.metaKey) && !['Delete', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      if (keyRef.current(e.key, e.shiftKey, e.ctrlKey || e.metaKey)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const setColor = (k: ColorKey, v: string) => update((x) => { if (v) x.theme[mode][k] = v; else delete x.theme[mode][k]; return x })
  const setShared = <K extends keyof SharedTokens>(k: K, v: SharedTokens[K] | undefined) => update((x) => { if (v === undefined || v === '') delete x.theme.shared[k]; else x.theme.shared[k] = v; return x })
  const setModeNum = (k: 'bgStrength' | 'glass', v: number | undefined) => update((x) => { if (v === undefined) delete x.theme[mode][k]; else x.theme[mode][k] = v; return x })
  const setCopy = (k: string, v: string) => update((x) => { if (v) x.copy[k] = v; else delete x.copy[k]; return x })

  // Live preview: every change is posted into the iframe (same origin only) — no reload, no save.
  const post = useCallback(() => {
    const w = frame.current?.contentWindow
    if (!w) return
    const config: UiConfig = { theme: d.theme, copy: d.copy, hiddenTabs: d.hiddenTabs, defaultTheme: d.defaultTheme, elements: d.elements }
    w.postMessage({ type: PREVIEW_MSG, config, mode, lang: copyLang || getLocale() }, location.origin)
  }, [d, mode, copyLang])
  const postInspect = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: INSPECT_MSG, on: inspecting, selected: sel }, location.origin)
  }, [inspecting, sel])
  useEffect(() => { postInspect() }, [postInspect])
  useEffect(() => { const id = requestAnimationFrame(post); return () => cancelAnimationFrame(id) }, [post])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow) return
      const m = e.data as { type?: string; info?: PickInfo | null; ids?: string[]; id?: string; count?: number; tree?: TreeNode[]; rect?: { x: number; y: number; w: number; h: number } | null; key?: string; shift?: boolean; mod?: boolean; xform?: XForm }
      if (m?.type === PREVIEW_READY) { post(); postInspect() }
      else if (m?.type === PICK_MSG) { (document.activeElement as HTMLElement | null)?.blur?.(); setSel(Array.isArray(m.ids) ? m.ids.filter((x) => typeof x === 'string') : []); setPick(m.info ?? null); setSelCount(m.info?.count ?? null) }
      else if (m?.type === TREE_MSG && Array.isArray(m.tree)) setTree(m.tree)
      else if (m?.type === RECT_MSG) setSelRect(m.rect ?? null)
      else if (m?.type === KEY_MSG && typeof m.key === 'string') keyRef.current(m.key, !!m.shift, !!m.mod)
      else if (m?.type === XFORM_MSG && m.xform && typeof m.xform.id === 'string') applyXformRef.current(m.xform)
      else if (m?.type === `${PICK_MSG}-count` && typeof m.count === 'number') setSelCount(m.count)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [post, postInspect])
  const applyXformRef = useRef(applyXform)
  applyXformRef.current = applyXform
  const size = DEVICES[device]
  const [fitScale, setFitScale] = useState(0.5)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const fit = () => setFitScale(Math.max(0.1, Math.min(1, (el.clientWidth - 48) / size.w, (el.clientHeight - 48) / size.h)))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [device, size.w, size.h])
  useEffect(() => { setScale(zoom === 'fit' ? fitScale : zoom) }, [zoom, fitScale])
  const zoomBy = (f: number) => setZoom((z) => Math.min(3, Math.max(0.1, Math.round(((z === 'fit' ? fitScale : z) * f) * 100) / 100)))

  const loadHistory = useCallback(async () => {
    try {
      const snap = await getDocs(query(collection(db, ...fsCol('uiHistory')), orderBy('at', 'desc')))
      setHistory(snap.docs.map((s) => ({ id: s.id, ...(s.data() as Omit<HistoryRow, 'id'>) })))
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { void loadHistory() }, [loadHistory])

  const publish = async (draft: Draft, label: string) => {
    if (!user) return
    const vt = validateTheme(draft.theme)
    const ve = validateElements(draft.elements)
    const theme = vt.theme
    const errors = [...vt.errors, ...ve.errors]
    if (errors.length && !(await adminConfirm(at("Some values are invalid and will be dropped:\n\n{0}\n\nPublish anyway?", [errors.join('\n')])))) return
    const clean: Draft = { ...draft, theme, elements: ve.elements }
    setBusy(true)
    try {
      const version = (live.version ?? 0) + 1
      const hist = collection(db, ...fsCol('uiHistory'))
      // Keep what was live before the very first published edit, so it can be restored.
      if (!history.length && (live.theme || live.copy || live.tagline || live.hiddenTabs?.length)) {
        await addDoc(hist, { version: live.version ?? 0, note: 'Before first UI editor publish', at: serverTimestamp(), by: user.uid, config: fromConfig(live) })
      }
      await setDoc(doc(db, ...fsCol('config', 'ui')), { ...clean, version, updatedAt: serverTimestamp(), updatedBy: user.uid })
      await addDoc(hist, { version, note: label.slice(0, 120), at: serverTimestamp(), by: user.uid, config: clean })
      const snap = await getDocs(query(hist, orderBy('at', 'desc')))
      await Promise.all(snap.docs.slice(HISTORY_MAX).map((s) => deleteDoc(s.ref)))
      try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ }
      setTouched(false)
      setNote('')
      await loadHistory()
      toast(at("Applied to everyone — version {0} is live", [version]))
    } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) } finally { setBusy(false) }
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ app: 'pingo', kind: 'ui-config', exportedAt: new Date().toISOString(), basedOnVersion: live.version ?? 0, ...d }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pingo-ui-v${live.version ?? 0}${dirty ? '-draft' : ''}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const importJson = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text())
      const { draft, errors } = parseDraft(raw)
      setImportErrs(errors)
      update(() => draft)
      toast(errors.length ? at("Imported with {0} value(s) skipped", [errors.length]) : at("Imported into the draft — preview it, then Apply"))
    } catch { setImportErrs(['The file is not valid JSON.']); toast(at("Not a valid JSON file")) }
  }

  const draftErrors = [...validateTheme(d.theme).errors, ...validateElements(d.elements).errors]
  const t = d.theme[mode]
  const groups = [...new Set(COLOR_TOKENS.map((c) => c.group))]
  const checks: [string, ColorKey, ColorKey][] = [['Text on surface', 'text', 'surface'], ['Text on page', 'text', 'bg'], ['Text on accent', 'onAccent', 'accent'], ['My bubble text', 'mineText', 'mine'], ['Their bubble text', 'theirsText', 'theirs']]
  const shared = d.theme.shared
  useEffect(() => { ensureFont(shared.font) }, [shared.font])
  const screens: [string, string][] = [['/ui-preview?screen=chat', 'Chat (sample)'], ['/ui-preview?screen=components', 'Components'], ['/ui-preview?screen=login', 'Login screen'], ...(profile ? [['/', 'Live app: Chats'], ['/feed', 'Live app: Feed'], ['/games', 'Live app: Games'], ['/profile', 'Live app: Profile']] as [string, string][] : [])]
  const slider = (label: string, value: number, def: number, min: number, max: number, step: number, unit: string, on: (v: number | undefined) => void, test: string) => (
    <label className="ue-slider">
      <span>{at(label)}<b>{unit === '%' ? `${Math.round(value)}%` : unit === 'px' ? at("{0}px", [value]) : `${value.toFixed(2)}×`}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => on(Number(e.target.value))} data-testid={test} />
      {value !== def ? <button type="button" className="mini-btn" onClick={() => on(undefined)} title={at("Back to default")}>↺</button> : <i />}
    </label>
  )

  const presetsSec = (
          <section className="a-card">
            <header><h3>{at("Presets")}</h3><small className="a-note">{at("Fills colours for both modes; tweak after.")}</small></header>
            <div className="ue-presets">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" className="ue-preset" onClick={() => update((x) => { x.theme.light = { ...x.theme.light, ...p.light }; x.theme.dark = { ...x.theme.dark, ...p.dark }; return x })} data-testid={`ue-preset-${p.name.toLowerCase()}`}>
                  <i style={{ background: `linear-gradient(135deg, ${p.light.accent}, ${p.light.accent2})` }} />{at(p.name)}
                </button>
              ))}
            </div>
          </section>
  )
  const shapeSec = (
          <section className="a-card">
            <header><h3>{at("Shape, depth & type")}{' '}<small>{at("· both modes")}</small></h3></header>
            {slider('Corner roundness', shared.radius ?? 1, 1, 0, 2, 0.05, 'x', (v) => setShared('radius', v), 'ue-radius')}
            {slider('Outline shadow', shared.shadow ?? 1, 1, 0, 2, 0.05, 'x', (v) => setShared('shadow', v), 'ue-shadow')}
            {slider('Soft shadow', shared.softShadow ?? 1, 1, 0, 2, 0.05, 'x', (v) => setShared('softShadow', v), 'ue-soft')}
            {slider('Glass blur', shared.blur ?? 1, 1, 0, 2, 0.05, 'x', (v) => setShared('blur', v), 'ue-blur')}
            {slider('Base font size', shared.fontSize ?? 15, 15, 13, 19, 0.5, 'px', (v) => setShared('fontSize', v), 'ue-fontsize')}
            {slider('Density / spacing', shared.density ?? 1, 1, 0.75, 1.3, 0.05, 'x', (v) => setShared('density', v), 'ue-density')}
            <label className="a-field"><span>{at("Font family (Google Fonts)")}</span>
              <select className="input" value={shared.font ?? ''} onChange={(e) => setShared('font', e.target.value || undefined)} data-testid="ue-font">
                {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family || 'Nunito'} — {at(f.note)}</option>)}
              </select>
            </label>
            <p className="ue-font-sample" style={{ fontFamily: shared.font ? `'${shared.font}', sans-serif` : undefined }}>The quick brown fox · 다람쥐 헌 쳇바퀴에 타고파 · 0123</p>
          </section>
  )
  const copySec = (
          <section className="a-card">
            <header><h3>{at("Copy text")}</h3><small className="a-note">{at("Empty = stock text.")}</small></header>
            <label className="a-field"><span>{at("Applies to")}</span>
              <select className="input" value={copyLang} onChange={(e) => setCopyLang(e.target.value as '' | Locale)} data-testid="ue-copy-lang">
                <option value="">{at("All languages")}</option>
                {LOCALES.map((l) => <option key={l.id} value={l.id}>{at("Only")}{' '}{l.name}{Object.keys(d.copy).some((k) => k.endsWith(`@${l.id}`)) ? ' •' : ''}</option>)}
              </select>
            </label>
            {copyLang ? <p className="a-note">{at("Overrides for {0} win over the all-languages text. The preview switches to this language.", [LOCALES.find((l) => l.id === copyLang)?.name])}</p> : <p className="a-note">{at("Shown in every language unless that language has its own override.")}</p>}
            {[...COPY_KEYS, ...[...new Set(Object.keys(d.copy).map((k) => k.split('@')[0]))].filter((k) => !COPY_KEYS.some(([c]) => c === k)).map((k) => [k, k] as [string, string])].map(([k, label]) => (
              <label className="a-field" key={k}><span>{at(label)}</span>
                <input className="input" maxLength={300} value={d.copy[ck(k)] ?? ''} placeholder={(copyLang ? d.copy[k] || baseText(k, copyLang) : baseText(k, 'en')) ?? ''} lang={copyLang || undefined} onChange={(e) => setCopy(ck(k), e.target.value)} data-testid={`ue-copy-${k}`} />
              </label>
            ))}
            <div className="ue-addkey">
              <input className="input" list="ue-keys" placeholder={at("Add any other text… (search a key)")} value={extraKey} onChange={(e) => setExtraKey(e.target.value)} />
              <datalist id="ue-keys">{allKeys().map((k) => <option key={k} value={k}>{baseText(k)}</option>)}</datalist>
              <button type="button" className="btn btn-ghost" disabled={!allKeys().includes(extraKey)} onClick={() => { setCopy(ck(extraKey), baseText(extraKey, copyLang || 'en') ?? ''); setExtraKey('') }}>{at("Add")}</button>
            </div>
          </section>
  )
  const globalStyles = (
        <div className="ue-controls" data-testid="ue-global">
          

          

          {presetsSec}

          {groups.map((g) => (
            <section className="a-card" key={g}>
              <header><h3>{at(g)} <small>· {at(mode)}</small></h3></header>
              {COLOR_TOKENS.filter((c) => c.group === g).map((c) => {
                const v = t[c.key] ?? ''
                const shown = resolved(d.theme, mode, c.key)
                const bad = !!v && !isColor(v)
                return (
                  <div className={`ue-color ${v ? 'set' : ''}`} key={c.key}>
                    <input type="color" value={/^#[0-9a-f]{6}$/i.test(shown) ? shown : '#888888'} onChange={(e) => setColor(c.key, e.target.value)} aria-label={at(c.label)} data-testid={`ue-color-${c.key}`} />
                    <span className="ue-label">{at(c.label)}</span>
                    <input className={`input ue-hex ${bad ? 'bad' : ''}`} value={v} placeholder={DEFAULTS[mode][c.key]} onChange={(e) => setColor(c.key, e.target.value.trim())} spellCheck={false} data-testid={`ue-hex-${c.key}`} />
                    {v ? <button type="button" className="mini-btn" onClick={() => setColor(c.key, '')} title={at("Back to default")}>↺</button> : <i />}
                  </div>
                )
              })}
              {g === 'Background' ? slider('Gradient strength', t.bgStrength ?? 100, 100, 0, 200, 5, '%', (v) => setModeNum('bgStrength', v), 'ue-bgk') : null}
              {g === 'Surfaces' ? slider('Glass opacity', t.glass ?? DEFAULTS.glass[mode], DEFAULTS.glass[mode], 30, 100, 1, '%', (v) => setModeNum('glass', v), 'ue-glass') : null}
            </section>
          ))}

          <section className="a-card">
            <header><h3>{at("Contrast check")}{' '}<small>· {mode}</small></h3></header>
            <div className="ue-contrast">
              {checks.map(([label, fg, bg]) => {
                const r = contrast(resolved(d.theme, mode, fg), resolved(d.theme, mode, bg))
                return <span key={label} className={r && r < 3 ? 'bad' : r && r < 4.5 ? 'warn' : 'ok'} style={{ background: resolved(d.theme, mode, bg), color: resolved(d.theme, mode, fg) }}>{at(label)} <b>{r ? r.toFixed(1) : '–'}</b></span>
              })}
            </div>
            <small className="a-note">{at("4.5+ reads well; under 3 is hard to read.")}</small>
          </section>

          {shapeSec}

          {copySec}

          <section className="a-card">
            <header><h3>{at("Layout")}</h3></header>
            <label className="a-field"><span>{at("Default mode for people who never picked one")}</span>
              <select className="input" value={d.defaultTheme} onChange={(e) => update((x) => { x.defaultTheme = e.target.value as Draft['defaultTheme']; return x })} data-testid="ue-default-mode"><option value="">{at("Follow the device")}</option><option value="light">{at("Light")}</option><option value="dark">{at("Dark")}</option></select>
            </label>
            <div className="a-field"><span>{at("Tabs shown in the app")}</span>
              {TABS.map(([id, label]) => <label key={id} className="a-check"><input type="checkbox" checked={!d.hiddenTabs.includes(id)} onChange={(e) => update((x) => { x.hiddenTabs = e.target.checked ? x.hiddenTabs.filter((y) => y !== id) : [...x.hiddenTabs, id]; return x })} data-testid={`ui-tab-${id}`} /> {at(label)}</label>)}
              <small className="a-note">{at("Chats and Profile are always shown.")}</small>
            </div>
          </section>

          <section className="a-card" data-testid="ue-history">
            <header><h3>{at("Version history")}</h3><small className="a-note">{at("Last {0} published versions.", [HISTORY_MAX])}</small></header>
            {history.length === 0 ? <p className="a-note">{at("Nothing published from the editor yet.")}</p> : null}
            {history.map((h) => (
              <div className="ue-hist" key={h.id} data-testid="ue-hist-row">
                <div><b>v{h.version}</b> <small>{fmt(h.at)}</small><div className="a-note">{h.note || '—'}</div></div>
                <button type="button" className="mini-btn" onClick={() => { const r = parseDraft(h.config); update(() => r.draft); setImportErrs(r.errors); toast(at("v{0} loaded into the draft — Apply to make it live", [h.version])) }} data-testid="ue-hist-load">{at("Load")}</button>
                <button type="button" className="mini-btn accent" disabled={busy} onClick={async () => { if (await adminConfirm(at("Restore v{0} for everyone now?", [h.version]))) void publish(parseDraft(h.config).draft, `Restored v${h.version}`) }} data-testid="ue-hist-restore">{at("Restore")}</button>
              </div>
            ))}
          </section>
        
        </div>
  )
  const layers = tree.filter((n) => !layerQ || n.id.includes(layerQ.toLowerCase()) || n.label.toLowerCase().includes(layerQ.toLowerCase()))
  const boxLeft = 24, boxTop = 24
  const LEFT: [LeftTab, string, string][] = [['screens', '🖼️', 'Screens'], ['layers', '🧱', 'Layers'], ['styles', '🎛️', 'Global styles'], ['brand', '🎨', 'Brand kit'], ['text', '🔤', 'Text']]

  return (
    <div className="ue cv" data-testid="ui-editor">
      <div className="ue-bar cv-top">
        <div className="cv-top-l">
          <button type="button" className="cv-ic" disabled={!past.current.length} onClick={undo} title={at("Undo (Ctrl+Z)")} aria-label={at("Undo (Ctrl+Z)")} data-testid="ue-undo">↶</button>
          <button type="button" className="cv-ic" disabled={!future.current.length} onClick={redo} title={at("Redo (Ctrl+Shift+Z)")} aria-label={at("Redo (Ctrl+Shift+Z)")} data-testid="ue-redo">↷</button>
          <div className="ue-status">
            <b>{at("Live: v{0}", [live.version ?? 0])}</b>
            <span className={dirty ? 'pending' : ''} data-testid="ue-status">{dirty ? at("Draft has unpublished changes") : at("Draft matches what everyone sees")}</span>
            {touched ? <small className="cv-saved" data-testid="ue-autosaved">✓ {at("Draft autosaved")}</small> : null}
          </div>
        </div>
        <div className="cv-top-c">
          <div className="seg" role="group" aria-label={at("Device")}>
            {(Object.keys(DEVICES) as Device[]).map((k) => <button key={k} type="button" className={device === k ? 'on' : ''} title={at(DEVICES[k].label)} aria-label={at(DEVICES[k].label)} onClick={() => setDevice(k)} data-testid={`ue-device-${k}`}>{DEVICES[k].icon}</button>)}
          </div>
          <div className="seg ue-mode" role="group">
            {(['light', 'dark'] as const).map((m) => <button key={m} type="button" className={mode === m ? 'on' : ''} onClick={() => setMode(m)} data-testid={`ue-mode-${m}`}>{m === 'light' ? at("☀️ Light") : at("🌙 Dark")}</button>)}
          </div>
          <div className="cv-zoom" role="group" aria-label={at("Zoom")}>
            <button type="button" className="cv-ic" onClick={() => zoomBy(1 / 1.25)} aria-label={at("Zoom out")} data-testid="ue-zoom-out">−</button>
            <span data-testid="ue-zoom">{Math.round(scale * 100)}%</span>
            <button type="button" className="cv-ic" onClick={() => zoomBy(1.25)} aria-label={at("Zoom in")} data-testid="ue-zoom-in">+</button>
            <button type="button" className={`mini-btn ${zoom === 'fit' ? 'accent' : ''}`} onClick={() => setZoom('fit')} data-testid="ue-zoom-fit">{at("Fit")}</button>
          </div>
          <button type="button" className={`mini-btn ${inspecting ? 'accent' : ''}`} onClick={() => setInspecting((v) => !v)} title={at("Select elements, or interact with the app")} data-testid="ue-inspect">{inspecting ? at("🎯 Select") : at("👆 Interact")}</button>
        </div>
        <div className="cv-top-r">
          <details className="cv-more">
            <summary className="mini-btn" data-testid="ue-more">⋯</summary>
            <div className="cv-menu">
              <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => { setD(liveDraft); setTouched(false); setImportErrs([]); try { localStorage.removeItem(DRAFT_KEY) } catch { /* ignore */ } }} data-testid="ue-revert">{at("Discard draft")}</button>
              <button type="button" className="btn btn-ghost" onClick={async () => { if (await adminConfirm(at("Reset the draft to Pingo’s built-in defaults? (Nothing changes for users until you Apply.)"))) update(() => emptyDraft()) }} data-testid="ue-reset">{at("Reset to default")}</button>
              <button type="button" className="btn btn-ghost" onClick={exportJson} data-testid="ue-export">{at("⬇ Export JSON")}</button>
              <label className="btn btn-ghost">{at("⬆ Import JSON")}<input type="file" accept="application/json,.json" className="hidden-file" data-testid="ue-import" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importJson(f); e.target.value = '' }} /></label>
            </div>
          </details>
          <input className="input ue-note" placeholder={at("Change note (optional)")} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn btn-primary cv-publish" disabled={!dirty || busy} onClick={() => void publish(d, note || 'Edited in UI editor')} data-testid="ue-apply">{at("🚀 Publish")}</button>
        </div>
      </div>
      {importErrs.length || draftErrors.length ? (
        <div className="a-note bad ue-errs" data-testid="ue-errors">
          <b>{at("Validation:")}</b> {at("{0} value(s) were invalid and fall back to defaults.", [[...importErrs, ...draftErrors].length])}<ul>{[...new Set([...importErrs, ...draftErrors])].slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : null}

      <div className={`cv-body ${propsOpen ? '' : 'props-closed'}`}>
        <nav className="cv-rail" role="tablist" aria-label={at("Editor panels")}>
          {LEFT.map(([k, ic, l]) => <button key={k} type="button" role="tab" aria-selected={leftTab === k} className={leftTab === k ? 'on' : ''} onClick={() => setLeftTab(k)} data-testid={`ue-tab-${k}`}><span aria-hidden="true">{ic}</span>{at(l)}</button>)}
        </nav>
        <aside className="cv-panel">
          {leftTab === 'screens' ? (
            <section className="a-card" data-testid="ue-screens">
              <header><h3>{at("Screens")}</h3><small className="a-note">{at("Pick which app screen to edit.")}</small></header>
              <div className="cv-screens">
                {screens.map(([v, l]) => <button key={v} type="button" className={`cv-screen ${screen === v ? 'on' : ''}`} onClick={() => { setScreen(v); setSel([]) }} data-testid="ue-screen-btn">{at(l)}<small>{v}</small></button>)}
              </div>
              <select className="input" value={screen} onChange={(e) => { setScreen(e.target.value); setSel([]) }} data-testid="ue-screen">
                {screens.map(([v, l]) => <option key={v} value={v}>{at(l)}</option>)}
              </select>
              {!profile ? <p className="a-note">{at("Live app screens appear here once the admin account has a Pingo profile.")}</p> : null}
            </section>
          ) : leftTab === 'layers' ? (
            <section className="a-card cv-layers" data-testid="ue-layers">
              <header><h3>{at("Layers")}</h3><small className="a-note">{at("{0} elements on this screen", [tree.length])}</small></header>
              <input className="input" placeholder={at("Filter layers…")} value={layerQ} onChange={(e) => setLayerQ(e.target.value)} data-testid="ue-layer-q" />
              <div className="cv-layer-list">
                {layers.map((n) => {
                  const hidden = !!d.elements[n.id]?.hide
                  return (
                    <div key={n.id} className={`cv-layer ${sel.includes(n.id) ? 'on' : ''} ${hidden || n.hidden ? 'off' : ''}`} style={{ paddingLeft: 6 + n.depth * 12 }} data-testid="ue-layer">
                      <button type="button" className="cv-layer-name" onClick={(e) => { setSel((cur) => e.shiftKey ? (cur.includes(n.id) ? cur.filter((x) => x !== n.id) : [...cur, n.id]) : [n.id]); setPick(null); setSelCount(null) }} title={n.id}>
                        <code>{n.id.split('.').slice(1).join('.') || n.id}</code>{n.label ? <small>{n.label}</small> : null}
                      </button>
                      <button type="button" className="cv-eye" aria-label={hidden ? at("Show") : at("Hide")} aria-pressed={hidden} onClick={() => setEl(n.id, (o) => ({ ...o, hide: hidden ? undefined : true }))} data-testid="ue-layer-eye">{hidden ? '🙈' : '👁'}</button>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : leftTab === 'brand' ? (
            <div className="ue-controls" data-testid="ue-brand">{presetsSec}{shapeSec}</div>
          ) : leftTab === 'text' ? (
            <div className="ue-controls" data-testid="ue-text">{copySec}</div>
          ) : globalStyles}
        </aside>

        <main className="cv-canvas" ref={wrap} data-testid="ue-canvas">
            <div className="cv-tb-dock">
            {inspecting && sel.length ? (
              <CanvasToolbar style={{}} count={sel.length} o={d.elements[selected] ?? {}} theme={d.theme} mode={mode}
                setBase={setBaseSel} setFill={(f) => setSelEls((o) => ({ ...o, base: { ...(o.base ?? {}), bg: f } }))} setHide={(h) => setSelEls((o) => ({ ...o, hide: h || undefined }))}
                reset={() => update((x) => { for (const id of sel) delete x.elements[id]; return x })} copy={copyStyle} paste={pasteStyle} canPaste={!!clip} />
            ) : null}
            </div>
          <div className="cv-stage" style={{ width: size.w * scale + boxLeft * 2, height: size.h * scale + boxTop * 2 }}>
            <div className="ue-frame-box" style={{ left: boxLeft, top: boxTop, width: size.w * scale, height: size.h * scale }}>
              <iframe ref={frame} title={at("Live preview")} src={screen} onLoad={() => { post(); postInspect() }} style={{ width: size.w, height: size.h, transform: `scale(${scale})` }} data-testid="ue-frame" />
            </div>

          </div>
        </main>

        <aside className="cv-props" data-testid="ue-props">
          <button type="button" className="cv-props-toggle" onClick={() => setPropsOpen((v) => !v)} aria-expanded={propsOpen} data-testid="ue-props-toggle">{propsOpen ? '›' : '‹'}</button>
          {propsOpen ? (
            <ElementInspector elements={d.elements} setEl={(id, fn) => (id === selected && sel.length > 1 ? setSelEls(fn) : setEl(id, fn))} resetEl={resetEl} resetAll={() => update((x) => { x.elements = {}; return x })}
              selected={selected} select={(id) => { setSelected(id); setPick(null); setSelCount(null) }} pick={pick} count={selCount} inspecting={inspecting} setInspecting={setInspecting} multi={sel.length} />
          ) : null}
        </aside>
      </div>
    </div>
  )
}

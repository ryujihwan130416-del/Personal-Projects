/**
 * Runs inside the UI editor's preview iframe only (Canva-style canvas). While select mode is on:
 *  - hover highlights any element with a data-ui-id; click selects it (Shift+click adds/removes);
 *  - the primary selection gets a box with 8 resize handles and can be dragged to move it, with snapping
 *    guides to the parent / siblings / page centre, kept inside the page;
 *  - the editor gets the selection's rect (for its floating toolbar), the layer tree and forwarded shortcuts.
 * Clicks never reach the app while selecting. Messages go to the parent window only (same origin).
 */
export const INSPECT_MSG = 'pingo-ui-inspect'
export const PICK_MSG = 'pingo-ui-pick'
export const RECT_MSG = 'pingo-ui-rect'
export const TREE_MSG = 'pingo-ui-tree'
export const KEY_MSG = 'pingo-ui-key'
export const XFORM_MSG = 'pingo-ui-transform'

export interface PickInfo {
  id: string; tag: string; text: string; count: number; hasIcon: boolean; inFlex: boolean; isInput: boolean
  ancestors: string[]; children: string[]
}
export interface TreeNode { id: string; depth: number; tag: string; label: string; hidden: boolean }
export interface XForm { id: string; tx?: number; ty?: number; w?: number; h?: number }

let on = false
let selected: string[] = []
let raf = 0
let hovered: Element | null = null
let layer: HTMLDivElement | null = null
let hoverBox: HTMLDivElement | null = null
let boxes: HTMLDivElement[] = []
let guides: HTMLDivElement[] = []
let lastRect = ''
let treeTimer = 0
let mo: MutationObserver | null = null
let drag: null | {
  kind: 'move' | 'resize'; dir: string; el: HTMLElement; all: HTMLElement[]; id: string
  sx: number; sy: number; tx0: number; ty0: number; w0: number; h0: number; r0: DOMRect; cand: { x: number[]; y: number[] }
  tx: number; ty: number; w: number; h: number; moved: boolean
} = null

const post = (m: object) => window.parent.postMessage(m, location.origin)
const idOf = (el: Element | null) => el?.getAttribute('data-ui-id') ?? ''
const q = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-ui-id="${CSS.escape(id)}"]`)]
const primary = () => selected[selected.length - 1] ?? ''
const firstVisible = (id: string) => q(id).find((e) => { const r = e.getBoundingClientRect(); return r.width || r.height }) ?? q(id)[0] ?? null

function mk(css: string, parent: HTMLElement = document.body) {
  const el = document.createElement('div')
  el.setAttribute('data-inspector', '')
  el.style.cssText = css
  parent.appendChild(el)
  return el
}
function ensureLayer() {
  if (layer) return
  layer = mk('position:fixed;inset:0;z-index:2147483646;pointer-events:none;')
  hoverBox = mk('position:fixed;display:none;outline:2px dashed #2f8cff;background:rgba(47,140,255,.08);border-radius:4px;pointer-events:none;', layer)
  hoverBox.className = 'pi-hover'
  const tag = mk('position:absolute;left:-2px;top:-20px;font:700 11px/16px ui-monospace,monospace;padding:1px 6px;border-radius:6px;white-space:nowrap;color:#fff;background:#2f8cff;', hoverBox)
  tag.className = 'tag'
}
function place(b: HTMLElement, r: DOMRect | null) {
  if (!r || (!r.width && !r.height)) { b.style.display = 'none'; return }
  b.style.display = 'block'
  b.style.left = `${r.left}px`; b.style.top = `${r.top}px`; b.style.width = `${r.width}px`; b.style.height = `${r.height}px`
}
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
function selBox(i: number, isPrimary: boolean) {
  while (boxes.length <= i) {
    const b = mk('position:fixed;display:none;outline:2px solid #8b3dff;box-shadow:0 0 0 1px rgba(255,255,255,.8);border-radius:2px;', layer!)
    b.className = 'pi-sel'
    const lab = mk('position:absolute;left:-2px;top:-21px;font:700 11px/16px ui-monospace,monospace;padding:1px 6px;border-radius:6px;white-space:nowrap;color:#fff;background:#8b3dff;max-width:360px;overflow:hidden;text-overflow:ellipsis;', b)
    lab.className = 'tag'
    for (const h of HANDLES) {
      const hd = mk('position:absolute;width:14px;height:14px;background:#fff;border:3px solid #8b3dff;border-radius:50%;box-sizing:border-box;pointer-events:auto;', b)
      hd.dataset.handle = h
      const x = h.includes('w') ? '0%' : h.includes('e') ? '100%' : '50%'
      const y = h.includes('n') ? '0%' : h.includes('s') ? '100%' : '50%'
      hd.style.left = `calc(${x} - 7px)`; hd.style.top = `calc(${y} - 7px)`
      hd.style.cursor = `${h === 'n' || h === 's' ? 'ns' : h === 'e' || h === 'w' ? 'ew' : h === 'nw' || h === 'se' ? 'nwse' : 'nesw'}-resize`
    }
    boxes.push(b)
  }
  const b = boxes[i]
  b.style.pointerEvents = isPrimary ? 'auto' : 'none'
  b.style.cursor = isPrimary ? 'move' : ''
  b.querySelectorAll<HTMLElement>('[data-handle]').forEach((h) => { h.style.display = isPrimary ? 'block' : 'none' })
  return b
}
function guide(i: number, vertical: boolean, pos: number) {
  while (guides.length <= i) { const g = mk('position:fixed;background:#ff2fb3;pointer-events:none;display:none;', layer!); g.className = 'pi-guide'; guides.push(g) }
  const g = guides[i]
  g.style.display = 'block'
  if (vertical) { g.style.left = `${pos}px`; g.style.top = '0'; g.style.width = '1px'; g.style.height = '100%' }
  else { g.style.top = `${pos}px`; g.style.left = '0'; g.style.height = '1px'; g.style.width = '100%' }
}
const hideGuides = () => guides.forEach((g) => { g.style.display = 'none' })

function info(el: Element): PickInfo {
  const id = idOf(el)
  const ancestors: string[] = []
  let p = el.parentElement?.closest('[data-ui-id]')
  while (p && ancestors.length < 6) { ancestors.push(idOf(p)); p = p.parentElement?.closest('[data-ui-id]') }
  const parentDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : ''
  return {
    id, tag: el.tagName.toLowerCase(),
    text: (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : (el.textContent ?? '')).trim().slice(0, 120),
    count: q(id).length, hasIcon: !!el.querySelector('svg'), inFlex: /flex|grid/.test(parentDisplay),
    isInput: el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement,
    ancestors, children: [...new Set([...el.querySelectorAll('[data-ui-id]')].map(idOf))].slice(0, 12),
  }
}
function tree(): TreeNode[] {
  const out: TreeNode[] = []
  const seen = new Set<string>()
  for (const el of document.querySelectorAll('[data-ui-id]')) {
    const id = idOf(el)
    if (seen.has(id) || el.closest('[data-inspector]')) continue
    seen.add(id)
    let depth = 0
    for (let p = el.parentElement?.closest('[data-ui-id]'); p; p = p.parentElement?.closest('[data-ui-id]')) depth++
    const label = (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.placeholder : el.getAttribute('aria-label') || (el.textContent ?? '')).trim().replace(/\s+/g, ' ').slice(0, 40)
    out.push({ id, depth: Math.min(depth, 12), tag: el.tagName.toLowerCase(), label, hidden: getComputedStyle(el).display === 'none' })
    if (out.length >= 700) break
  }
  return out
}
const sendTree = () => { clearTimeout(treeTimer); treeTimer = window.setTimeout(() => post({ type: TREE_MSG, tree: tree() }), 250) }

function tick() {
  if (hoverBox) {
    const sel = hovered && selected.includes(idOf(hovered))
    place(hoverBox, hovered && !sel ? hovered.getBoundingClientRect() : null)
    ;(hoverBox.querySelector('.tag') as HTMLElement).textContent = idOf(hovered)
  }
  selected.forEach((id, i) => {
    const b = selBox(i, i === selected.length - 1)
    const el = drag && drag.id === id ? drag.el : firstVisible(id)
    place(b, el?.getBoundingClientRect() ?? null)
    ;(b.querySelector('.tag') as HTMLElement).textContent = i === selected.length - 1 ? `${id}${drag?.kind === 'resize' ? `  ${Math.round(drag.w)}×${Math.round(drag.h)}` : ''}` : id
    ;(b.querySelector('.tag') as HTMLElement).style.display = i === selected.length - 1 ? 'block' : 'none'
  })
  for (let i = selected.length; i < boxes.length; i++) boxes[i].style.display = 'none'
  const pel = primary() ? firstVisible(primary()) : null
  const r = pel?.getBoundingClientRect()
  const key = r ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)},${Math.round(r.height)}` : ''
  if (key !== lastRect) { lastRect = key; post({ type: RECT_MSG, id: primary(), rect: r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null, vw: innerWidth, vh: innerHeight }) }
  raf = requestAnimationFrame(tick)
}

function target(e: Event): Element | null {
  const t = e.target as Element | null
  if (!t || t.closest?.('[data-inspector]')) return null
  return t.closest?.('[data-ui-id]') ?? null
}
const onMove = (e: PointerEvent) => {
  if (drag) { dragMove(e); return }
  hovered = target(e)
}
function readTranslate(el: HTMLElement): [number, number] {
  const t = getComputedStyle(el).translate
  if (!t || t === 'none') return [0, 0]
  const [a, b] = t.split(' ').map((x) => parseFloat(x) || 0)
  return [a, b ?? 0]
}
function startDrag(e: PointerEvent, kind: 'move' | 'resize', dir: string) {
  const id = primary()
  const el = firstVisible(id)
  if (!el) return
  const [tx0, ty0] = readTranslate(el)
  const r0 = el.getBoundingClientRect()
  // Snap candidates: parent edges/centre, sibling elements' edges/centres, page centre.
  const x: number[] = [innerWidth / 2], y: number[] = []
  const par = el.parentElement?.getBoundingClientRect()
  if (par) { x.push(par.left, par.left + par.width / 2, par.right); y.push(par.top, par.top + par.height / 2, par.bottom) }
  for (const s of el.parentElement?.querySelectorAll(':scope > [data-ui-id]') ?? []) {
    if (s === el) continue
    const sr = s.getBoundingClientRect()
    if (!sr.width) continue
    x.push(sr.left, sr.left + sr.width / 2, sr.right); y.push(sr.top, sr.top + sr.height / 2, sr.bottom)
  }
  drag = { kind, dir, el, all: q(id), id, sx: e.clientX, sy: e.clientY, tx0, ty0, w0: r0.width, h0: r0.height, r0, cand: { x, y }, tx: tx0, ty: ty0, w: r0.width, h: r0.height, moved: false }
  e.preventDefault(); e.stopPropagation()
}
const SNAP = 6
function snap(vals: number[], cands: number[]): [number, number | null] {
  let best = SNAP + 1, delta = 0, at: number | null = null
  for (const v of vals) for (const c of cands) { const d = c - v; if (Math.abs(d) < best) { best = Math.abs(d); delta = d; at = c } }
  return best <= SNAP ? [delta, at] : [0, null]
}
function dragMove(e: PointerEvent) {
  const d = drag!
  let dx = e.clientX - d.sx, dy = e.clientY - d.sy
  if (!d.moved && Math.hypot(dx, dy) < 3) return
  d.moved = true
  hideGuides()
  const docW = document.documentElement.clientWidth, docH = Math.max(document.documentElement.scrollHeight, innerHeight)
  if (d.kind === 'move') {
    let L = d.r0.left + dx, T = d.r0.top + dy
    if (!e.altKey) {
      const [sx, gx] = snap([L, L + d.w0 / 2, L + d.w0], d.cand.x); L += sx; if (gx !== null) guide(0, true, gx)
      const [sy, gy] = snap([T, T + d.h0 / 2, T + d.h0], d.cand.y); T += sy; if (gy !== null) guide(1, false, gy)
    }
    // Keep inside the page.
    L = Math.min(Math.max(L, 0), Math.max(0, docW - d.w0)); T = Math.min(Math.max(T, -scrollY), docH - d.h0 - scrollY)
    d.tx = Math.round(d.tx0 + (L - d.r0.left)); d.ty = Math.round(d.ty0 + (T - d.r0.top))
    d.all.forEach((el) => el.style.setProperty('translate', `${d.tx}px ${d.ty}px`, 'important'))
  } else {
    if (e.shiftKey && /^(nw|ne|se|sw)$/.test(d.dir)) { const k = Math.max(Math.abs(dx) / d.w0, Math.abs(dy) / d.h0); dx = Math.sign(dx || 1) * k * d.w0; dy = Math.sign(dy || 1) * k * d.h0 }
    let w = d.w0, h = d.h0, tx = d.tx0, ty = d.ty0
    if (d.dir.includes('e')) w = d.w0 + dx
    if (d.dir.includes('w')) { w = d.w0 - dx; tx = d.tx0 + dx }
    if (d.dir.includes('s')) h = d.h0 + dy
    if (d.dir.includes('n')) { h = d.h0 - dy; ty = d.ty0 + dy }
    if (!e.altKey && d.dir.includes('e')) { const [s, g] = snap([d.r0.left + w], d.cand.x); w += s; if (g !== null) guide(0, true, g) }
    if (!e.altKey && d.dir.includes('s')) { const [s, g] = snap([d.r0.top + h], d.cand.y); h += s; if (g !== null) guide(1, false, g) }
    w = Math.max(8, Math.min(w, docW - Math.max(0, d.r0.left + (tx - d.tx0))))
    h = Math.max(8, Math.min(h, 1600))
    d.w = Math.round(w); d.h = Math.round(h); d.tx = Math.round(tx); d.ty = Math.round(ty)
    d.all.forEach((el) => {
      if (d.dir.includes('e') || d.dir.includes('w')) { el.style.setProperty('width', `${d.w}px`, 'important'); el.style.setProperty('flex', '0 0 auto', 'important') }
      if (d.dir.includes('n') || d.dir.includes('s')) el.style.setProperty('height', `${d.h}px`, 'important')
      if (d.tx !== d.tx0 || d.ty !== d.ty0) el.style.setProperty('translate', `${d.tx}px ${d.ty}px`, 'important')
    })
  }
}
function endDrag() {
  const d = drag!
  drag = null
  hideGuides()
  if (!d.moved) return
  const x: XForm = { id: d.id }
  if (d.kind === 'move' || d.tx !== d.tx0 || d.ty !== d.ty0) { x.tx = d.tx; x.ty = d.ty }
  if (d.kind === 'resize') { if (d.dir.includes('e') || d.dir.includes('w')) x.w = d.w; if (d.dir.includes('n') || d.dir.includes('s')) x.h = d.h }
  post({ type: XFORM_MSG, xform: x })
  // The editor answers with a new draft (CSS); drop the temporary inline styles once it has applied.
  setTimeout(() => d.all.forEach((el) => { el.style.removeProperty('translate'); el.style.removeProperty('width'); el.style.removeProperty('height'); el.style.removeProperty('flex') }), 350)
}
const onDown = (e: PointerEvent) => {
  const t = e.target as HTMLElement
  const handle = t.closest?.('[data-handle]') as HTMLElement | null
  if (handle) { startDrag(e, 'resize', handle.dataset.handle!); return }
  if (boxes[selected.length - 1] && t.closest?.('[data-inspector]') === boxes[selected.length - 1] && !e.shiftKey) { startDrag(e, 'move', ''); return }
  if (target(e) || t.closest?.('[data-inspector]')) { e.preventDefault(); e.stopPropagation() }
}
const onUp = (e: PointerEvent) => { if (drag) { const moved = drag.moved; endDrag(); if (moved) { e.preventDefault(); e.stopPropagation(); suppressClick = true } } }
let suppressClick = false
const onClick = (e: MouseEvent) => {
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
  if (suppressClick) { suppressClick = false; return }
  const t = e.target as HTMLElement
  let el = target(e)
  // Clicking the selection box without dragging: pick whatever app element lies under the pointer
  // (click-through, so an element covered by a moved selection can still be selected).
  if (!el && t.closest?.('[data-inspector]')) {
    el = document.elementsFromPoint(e.clientX, e.clientY).find((x) => !x.closest('[data-inspector]'))?.closest('[data-ui-id]') ?? null
    if (!el) return
  }
  if (!el) { selected = []; post({ type: PICK_MSG, info: null, ids: [] }); return }
  const id = idOf(el)
  if (e.shiftKey) selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
  else selected = [id]
  post({ type: PICK_MSG, info: info(el), ids: selected })
}
const swallow = (e: Event) => {
  const t = e.target as Element | null
  if (t?.closest?.('[data-handle]') || drag) return
  if (target(e) || t?.closest?.('[data-inspector]')) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation() }
}
const onKey = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
  const mod = e.ctrlKey || e.metaKey
  const k = e.key
  const handled = ['Delete', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k) || (mod && /^[zycv]$/i.test(k))
  if (!handled) return
  e.preventDefault(); e.stopPropagation()
  post({ type: KEY_MSG, key: k, shift: e.shiftKey, mod })
}
const BLOCK = ['mousedown', 'mouseup', 'touchstart', 'touchend', 'dblclick', 'contextmenu', 'submit', 'focusin']

export function setInspect(next: boolean, sel?: string[] | string) {
  if (sel !== undefined) {
    selected = (Array.isArray(sel) ? sel : sel ? [sel] : []).filter(Boolean)
    const el = primary() ? firstVisible(primary()) : null
    if (el && next) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
  if (next === on) return
  on = next
  if (on) {
    ensureLayer()
    document.addEventListener('pointermove', onMove, true)
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('pointerup', onUp, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKey, true)
    BLOCK.forEach((t) => document.addEventListener(t, swallow, true))
    document.documentElement.style.cursor = 'default'
    mo = new MutationObserver((ms) => { if (ms.some((m) => !(m.target as Element).closest?.('[data-inspector]'))) sendTree() })
    mo.observe(document.body, { childList: true, subtree: true })
    sendTree()
    lastRect = ''
    raf = requestAnimationFrame(tick)
  } else {
    document.removeEventListener('pointermove', onMove, true)
    document.removeEventListener('pointerdown', onDown, true)
    document.removeEventListener('pointerup', onUp, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKey, true)
    BLOCK.forEach((t) => document.removeEventListener(t, swallow, true))
    document.documentElement.style.cursor = ''
    mo?.disconnect(); mo = null
    cancelAnimationFrame(raf)
    layer?.remove(); layer = hoverBox = null; boxes = []; guides = []; hovered = null; drag = null
    post({ type: RECT_MSG, id: '', rect: null })
  }
}
export function countOf(id: string) { return q(id).length }
/** Layers panel asks for a fresh tree (e.g. after switching screens). */
export function requestTree() { post({ type: TREE_MSG, tree: tree() }) }

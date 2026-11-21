/**
 * Build-time plugin: gives every meaningful JSX element a stable `data-ui-id` so the admin UI editor's
 * element inspector can target it. IDs come from (in order) an explicit data-ui-id, the data-testid,
 * or tag + first class + label text; duplicates inside a file get -2, -3… Only the app's own screens are
 * tagged — the admin console (src/pages/admin, Admin.tsx) is never touched, so overrides can't reach it.
 * A virtual module `virtual:ui-ids` lists every id for the editor's "find any element" search.
 */
import { parseSync } from 'rolldown/experimental'
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export interface UiIdEntry { id: string; screen: string; tag: string; label: string }
/** A data-testid computed at runtime (e.g. data-testid={tab.test}); the manifest expands it from literals found elsewhere. */
export interface DynamicEntry { screen: string; tag: string; label: string; prop: string; kind: 'member' | 'ident' }

const ALWAYS = new Set(['button', 'a', 'input', 'textarea', 'select', 'label', 'h1', 'h2', 'h3', 'h4', 'img', 'section', 'header', 'footer', 'nav', 'form', 'Link', 'NavLink', 'ul', 'li', 'table', 'th', 'td'])
const WITH_HOOK = new Set(['div', 'span', 'small', 'b', 'strong', 'em', 'p', 'i', 'article', 'aside', 'main', 'figure', 'time'])
const SKIP_FILE = /[\\/]src[\\/](pages[\\/]admin[\\/]|pages[\\/]Admin\.tsx$|components[\\/]Icons\.tsx$|main\.tsx$)/

// Minimal ESTree shapes (oxc parser output).
type N = { type: string; start: number; end: number; [k: string]: unknown }
const slug = (s: string, n = 24) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n).replace(/-+$/, '')
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9._*-]+/g, '-').replace(/-{2,}/g, '-').replace(/^[-.]+|[-.]+$/g, '').slice(0, 90)

function tagName(n: N): string {
  if (n.type === 'JSXIdentifier') return n.name as string
  if (n.type === 'JSXMemberExpression') return `${tagName(n.object as N)}.${(n.property as N).name as string}`
  return ''
}
function attr(el: N, name: string): N | undefined {
  return (el.attributes as N[]).find((a) => a.type === 'JSXAttribute' && (a.name as N).name === name)
}
/** tx('Hello') / t('chat.send') → readable label. */
function textCall(e: N | undefined): string | undefined {
  if (!e || e.type !== 'CallExpression') return undefined
  const callee = e.callee as N
  const a0 = (e.arguments as N[])[0]
  if (callee.type !== 'Identifier' || !['tx', 't'].includes(callee.name as string) || !a0) return undefined
  const v = a0.type === 'Literal' && typeof a0.value === 'string' ? a0.value : a0.type === 'TemplateLiteral' && (a0.expressions as N[]).length === 0 ? ((a0.quasis as N[])[0].value as { cooked: string }).cooked : undefined
  if (v === undefined) return undefined
  return callee.name === 't' ? v.split('.').pop() : v
}
/** Static text of an attribute; template literals keep their static parts with * for each ${…}. */
function staticValue(a: N | undefined): string | undefined {
  const v = a?.value as N | null | undefined
  if (!v) return undefined
  if (v.type === 'Literal' && typeof v.value === 'string') return v.value
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression as N
    if (e.type === 'Literal' && typeof e.value === 'string') return e.value
    if (e.type === 'TemplateLiteral') return (e.quasis as N[]).map((q) => (q.value as { cooked: string }).cooked).join('*').replace(/\*+/g, '*')
    return textCall(e)
  }
  return undefined
}
/** String literals at the leaves of a ?: chain, or undefined if any leaf isn't a literal. */
function condLiterals(e: N): string[] | undefined {
  if (e.type === 'Literal' && typeof e.value === 'string') return [e.value]
  if (e.type === 'ConditionalExpression') {
    const a = condLiterals(e.consequent as N), b = condLiterals(e.alternate as N)
    return a && b ? [...a, ...b] : undefined
  }
  return undefined
}
function firstClass(a: N | undefined): string | undefined {
  const v = staticValue(a)
  return v?.split(/\s+/).find((x) => x && !x.includes('*'))
}
function childLabel(el: N): string | undefined {
  for (const ch of (el.children as N[] | undefined) ?? []) {
    if (ch.type === 'JSXText' && String(ch.value).trim()) return String(ch.value).trim()
    if (ch.type === 'JSXExpressionContainer') { const v = textCall(ch.expression as N); if (v) return v }
  }
  return undefined
}

export function computeUiIds(code: string, file: string): { inserts: { pos: number; text: string }[]; entries: UiIdEntry[]; dynamic: DynamicEntry[]; props: Map<string, Set<string>> } {
  const { program } = parseSync(file, code, { lang: 'tsx' })
  const screen = path.basename(file).replace(/\.[jt]sx?$/, '').toLowerCase()
  const seen = new Map<string, number>()
  const inserts: { pos: number; text: string }[] = []
  const entries: UiIdEntry[] = []
  const dynamic: DynamicEntry[] = []
  /** Literal values seen for object keys (`test: 'x'`) and JSX props (`testId="x"`), to expand dynamic ids. */
  const props = new Map<string, Set<string>>()
  const addProp = (k: string, v: string) => { if (!props.has(k)) props.set(k, new Set()); props.get(k)!.add(v) }
  const visitEl = (el: N) => {
    const opening = el.openingElement as N
    const nameNode = opening.name as N
    const tag = tagName(nameNode)
    const explicit = staticValue(attr(opening, 'data-ui-id'))
    const testid = staticValue(attr(opening, 'data-testid'))
    const cls = firstClass(attr(opening, 'className'))
    const label = childLabel(el) ?? staticValue(attr(opening, 'aria-label')) ?? staticValue(attr(opening, 'placeholder')) ?? staticValue(attr(opening, 'title'))
    const tAttr = attr(opening, 'data-testid')
    const tExpr = !testid && (tAttr?.value as N | undefined)?.type === 'JSXExpressionContainer' ? ((tAttr!.value as N).expression as N) : undefined
    const wanted = ALWAYS.has(tag) || (WITH_HOOK.has(tag) && (testid || cls || tExpr))
    if (explicit && explicit.includes('*')) { /* runtime id for a mock (preview) element: the real one is listed */ }
    else if (explicit) entries.push({ id: explicit, screen, tag, label: label ?? '' })
    else if (wanted && tExpr && condLiterals(tExpr)) {
      // data-testid={a ? 'x' : 'y'} → the id follows the same choice at runtime.
      const src = code.slice(tExpr.start, tExpr.end)
      inserts.push({ pos: nameNode.end, text: ` data-ui-id={${JSON.stringify(`${screen}.`)} + (${src})}` })
      for (const v of condLiterals(tExpr)!) entries.push({ id: clean(`${screen}.${v}`), screen, tag, label: (label ?? v).slice(0, 60) })
    } else if (wanted && tExpr && ['Identifier', 'MemberExpression', 'LogicalExpression'].includes(tExpr.type)) {
      // data-testid={tab.test} / {testId} / {testId ?? 'x'} → id from the runtime value, else the static fallback.
      const lab = label && /[a-z]/i.test(label) ? slug(label) : ''
      const base = clean(`${screen}.${[tag.toLowerCase(), cls, lab].filter(Boolean).join('.')}`)
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      const fallback = n === 1 ? base : `${base}-${n}`
      const src = code.slice(tExpr.start, tExpr.end)
      inserts.push({ pos: nameNode.end, text: ` data-ui-id={((v) => v ? ${JSON.stringify(`${screen}.`)} + String(v).toLowerCase() : ${JSON.stringify(fallback)})(${src})}` })
      entries.push({ id: fallback, screen, tag, label: (label ?? cls ?? '').slice(0, 60) })
      let e = tExpr
      if (e.type === 'LogicalExpression') {
        const r = e.right as N
        if (r.type === 'Literal' && typeof r.value === 'string') entries.push({ id: clean(`${screen}.${r.value}`), screen, tag, label: r.value })
        e = e.left as N
      }
      if (e.type === 'MemberExpression' && (e.property as N).type === 'Identifier') dynamic.push({ screen, tag, label: label ?? '', prop: (e.property as N).name as string, kind: 'member' })
      if (e.type === 'Identifier') dynamic.push({ screen, tag, label: label ?? '', prop: e.name as string, kind: 'ident' })
    } else if (wanted) {
      const lab = label && /[a-z]/i.test(label) ? slug(label) : ''
      const base = clean(`${screen}.${testid ? testid : [tag.toLowerCase(), cls, lab].filter(Boolean).join('.')}`)
      const n = (seen.get(base) ?? 0) + 1
      seen.set(base, n)
      const id = n === 1 ? base : `${base}-${n}`
      inserts.push({ pos: nameNode.end, text: ` data-ui-id="${id}"` })
      entries.push({ id, screen, tag, label: (label ?? testid ?? cls ?? '').slice(0, 60) })
    }
  }
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { for (const x of node) walk(x); return }
    const n = node as N
    if (n.type === 'JSXElement') visitEl(n)
    if (n.type === 'Property' && (n.key as N)?.type === 'Identifier' && (n.value as N)?.type === 'Literal' && typeof (n.value as N).value === 'string') addProp(`member:${(n.key as N).name as string}`, (n.value as N).value as string)
    if (n.type === 'JSXAttribute') { const v = staticValue(n); const k = (n.name as N).name; if (v && typeof k === 'string' && !v.includes('*')) addProp(`ident:${k}`, v) }
    for (const k in n) if (k !== 'type' && k !== 'start' && k !== 'end') { const v = n[k]; if (v && typeof v === 'object') walk(v) }
  }
  walk(program)
  return { inserts, entries, dynamic, props }
}

function listTsx(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listTsx(p))
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

const VIRTUAL = 'virtual:ui-ids'
export function uiIds(): Plugin {
  let root = process.cwd()
  const manifest = new Map<string, ReturnType<typeof computeUiIds>>()
  const scan = () => {
    manifest.clear()
    for (const f of listTsx(path.join(root, 'src'))) if (!SKIP_FILE.test(f)) manifest.set(f, computeUiIds(fs.readFileSync(f, 'utf8'), f))
  }
  const all = () => {
    const seen = new Set<string>()
    const out: UiIdEntry[] = []
    const add = (e: UiIdEntry) => { if (!seen.has(e.id)) { seen.add(e.id); out.push(e) } }
    // JSX props (testId="x") count project-wide; object keys (test: 'x') only within their own file.
    const globalIdent = new Map<string, Set<string>>()
    for (const r of manifest.values()) for (const [k, vs] of r.props) if (k.startsWith('ident:')) { if (!globalIdent.has(k)) globalIdent.set(k, new Set()); vs.forEach((v) => globalIdent.get(k)!.add(v)) }
    for (const r of manifest.values()) {
      r.entries.forEach(add)
      for (const d of r.dynamic) {
        const vals = d.kind === 'member' ? r.props.get(`member:${d.prop}`) : globalIdent.get(`ident:${d.prop}`)
        for (const v of vals ?? []) add({ id: clean(`${d.screen}.${v}`), screen: d.screen, tag: d.tag, label: d.label || v })
      }
    }
    return out
  }
  return {
    name: 'pingo-ui-ids',
    enforce: 'pre',
    configResolved(c) { root = c.root },
    buildStart() { scan() },
    resolveId(id) { return id === VIRTUAL ? `\0${VIRTUAL}` : undefined },
    load(id) {
      if (id !== `\0${VIRTUAL}`) return undefined
      if (!manifest.size) scan()
      return `export default ${JSON.stringify(all())}`
    },
    transform(code, id) {
      const file = id.split('?')[0]
      if (!file.endsWith('.tsx') || file.includes('node_modules') || SKIP_FILE.test(file)) return undefined
      const r = computeUiIds(code, file)
      const { inserts } = r
      manifest.set(file, r)
      if (!inserts.length) return undefined
      let out = code
      for (const ins of [...inserts].sort((a, b) => b.pos - a.pos)) out = out.slice(0, ins.pos) + ins.text + out.slice(ins.pos)
      return { code: out, map: null }
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.tsx') || SKIP_FILE.test(ctx.file)) return
      const mod = ctx.server.moduleGraph.getModuleById(`\0${VIRTUAL}`)
      if (mod) ctx.server.moduleGraph.invalidateModule(mod)
    },
  }
}

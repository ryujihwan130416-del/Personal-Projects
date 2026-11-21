import { adminConfirm, at } from './adminI18n'
import { useMemo, useState } from 'react'
import UI_IDS from 'virtual:ui-ids'
import { LOCALES, type Locale } from '../../i18n'
import { FONTS } from '../../lib/theme'
import type { PickInfo } from '../../lib/inspector'
import { ALIGNS, EFFECTS, LIMITS, SHADOWS, type BaseStyle, type ColorSet, type ElementOverride, type ElementOverrides, type Fill, type Len } from '../../lib/uiElements'

type StateTab = 'base' | 'light' | 'dark' | 'hover' | 'active'
const STATE_TABS: [StateTab, string][] = [['base', 'Base'], ['light', 'Light only'], ['dark', 'Dark only'], ['hover', 'Hover'], ['active', 'Pressed']]
const toHex = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : c && /^#[0-9a-f]{3}$/i.test(c) ? `#${[...c.slice(1)].map((x) => x + x).join('')}` : '#000000')

function Num({ label, value, range, step = 1, unit = 'px', on, test }: { label: string; value?: number; range: readonly [number, number]; step?: number; unit?: string; on: (v?: number) => void; test: string }) {
  return (
    <label className="ei-field">
      <span>{label}</span>
      <input className="input" type="number" min={range[0]} max={range[1]} step={step} value={value ?? ''} placeholder="—" data-testid={test}
        onChange={(e) => { const v = e.target.value === '' ? undefined : Number(e.target.value); on(v === undefined || Number.isNaN(v) ? undefined : Math.min(range[1], Math.max(range[0], v))) }} />
      <small>{unit}</small>
      {value !== undefined ? <button type="button" className="mini-btn" title={at("Clear")} onClick={() => on(undefined)}>×</button> : <i />}
    </label>
  )
}
function Color({ label, value, on, test }: { label: string; value?: string; on: (v?: string) => void; test: string }) {
  return (
    <label className="ei-field">
      <span>{label}</span>
      <input type="color" value={toHex(value)} onChange={(e) => on(e.target.value)} data-testid={`${test}-pick`} />
      <input className="input mono" value={value ?? ''} placeholder="—" onChange={(e) => on(e.target.value || undefined)} data-testid={test} />
      {value ? <button type="button" className="mini-btn" title={at("Clear")} onClick={() => on(undefined)}>×</button> : <i />}
    </label>
  )
}
function FillField({ value, on, test }: { value?: Fill; on: (v?: Fill) => void; test: string }) {
  const kind = value?.kind ?? ''
  return (
    <div className="ei-fill">
      <label className="ei-field"><span>{at("Background")}</span>
        <select className="input" value={kind} data-testid={`${test}-kind`} onChange={(e) => {
          const k = e.target.value
          on(k === 'solid' ? { kind: 'solid', color: value?.kind === 'gradient' ? value.from : '#ff4d3a' } : k === 'gradient' ? { kind: 'gradient', from: value?.kind === 'solid' ? value.color : '#ff4d3a', to: '#7b5cff', angle: 135 } : undefined)
        }}>
          <option value="">{at("Default")}</option><option value="solid">{at("Solid color")}</option><option value="gradient">{at("Gradient")}</option>
        </select><i /><i />
      </label>
      {value?.kind === 'solid' ? <Color label={at("Color")} value={value.color} on={(c) => on(c ? { kind: 'solid', color: c } : undefined)} test={`${test}-color`} /> : null}
      {value?.kind === 'gradient' ? (
        <>
          <Color label={at("From")} value={value.from} on={(c) => on({ ...value, from: c ?? '#ffffff' })} test={`${test}-from`} />
          <Color label={at("To")} value={value.to} on={(c) => on({ ...value, to: c ?? '#000000' })} test={`${test}-to`} />
          <Num label={at("Angle")} value={value.angle} range={LIMITS.angle} unit="°" on={(a) => on({ ...value, angle: a ?? 135 })} test={`${test}-angle`} />
          <div className="ei-swatch" style={{ background: `linear-gradient(${value.angle}deg, ${value.from}, ${value.to})` }} />
        </>
      ) : null}
    </div>
  )
}
function LenField({ label, value, on, test }: { label: string; value?: Len; on: (v?: Len) => void; test: string }) {
  const unit = value === undefined ? '' : value === 'auto' ? 'auto' : value.unit
  return (
    <label className="ei-field">
      <span>{label}</span>
      <input className="input" type="number" disabled={unit === 'auto' || unit === ''} value={value && value !== 'auto' ? value.v : ''} placeholder="—" data-testid={test}
        onChange={(e) => { if (value && value !== 'auto') on({ ...value, v: Math.max(0, Math.min(value.unit === 'px' ? LIMITS.px[1] : 100, Number(e.target.value) || 0)) }) }} />
      <select className="input" value={unit} data-testid={`${test}-unit`} onChange={(e) => { const u = e.target.value; on(u === '' ? undefined : u === 'auto' ? 'auto' : { v: value && value !== 'auto' ? value.v : u === '%' ? 100 : 120, unit: u as 'px' | '%' }) }}>
        <option value="">{at("Default")}</option><option value="px">{at("px")}</option><option value="%">%</option><option value="auto">{at("auto")}</option>
      </select>
      <i />
    </label>
  )
}

export interface InspectorProps {
  elements: ElementOverrides
  setEl: (id: string, fn: (o: ElementOverride) => ElementOverride) => void
  resetEl: (id: string) => void
  resetAll: () => void
  selected: string
  select: (id: string) => void
  pick: PickInfo | null
  count: number | null
  inspecting: boolean
  setInspecting: (v: boolean) => void
  /** How many elements are selected (Shift+click); edits apply to all of them. */
  multi?: number
}

export function ElementInspector({ elements, setEl, resetEl, resetAll, selected, select, pick, count, inspecting, setInspecting, multi = 1 }: InspectorProps) {
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<StateTab>('base')
  const [lang, setLang] = useState<'all' | Locale>('all')
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return UI_IDS.filter((e) => e.id.includes(s) || e.label.toLowerCase().includes(s)).slice(0, 40)
  }, [q])
  const overridden = Object.keys(elements).sort()
  const o: ElementOverride = elements[selected] ?? {}
  const meta = UI_IDS.find((e) => e.id === selected)
  const info = pick && pick.id === selected ? pick : null
  const set = (fn: (x: ElementOverride) => void) => setEl(selected, (x) => { const c = structuredClone(x); fn(c); return c })
  const setBase = <K extends keyof BaseStyle>(k: K, v: BaseStyle[K] | undefined) => set((x) => { x.base = { ...(x.base ?? {}), [k]: v } })
  const cs: ColorSet = tab === 'base' ? (o.base ?? {}) : (o[tab] ?? {})
  const setCs = <K extends keyof ColorSet>(k: K, v: ColorSet[K] | undefined) => set((x) => {
    if (tab === 'base') x.base = { ...(x.base ?? {}), [k]: v }
    else x[tab] = { ...(x[tab] ?? {}), [k]: v }
  })
  const b = o.base ?? {}

  return (
    <section className="a-card ei" data-testid="ei">
      <header><h3>{at("Elements")}</h3><small className="a-note">{at("Edit any single element. {0} elements across the app.", [UI_IDS.length])}</small></header>
      <div className="ei-top">
        <button type="button" className={`btn ${inspecting ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setInspecting(!inspecting)} data-testid="ei-inspect">🎯 {inspecting ? at("Inspecting — click an element in the preview") : at("Inspect preview")}</button>
      </div>
      <input className="input" placeholder={at("Find any element by name, text or id…")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="ei-search" />
      {results.length ? (
        <div className="ei-results" data-testid="ei-results">
          {results.map((r) => (
            <button key={r.id} type="button" className="ei-result" onClick={() => { select(r.id); setQ('') }} data-testid="ei-result">
              <code>{r.id}</code><small>{r.tag}{r.label ? ` · ${r.label}` : ''}</small>
            </button>
          ))}
        </div>
      ) : null}

      <div className="ei-overrides">
        <div className="ei-row"><b>{at("Overrides ({0})", [overridden.length])}</b>
          {overridden.length ? <button type="button" className="mini-btn danger" onClick={async () => { if (await adminConfirm(at("Remove every element override from the draft?"))) resetAll() }} data-testid="ei-reset-all">{at("Reset all elements")}</button> : null}
        </div>
        {overridden.length ? overridden.map((id) => (
          <div key={id} className={`ei-chip ${id === selected ? 'on' : ''}`} data-testid="ei-override">
            <button type="button" onClick={() => select(id)}><code>{id}</code></button>
            <button type="button" className="mini-btn" title={at("Reset this element")} onClick={() => resetEl(id)} data-testid="ei-override-reset">↺</button>
          </div>
        )) : <small className="a-note">{at("None yet — inspect the preview or search above.")}</small>}
      </div>

      {selected ? (
        <div className="ei-editor" data-testid="ei-editor">
          <div className="ei-sel">
            <code data-testid="ei-selected">{selected}</code>
            {multi > 1 ? <small className="ei-multi" data-testid="ei-multi">{at("{0} elements selected — changes apply to all", [multi])}</small> : null}
            <small>{(info?.tag ?? meta?.tag ?? '').toLowerCase()}{count !== null ? at(" · {0} on this screen", [count]) : ''}{count === 0 ? at(" (not shown on this preview screen)") : ''}{count && count > 1 ? at(" — all of them change together") : ''}</small>
            {info?.ancestors.length ? <div className="ei-crumbs">{at("Parent:")}{' '}{info.ancestors.slice(0, 3).map((a) => <button key={a} type="button" className="mini-btn" onClick={() => select(a)} data-testid="ei-parent">{a.split('.').slice(1).join('.') || a}</button>)}</div> : null}
            {elements[selected] ? <button type="button" className="mini-btn" onClick={() => resetEl(selected)} data-testid="ei-reset">{at("Reset this element")}</button> : null}
          </div>

          <fieldset className="ei-group"><legend>{at("Text & label")}</legend>
            <label className="ei-field"><span>{at("Language")}</span>
              <select className="input" value={lang} onChange={(e) => setLang(e.target.value as 'all' | Locale)} data-testid="ei-text-lang">
                <option value="all">{at("All languages")}</option>
                {LOCALES.map((l) => <option key={l.id} value={l.id}>{at("Only")}{' '}{l.name}{o.text?.[l.id] ? ' •' : ''}</option>)}
              </select><i /><i />
            </label>
            <label className="ei-field wide"><span>{info?.isInput ? at("Placeholder") : at("Text")}</span>
              <input className="input" maxLength={300} value={o.text?.[lang] ?? ''} placeholder={lang === 'all' ? info?.text || meta?.label || at("Stock text") : o.text?.all || info?.text || at("Stock text")} data-testid="ei-text"
                onChange={(e) => set((x) => { const t = { ...(x.text ?? {}) }; if (e.target.value) t[lang] = e.target.value; else delete t[lang]; x.text = t })} />
            </label>
            <label className="ei-field"><span>{at("Icon")}</span>
              <select className="input" value={!o.icon ? '' : o.icon === 'none' ? 'none' : 'emoji'} data-testid="ei-icon-mode" onChange={(e) => set((x) => { x.icon = e.target.value === 'none' ? 'none' : e.target.value === 'emoji' ? '⭐' : undefined })}>
                <option value="">{at("Keep")}</option><option value="none">{at("Hide icon")}</option><option value="emoji">{at("Emoji instead")}</option>
              </select>
              {o.icon && o.icon !== 'none' ? <input className="input" value={o.icon} maxLength={8} onChange={(e) => set((x) => { x.icon = e.target.value || undefined })} data-testid="ei-icon" /> : <i />}
              <i />
            </label>
            <label className="ei-check"><input type="checkbox" checked={!!o.hide} onChange={(e) => set((x) => { x.hide = e.target.checked || undefined })} data-testid="ei-hide" />{' '}{at("Hide this element")}</label>
          </fieldset>

          <fieldset className="ei-group"><legend>{at("Colors")}</legend>
            <div className="seg ei-tabs">{STATE_TABS.map(([k, l]) => <button key={k} type="button" className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`ei-tab-${k}`}>{at(l)}{k !== 'base' && o[k] ? ' •' : ''}</button>)}</div>
            <FillField value={cs.bg} on={(v) => setCs('bg', v)} test="ei-bg" />
            <Color label={at("Text")} value={cs.color} on={(v) => setCs('color', v)} test="ei-color" />
            <Color label={at("Border")} value={cs.borderColor} on={(v) => setCs('borderColor', v)} test="ei-border" />
          </fieldset>

          {tab === 'base' ? (
            <>
              <fieldset className="ei-group"><legend>{at("Typography")}</legend>
                <label className="ei-field"><span>{at("Font")}</span>
                  <select className="input" value={b.font ?? ''} onChange={(e) => setBase('font', e.target.value || undefined)} data-testid="ei-font">
                    {FONTS.map((f) => <option key={f.family} value={f.family}>{f.family || at("App font")}</option>)}
                  </select><i /><i />
                </label>
                <Num label={at("Size")} value={b.fontSize} range={LIMITS.fontSize} on={(v) => setBase('fontSize', v)} test="ei-fontsize" />
                <label className="ei-field"><span>{at("Weight")}</span>
                  <select className="input" value={b.fontWeight ?? ''} onChange={(e) => setBase('fontWeight', e.target.value ? Number(e.target.value) : undefined)} data-testid="ei-weight">
                    <option value="">{at("Default")}</option>{[300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select><i /><i />
                </label>
              </fieldset>
              <fieldset className="ei-group"><legend>{at("Spacing")}</legend>
                <Num label={at("Padding ↕")} value={b.padY} range={LIMITS.padY} on={(v) => setBase('padY', v)} test="ei-pady" />
                <Num label={at("Padding ↔")} value={b.padX} range={LIMITS.padX} on={(v) => setBase('padX', v)} test="ei-padx" />
                <Num label={at("Margin ↕")} value={b.marY} range={LIMITS.marY} on={(v) => setBase('marY', v)} test="ei-mary" />
                <Num label={at("Margin ↔")} value={b.marX} range={LIMITS.marX} on={(v) => setBase('marX', v)} test="ei-marx" />
                <Num label={at("Gap")} value={b.gap} range={LIMITS.gap} on={(v) => setBase('gap', v)} test="ei-gap" />
              </fieldset>
              <fieldset className="ei-group"><legend>{at("Size & shape")}</legend>
                <LenField label={at("Width")} value={b.width} on={(v) => setBase('width', v)} test="ei-width" />
                <LenField label={at("Height")} value={b.height} on={(v) => setBase('height', v)} test="ei-height" />
                <Num label={at("Radius")} value={b.radius} range={LIMITS.radius} on={(v) => setBase('radius', v)} test="ei-radius" />
                <Num label={at("Border width")} value={b.borderWidth} range={LIMITS.borderWidth} on={(v) => setBase('borderWidth', v)} test="ei-borderwidth" />
                <label className="ei-field"><span>{at("Shadow")}</span>
                  <select className="input" value={b.shadow ?? ''} onChange={(e) => setBase('shadow', (e.target.value || undefined) as BaseStyle['shadow'])} data-testid="ei-shadow">
                    <option value="">{at("Default")}</option>{SHADOWS.map((s) => <option key={s} value={s}>{at(s)}</option>)}
                  </select><i /><i />
                </label>
                <Num label={at("Opacity")} value={b.opacity} range={LIMITS.opacity} step={0.05} unit="" on={(v) => setBase('opacity', v)} test="ei-opacity" />
                <Num label={at("Move ↔")} value={b.tx} range={LIMITS.move} on={(v) => setBase('tx', v === undefined ? undefined : Math.round(v))} test="ei-tx" />
                <Num label={at("Move ↕")} value={b.ty} range={LIMITS.move} on={(v) => setBase('ty', v === undefined ? undefined : Math.round(v))} test="ei-ty" />
                <label className="ei-field"><span>{at("Align")}</span>
                  <select className="input" value={b.align ?? ''} onChange={(e) => setBase('align', (e.target.value || undefined) as BaseStyle['align'])} data-testid="ei-align">
                    <option value="">{at("Default")}</option>{ALIGNS.map((a) => <option key={a} value={a}>{at(a)}</option>)}
                  </select><i /><i />
                </label>
                <label className="ei-field"><span>{at("Effect")}</span>
                  <select className="input" value={b.effect ?? ''} onChange={(e) => setBase('effect', (e.target.value || undefined) as BaseStyle['effect'])} data-testid="ei-effect">
                    <option value="">{at("Default")}</option>{EFFECTS.map((a) => <option key={a} value={a}>{at(a)}</option>)}
                  </select><i /><i />
                </label>
                <Num label={at("Order")} value={b.order} range={LIMITS.order} unit="" on={(v) => setBase('order', v === undefined ? undefined : Math.round(v))} test="ei-order" />
                {b.order !== undefined && info && !info.inFlex ? <small className="a-note">{at("Order only moves items inside a row/column layout; this element's parent isn't one, so it has no effect.")}</small> : <small className="a-note">{at("Order moves the element among its siblings without changing the page structure.")}</small>}
              </fieldset>
            </>
          ) : <small className="a-note">{tab === 'hover' ? at("Used while the pointer is over the element (and keyboard focus).") : tab === 'active' ? at("Used while the element is pressed, or toggled on.") : at("Used only in {0} mode; overrides Base colors there.", [tab])}</small>}
        </div>
      ) : <p className="a-note">{at("Select an element to edit it.")}</p>}
    </section>
  )
}

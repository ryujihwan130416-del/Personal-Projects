import { adminConfirm, at } from './adminI18n'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../../firebase/app'
import { ALL_CATEGORIES, CATEGORY_LABEL, DEFAULT_MODERATION, DEFAULT_MODES, DEFAULT_USER_FILTER, FILTER_LEVELS, LEVEL_CATS, LIST_CATEGORIES, detect, useModerationConfig, type CategoryMode, type FilterLevel, type FlagCategory, type ListCategory, type ModerationConfig, type UserFilter } from '../../lib/moderation'
import { CatPills, useAdmin } from './shared'

const toText = (a: string[]) => a.join('\n')
const toList = (s: string) => [...new Set(s.split(/\n|,/).map((x) => x.trim()).filter(Boolean))]

export function Filter() {
  const { toast } = useAdmin()
  const cfg = useModerationConfig()
  const [draft, setDraft] = useState<Record<ListCategory | 'allow', string>>(() => ({ ...Object.fromEntries(LIST_CATEGORIES.map((c) => [c, toText(cfg.lists[c])])), allow: toText(cfg.allow) }) as Record<ListCategory | 'allow', string>)
  const [flags, setFlags] = useState({ caps: cfg.caps, repetition: cfg.repetition, links: cfg.links })
  const [modes, setModes] = useState<Record<FlagCategory, CategoryMode>>(cfg.modes)
  const [minLevel, setMinLevel] = useState<FilterLevel>(cfg.minLevel)
  const [defaults, setDefaults] = useState<UserFilter>(cfg.userDefaults)
  const [test, setTest] = useState('')
  const [dirty, setDirty] = useState(false)
  useEffect(() => {
    if (dirty) return
    setDraft({ ...Object.fromEntries(LIST_CATEGORIES.map((c) => [c, toText(cfg.lists[c])])), allow: toText(cfg.allow) } as Record<ListCategory | 'allow', string>)
    setFlags({ caps: cfg.caps, repetition: cfg.repetition, links: cfg.links })
    setModes(cfg.modes); setMinLevel(cfg.minLevel); setDefaults(cfg.userDefaults)
  }, [cfg, dirty])

  const current = (): ModerationConfig => ({ lists: Object.fromEntries(LIST_CATEGORIES.map((c) => [c, toList(draft[c])])) as ModerationConfig['lists'], allow: toList(draft.allow), ...flags, modes, minLevel, userDefaults: defaults })
  const save = async () => {
    try { await setDoc(doc(db, ...fsCol('config', 'moderation')), { ...current(), updatedAt: serverTimestamp() }); setDirty(false); toast(at("Filter saved — the app uses it right away")) } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) }
  }
  const reset = async () => {
    if (!(await adminConfirm(at("Replace the lists with the built-in defaults? (Not saved until you press Save.)")))) return
    setDraft({ ...Object.fromEntries(LIST_CATEGORIES.map((c) => [c, toText(DEFAULT_MODERATION.lists[c])])), allow: toText(DEFAULT_MODERATION.allow) } as Record<ListCategory | 'allow', string>)
    setFlags({ caps: true, repetition: true, links: true }); setModes(DEFAULT_MODES); setMinLevel('off'); setDefaults(DEFAULT_USER_FILTER); setDirty(true)
  }
  const result = test.trim() ? detect(test, current()) : null
  const edit = (k: ListCategory | 'allow', v: string) => { setDraft((d) => ({ ...d, [k]: v })); setDirty(true) }

  return (
    <div className="a-filter-page">
      <section className="a-card a-tester">
        <header><h3>{at("Try the filter")}</h3><small>{at("Uses the lists below, including unsaved edits")}</small></header>
        <input className="input" placeholder={at("Type a message to test, e.g. “f u c k” or “시 발”")} value={test} onChange={(e) => setTest(e.target.value)} data-testid="filter-test" />
        <div className="a-test-result" data-testid="filter-result">{!test.trim() ? <small>{at("Matches show here.")}</small> : result ? <><CatPills cats={result.categories} /> <small>{at("matched")}{' '}{result.terms.join(', ')}</small></> : <span className="a-pill ok">{at("Clean")}</span>}</div>
        <p className="a-note">{at("Matching ignores case, spacing (“f u c k”), repeated letters (“fuuuck”) and l33t (“sh1t”, “b!tch”). Words of 4 letters or fewer must match a whole word; longer words and Korean also match inside text. Use the allowlist for false positives.")}</p>
      </section>
      <section className="a-card a-policy" data-testid="filter-policy">
        <header><h3>{at("Chat filter for everyone")}</h3><small>{at("Users tune their own filter in Settings; these are the defaults and the rules they can’t go below. Flags are recorded in every mode.")}</small></header>
        <div className="a-policy-grid">
          <label>{at("Default level for new users")}<select className="input" value={defaults.level} onChange={(e) => { setDefaults({ ...defaults, level: e.target.value as FilterLevel }); setDirty(true) }} data-testid="policy-default-level">
              {FILTER_LEVELS.map((l) => <option key={l} value={l}>{at(l[0].toUpperCase() + l.slice(1))}</option>)}
            </select>
          </label>
          <label>{at("Minimum level (enforced)")}<select className="input" value={minLevel} onChange={(e) => { setMinLevel(e.target.value as FilterLevel); setDirty(true) }} data-testid="policy-min-level">
              {FILTER_LEVELS.map((l) => <option key={l} value={l}>{l === 'off' ? at("None") : at(l[0].toUpperCase() + l.slice(1))} {l !== 'off' ? at("({0} categories)", [LEVEL_CATS[l].length]) : ''}</option>)}
            </select>
          </label>
          <label className="a-check"><input type="checkbox" checked={defaults.mask} onChange={(e) => { setDefaults({ ...defaults, mask: e.target.checked }); setDirty(true) }} />{' '}{at("Mask words with *** by default")}</label>
          <label className="a-check"><input type="checkbox" checked={defaults.blur} onChange={(e) => { setDefaults({ ...defaults, blur: e.target.checked }); setDirty(true) }} />{' '}{at("Blur flagged messages by default")}</label>
        </div>
        <table className="a-table a-modes">
          <thead><tr><th>{at("Category")}</th><th>{at("Log only")}</th><th>{at("Mask for everyone")}</th><th>{at("Block sending")}</th></tr></thead>
          <tbody>
            {ALL_CATEGORIES.map((c) => (
              <tr key={c}>
                <td>{at(CATEGORY_LABEL[c])}</td>
                {(['log', 'mask', 'block'] as const).map((m) => (
                  <td key={m}><input type="radio" name={`mode-${c}`} checked={modes[c] === m} onChange={() => { setModes({ ...modes, [c]: m }); setDirty(true) }} data-testid={`mode-${c}-${m}`} aria-label={`${at(CATEGORY_LABEL[c])}: ${at(m)}`} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="a-note">{at("Block sending stops the message on the sender’s device and shows them a friendly “message not sent” note. It runs in the app (no server functions), so it is a strong nudge rather than a hard guarantee.")}</p>
      </section>
      <div className="a-word-grid">
        {LIST_CATEGORIES.map((c) => (
          <label key={c} className="a-card a-words">
            <header><h3>{at(CATEGORY_LABEL[c])}</h3><small>{toList(draft[c]).length}{' '}{at("terms")}</small></header>
            <textarea className="input textarea mono" rows={8} value={draft[c]} onChange={(e) => edit(c, e.target.value)} data-testid={`words-${c}`} />
          </label>
        ))}
        <label className="a-card a-words">
          <header><h3>{at("Allowlist")}</h3><small>{at("never flagged")}</small></header>
          <textarea className="input textarea mono" rows={8} value={draft.allow} onChange={(e) => edit('allow', e.target.value)} data-testid="words-allow" />
        </label>
        <div className="a-card a-words">
          <header><h3>{at("Pattern checks")}</h3></header>
          {([['caps', 'Excessive CAPS (80%+ of 12+ letters)'], ['repetition', 'Repetition / flooding'], ['links', 'Many or suspicious links']] as const).map(([k, l]) => (
            <label key={k} className="a-check"><input type="checkbox" checked={flags[k]} onChange={(e) => { setFlags((f) => ({ ...f, [k]: e.target.checked })); setDirty(true) }} /> {at(l)}</label>
          ))}
        </div>
      </div>
      <div className="a-sticky-save">
        <span>{dirty ? at("Unsaved changes") : at("All changes saved")}</span>
        <button type="button" className="btn btn-ghost" onClick={reset}>{at("Reset to defaults")}</button>
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => void save()} data-testid="filter-save">{at("Save filter")}</button>
      </div>
    </div>
  )
}

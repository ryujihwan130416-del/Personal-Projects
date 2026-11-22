import { tx } from '../i18n'
import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack } from '../components/Icons'
import { ProfileCard } from '../components/ProfileCard'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { fileToDataUrl } from '../lib/media'
import {
  BADGES, EFFECTS, FRAMES, GRADIENTS, LAYOUTS, NAME_FONTS, PATTERNS,
  earnedBadges, loadFunStats, saveProfileStyle, useProfileStyle, type FunStats, type ProfileStyle,
} from '../lib/profileStyle'

const THEME_COLORS = ['#ff4f9a', '#ff8a3d', '#ffd23f', '#5ee0a0', '#14b886', '#38c6ff', '#2f8cff', '#7b5cff', '#c05cff', '#1a1530']
const STATUS_EMOJI = ['😊', '😎', '🎮', '📚', '🎧', '☕', '💤', '🏃', '✈️', '🍕', '💼', '🌙']

export function ProfileCustomizePage() {
  const { profile, user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const { style: saved, loaded } = useProfileStyle(user?.uid)
  const [draft, setDraft] = useState<ProfileStyle | null>(null)
  const [stats, setStats] = useState<FunStats | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (loaded && !draft) setDraft({ layout: 'classic', ...saved }) }, [loaded, saved, draft])
  useEffect(() => { if (user) void loadFunStats(user.uid).then(setStats) }, [user])

  const joined = profile?.createdAt?.toMillis?.() ?? 0
  const earned = useMemo(() => (stats ? earnedBadges(stats, joined, true) : ['pal']), [stats, joined])
  if (!profile || !user || !draft) return <div className="spinner" />
  const set = (patch: Partial<ProfileStyle>) => setDraft({ ...draft, ...patch })
  const bgKind = draft.bg?.kind ?? 'none'
  const dirty = JSON.stringify(draft) !== JSON.stringify({ layout: 'classic', ...saved })

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try { set({ bg: { kind: 'photo', photo: await fileToDataUrl(f) } }) } catch (err) { toast(err instanceof Error ? err.message : tx('Could not use that photo')) }
  }
  const toggleBadge = (id: string) => {
    const cur = draft.badges ?? []
    if (cur.includes(id)) set({ badges: cur.filter((b) => b !== id) })
    else if (cur.length >= 6) toast(tx("Up to 6 badges"))
    else set({ badges: [...cur, id] })
  }
  const links = draft.links ?? []
  const save = async () => {
    setBusy(true)
    try { await saveProfileStyle(user.uid, draft); toast(tx("Profile style saved ✨")); nav('/profile') }
    catch (err) { toast(err instanceof Error ? err.message : tx('Could not save')) }
    finally { setBusy(false) }
  }

  return (
    <div className="screen" data-testid="customize-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={tx("Back")}><IconBack /></button>
        <h2>{tx("Customize profile")}</h2>
      </div>
      <div className="pc-edit">
        <div className="pc-controls">
          <section className="pc-card">
            <h4>{tx("Card layout")}</h4>
            <div className="pc-choices">
              {LAYOUTS.map((l) => <button key={l.id} type="button" className={draft.layout === l.id ? 'on' : ''} onClick={() => set({ layout: l.id })} data-testid={`pc-layout-${l.id}`}>{tx(l.label)}</button>)}
            </div>
            <h4>{tx("Theme colour")}</h4>
            <div className="pc-swatches">
              {THEME_COLORS.map((c) => <button key={c} type="button" aria-label={c} className={draft.themeColor === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ themeColor: c })} data-testid={`pc-theme-${c.slice(1)}`} />)}
              <input type="color" value={draft.themeColor ?? '#7b5cff'} onChange={(e) => set({ themeColor: e.target.value })} aria-label={tx("Custom theme colour")} data-testid="pc-theme-custom" />
            </div>
          </section>
          <section className="pc-card">
            <h4>{tx("Background")}</h4>
            <div className="pc-choices">
              {(['none', 'gradient', 'pattern', 'photo'] as const).map((k) => (
                <button key={k} type="button" className={bgKind === k ? 'on' : ''} data-testid={`pc-bg-${k}`}
                  onClick={() => set({ bg: k === 'none' ? { kind: 'none' } : k === 'gradient' ? { kind: k, value: 'aurora' } : k === 'pattern' ? { kind: k, value: 'dots' } : { kind: 'photo', photo: draft.bg?.photo } })}>
                  {k[0].toUpperCase() + k.slice(1)}
                </button>
              ))}
            </div>
            {bgKind === 'gradient' || bgKind === 'pattern' ? (
              <div className="pc-swatches">
                {Object.entries(bgKind === 'gradient' ? GRADIENTS : PATTERNS).map(([id, css]) => (
                  <button key={id} type="button" title={id} aria-label={id} className={draft.bg?.value === id ? 'on' : ''} style={{ background: css }} onClick={() => set({ bg: { kind: bgKind, value: id } })} data-testid={`pc-bgv-${id}`} />
                ))}
              </div>
            ) : null}
            {bgKind === 'photo' ? (
              <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                {draft.bg?.photo ? tx('Change photo') : tx('Choose a photo')}
                <input className="hidden-file" type="file" accept="image/*" onChange={(e) => void onPhoto(e)} data-testid="pc-bg-photo" />
              </label>
            ) : null}
          </section>
          <section className="pc-card">
            <h4>{tx("Avatar frame")}</h4>
            <div className="pc-choices">
              {FRAMES.map((f) => <button key={f.id} type="button" className={(draft.frame ?? 'none') === f.id ? 'on' : ''} onClick={() => set({ frame: f.id })} data-testid={`pc-frame-${f.id}`}>{tx(f.label)}</button>)}
            </div>
            <h4>{tx("Avatar effect")}</h4>
            <div className="pc-choices">
              {EFFECTS.map((f) => <button key={f.id} type="button" className={(draft.effect ?? 'none') === f.id ? 'on' : ''} onClick={() => set({ effect: f.id })} data-testid={`pc-effect-${f.id}`}>{tx(f.label)}</button>)}
            </div>
          </section>
          <section className="pc-card">
            <h4>{tx("Name style")}</h4>
            <div className="pc-row">
              <span>{tx("Colour")}</span>
              <input type="color" value={draft.nameColor ?? '#1a1530'} onChange={(e) => set({ nameColor: e.target.value })} data-testid="pc-name-color" />
              <button type="button" className="btn btn-text" onClick={() => set({ nameColor: undefined })}>{tx("Default")}</button>
            </div>
            <select className="input" value={draft.nameFont ?? ''} onChange={(e) => set({ nameFont: e.target.value || undefined })} data-testid="pc-name-font">
              {NAME_FONTS.map((f) => <option key={f.family} value={f.family}>{f.family || tx('App font')}</option>)}
            </select>
          </section>
          <section className="pc-card">
            <h4>{tx("Status")}</h4>
            <div className="pc-choices">
              {STATUS_EMOJI.map((e) => <button key={e} type="button" className={draft.status?.emoji === e ? 'on' : ''} onClick={() => set({ status: { ...draft.status, emoji: draft.status?.emoji === e ? '' : e } })} data-testid={`pc-emoji-${e}`}>{e}</button>)}
            </div>
            <input className="input" maxLength={80} placeholder={tx("What's up?")} value={draft.status?.text ?? ''} onChange={(e) => set({ status: { ...draft.status, text: e.target.value } })} data-testid="pc-status" />
          </section>
          <section className="pc-card">
            <h4>{tx("Badge showcase")} <small>{tx("(pick up to 6)")}</small></h4>
            <div className="pc-choices">
              {BADGES.map((b) => {
                const ok = earned.includes(b.id)
                return (
                  <button key={b.id} type="button" disabled={!ok} title={tx(b.hint)} className={draft.badges?.includes(b.id) ? 'on' : ''} onClick={() => toggleBadge(b.id)} data-testid={`pc-badge-${b.id}`} style={ok ? undefined : { opacity: 0.4 }}>
                    {b.emoji} {tx(b.label)}{ok ? '' : ' 🔒'}
                  </button>
                )
              })}
            </div>
            <label className="pc-row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={!!draft.showStats} onChange={(e) => set({ showStats: e.target.checked })} data-testid="pc-stats" />
              <span>{tx("Show fun game stats")}</span>
            </label>
          </section>
          <section className="pc-card">
            <h4>{tx("Favourite song")}</h4>
            <input className="input" maxLength={80} placeholder={tx("Song title")} value={draft.music?.title ?? ''} onChange={(e) => set({ music: { ...draft.music, title: e.target.value } })} data-testid="pc-music-title" />
            <input className="input" maxLength={80} placeholder={tx("Artist")} value={draft.music?.artist ?? ''} onChange={(e) => set({ music: { ...draft.music, artist: e.target.value } })} data-testid="pc-music-artist" />
            <input className="input" maxLength={300} placeholder={tx("Link (optional)")} value={draft.music?.url ?? ''} onChange={(e) => set({ music: { ...draft.music, url: e.target.value } })} data-testid="pc-music-url" />
          </section>
          <section className="pc-card">
            <h4>{tx("Links")} <small>({links.length}/5)</small></h4>
            {links.map((l, i) => (
              <div className="pc-link-row" key={i}>
                <input className="input" placeholder={tx("Label")} maxLength={30} value={l.label} onChange={(e) => set({ links: links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} data-testid={`pc-link-label-${i}`} />
                <input className="input" placeholder={tx("https://")} maxLength={300} value={l.url} onChange={(e) => set({ links: links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} data-testid={`pc-link-url-${i}`} />
                <button type="button" className="icon-btn" aria-label={tx("Remove link")} onClick={() => set({ links: links.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            {links.length < 5 ? <button type="button" className="btn btn-ghost" onClick={() => set({ links: [...links, { label: '', url: '' }] })} data-testid="pc-link-add">{tx("+ Add link")}</button> : null}
          </section>
          <div className="pc-save">
            <button type="button" className="btn btn-ghost" onClick={() => setDraft({ layout: 'classic' })} data-testid="pc-clear">{tx("Start fresh")}</button>
            <button type="button" className="btn btn-primary" disabled={busy || !dirty} onClick={() => void save()} data-testid="pc-save">{dirty ? tx('Save') : tx('Saved')}</button>
          </div>
        </div>
        <div className="pc-preview" data-testid="pc-preview">
          <div className="pv-label">{dirty ? tx('Live preview · not saved yet') : tx('Live preview')}</div>
          <ProfileCard person={profile} style={previewStyle(draft)} stats={stats}>
            <div className="profile-actions"><span className="btn btn-primary" aria-hidden="true">{tx("Message")}</span><span className="btn btn-lime" aria-hidden="true">{tx("Follow")}</span></div>
          </ProfileCard>
        </div>
      </div>
    </div>
  )
}

/** Preview shows links even while half-typed, but never unsafe ones. */
function previewStyle(d: ProfileStyle): ProfileStyle {
  return { ...d, links: (d.links ?? []).filter((l) => /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}/i.test(l.url.trim())).map((l) => ({ ...l, url: /^https?:\/\//i.test(l.url) ? l.url : `https://${l.url}` })) }
}

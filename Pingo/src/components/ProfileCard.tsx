import { tx } from '../i18n'
import { useEffect, type ReactNode } from 'react'
import type { UserProfile } from '../types'
import { ensureFont } from '../lib/theme'
import { GRADIENTS, PATTERNS, badgeById, type FunStats, type ProfileStyle } from '../lib/profileStyle'
import { Avatar } from './Avatar'

export function bgCss(style: ProfileStyle): string | undefined {
  const b = style.bg
  if (!b || b.kind === 'none') return undefined
  if (b.kind === 'gradient') return GRADIENTS[b.value ?? ''] 
  if (b.kind === 'pattern') return PATTERNS[b.value ?? '']
  if (b.kind === 'photo' && b.photo) return `center / cover no-repeat url("${b.photo}")`
  return undefined
}

function Effect({ id }: { id?: string }) {
  if (!id || id === 'none') return null
  if (id === 'sparkle' || id === 'hearts' || id === 'snow') {
    const ch = id === 'sparkle' ? '✨' : id === 'hearts' ? '💕' : '❄️'
    return <span className={`pfx pfx-${id}`} aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }}>{ch}</i>)}</span>
  }
  return null
}

/**
 * The decorated top of a profile (background, framed avatar + effect, name, status, badges, fun stats,
 * music, links) in one of four layouts. Used on profile pages and as the live preview while editing.
 */
export function ProfileCard({ person, style, stats, online, onAvatar, ring, children }: {
  person: Pick<UserProfile, 'displayName' | 'username' | 'photoURL' | 'bio' | 'link'>
  style: ProfileStyle
  stats?: FunStats | null
  online?: boolean
  onAvatar?: () => void
  ring?: 'seen' | 'unseen'
  children?: ReactNode
}) {
  const layout = style.layout ?? 'classic'
  const bg = bgCss(style)
  useEffect(() => { ensureFont(style.nameFont) }, [style.nameFont])
  const href = person.link ? (person.link.startsWith('http') ? person.link : `https://${person.link}`) : ''
  const theme = style.themeColor
  return (
    <div className={`pcard pcard-${layout} ${bg ? 'has-bg' : ''}`} data-testid="profile-card" data-layout={layout} style={theme ? { ['--pc' as string]: theme } : undefined}>
      {layout !== 'minimal' ? <div className="pcard-bg" style={{ background: bg }} data-testid="profile-bg" /> : null}
      <div className="pcard-body">
        <div className={`pavatar frame-${style.frame ?? 'none'} fx-${style.effect ?? 'none'}`} data-testid="profile-avatar">
          <Avatar name={person.displayName} photoURL={person.photoURL} size={layout === 'minimal' ? 84 : 112} online={online} onClick={onAvatar} testId="profile-photo" ring={ring} />
          <Effect id={style.effect} />
        </div>
        <h2 data-testid="profile-name" style={{ color: style.nameColor || undefined, fontFamily: style.nameFont ? `'${style.nameFont}', var(--font)` : undefined }}>{person.displayName}</h2>
        <div className="at">@{person.username}</div>
        {style.status?.text || style.status?.emoji ? <div className="pstatus" data-testid="profile-status"><span>{style.status.emoji}</span>{style.status.text}</div> : null}
        {person.bio ? <p className="bio">{person.bio}</p> : null}
        {href ? <a href={href} target="_blank" rel="noreferrer">{person.link}</a> : null}
        {style.badges?.length ? (
          <div className="pbadges" data-testid="profile-badges">
            {style.badges.map((id) => { const b = badgeById(id); return b ? <span key={id} title={tx(b.hint)}><b>{b.emoji}</b>{tx(b.label)}</span> : null })}
          </div>
        ) : null}
        {children}
        {style.showStats && stats ? (
          <div className="pstats" data-testid="profile-stats">
            <div><b>{stats.plays}</b><small>{tx("rounds played")}</small></div>
            <div><b>{stats.favorite || '—'}</b><small>{tx("favourite game")}</small></div>
            <div><b>{stats.followers}</b><small>{tx("followers")}</small></div>
            <div><b>{stats.posts}</b><small>{tx("posts")}</small></div>
          </div>
        ) : null}
        {style.music?.title ? (
          <a className="pmusic" href={style.music.url || undefined} target="_blank" rel="noreferrer" data-testid="profile-music" onClick={(e) => { if (!style.music?.url) e.preventDefault() }}>
            <span className="eq" aria-hidden="true"><i /><i /><i /></span>
            <span><b>{style.music.title}</b>{style.music.artist ? <small>{style.music.artist}</small> : null}</span>
            <span className="note">♪</span>
          </a>
        ) : null}
        {style.links?.length ? (
          <div className="plinks" data-testid="profile-links">
            {style.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener">{l.label || new URL(l.url).hostname}</a>)}
          </div>
        ) : null}
      </div>
    </div>
  )
}

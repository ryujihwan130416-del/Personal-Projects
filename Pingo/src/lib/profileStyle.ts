import { collection, doc, getCountFromServer, getDocs, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../firebase/app'
import { GAMES } from '../games/catalog'
import { FONTS, isColor } from './theme'

/** Public profile decoration, at dmly/app/profileStyles/{uid}. Everything is optional. */
export interface ProfileStyle {
  bg?: { kind: 'none' | 'gradient' | 'pattern' | 'photo'; value?: string; photo?: string }
  frame?: string
  effect?: string
  nameColor?: string
  nameFont?: string
  status?: { emoji?: string; text?: string }
  badges?: string[]
  showStats?: boolean
  music?: { title?: string; artist?: string; url?: string }
  links?: { label: string; url: string }[]
  layout?: 'classic' | 'card' | 'banner' | 'minimal'
  themeColor?: string
}

export const GRADIENTS: Record<string, string> = {
  sunrise: 'linear-gradient(135deg, #ff9a8b, #ff6a88 50%, #ff99ac)',
  lagoon: 'linear-gradient(135deg, #43cea2, #185a9d)',
  candy: 'linear-gradient(135deg, #f6d365, #fda085)',
  aurora: 'linear-gradient(135deg, #7b5cff, #38c6ff 55%, #5ee0a0)',
  dusk: 'linear-gradient(135deg, #2b1b4d, #7b5cff 60%, #ff6a88)',
  mint: 'linear-gradient(135deg, #d4fc79, #96e6a1)',
  peach: 'linear-gradient(135deg, #ffecd2, #fcb69f)',
  night: 'linear-gradient(135deg, #0f2027, #203a43 50%, #2c5364)',
}
export const PATTERNS: Record<string, string> = {
  dots: 'radial-gradient(circle, rgba(255,255,255,.55) 2px, transparent 2.5px) 0 0 / 18px 18px, linear-gradient(135deg, #ff8a3d, #ff4f9a)',
  grid: 'linear-gradient(rgba(255,255,255,.25) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(90deg, rgba(255,255,255,.25) 1px, transparent 1px) 0 0 / 22px 22px, linear-gradient(135deg, #2f8cff, #7b5cff)',
  stripes: 'repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 12px, transparent 12px 24px), linear-gradient(135deg, #14b886, #38c6ff)',
  checker: 'repeating-conic-gradient(rgba(255,255,255,.22) 0 25%, transparent 0 50%) 0 0 / 28px 28px, linear-gradient(135deg, #ffd23f, #ff8a3d)',
  waves: 'radial-gradient(circle at 50% 120%, rgba(255,255,255,.3) 20%, transparent 21%) 0 0 / 40px 20px, linear-gradient(135deg, #38c6ff, #2f8cff)',
  hearts: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,.4) 3px, transparent 3.5px) 0 0 / 26px 26px, radial-gradient(circle at 70% 40%, rgba(255,255,255,.4) 3px, transparent 3.5px) 0 0 / 26px 26px, linear-gradient(135deg, #ff4f9a, #c05cff)',
}
export const FRAMES: { id: string; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'gradient', label: 'Sunset ring' }, { id: 'neon', label: 'Neon glow' }, { id: 'gold', label: 'Gold' },
  { id: 'rainbow', label: 'Rainbow' }, { id: 'dashed', label: 'Doodle' }, { id: 'double', label: 'Double' }, { id: 'petal', label: 'Petals' },
]
export const EFFECTS: { id: string; label: string }[] = [
  { id: 'none', label: 'None' }, { id: 'sparkle', label: '✨ Sparkles' }, { id: 'float', label: '🎈 Float' }, { id: 'pulse', label: '💓 Pulse' },
  { id: 'hearts', label: '💕 Hearts' }, { id: 'snow', label: '❄️ Snow' }, { id: 'spin', label: '🌀 Spin ring' },
]
export const LAYOUTS: { id: NonNullable<ProfileStyle['layout']>; label: string }[] = [
  { id: 'classic', label: 'Classic' }, { id: 'card', label: 'Card' }, { id: 'banner', label: 'Banner' }, { id: 'minimal', label: 'Minimal' },
]
export const NAME_FONTS = FONTS.filter((f) => ['', 'Fredoka', 'Baloo 2', 'Pacifico', 'Comfortaa', 'Space Grotesk', 'Jua', 'Do Hyeon', 'Gowun Dodum', 'Poppins'].includes(f.family))

export interface Badge { id: string; emoji: string; label: string; hint: string }
export const BADGES: Badge[] = [
  { id: 'pal', emoji: '💛', label: 'Pingo pal', hint: 'Everyone gets this one' },
  { id: 'early', emoji: '🐣', label: 'Early bird', hint: 'Joined in 2026' },
  { id: 'gamer', emoji: '🎮', label: 'Game buddy', hint: 'Played 5+ rounds' },
  { id: 'champ', emoji: '🏆', label: 'Lucky streak', hint: 'Won a round' },
  { id: 'snake', emoji: '🐍', label: 'Snake charmer', hint: 'Played Snake' },
  { id: 'brain', emoji: '🧠', label: 'Quiz whiz', hint: 'Played the quiz' },
  { id: 'poster', emoji: '✍️', label: 'Storyteller', hint: 'Shared a post' },
  { id: 'social', emoji: '🤝', label: 'Friendly', hint: 'Follows 3+ people' },
  { id: 'popular', emoji: '⭐', label: 'Fan favourite', hint: '3+ followers' },
  { id: 'stylist', emoji: '🎨', label: 'Stylist', hint: 'Customized their profile' },
]
export const badgeById = (id: string) => BADGES.find((b) => b.id === id)

export interface FunStats { plays: number; wins: number; favorite: string; byGame: { type: string; plays: number }[]; followers: number; following: number; posts: number }

export async function loadFunStats(uid: string): Promise<FunStats> {
  const [gs, fol, fing, posts] = await Promise.all([
    getDocs(collection(db, ...fsCol('users', uid, 'gameStats'))).catch(() => null),
    getCountFromServer(collection(db, ...fsCol('users', uid, 'followers'))).catch(() => null),
    getCountFromServer(collection(db, ...fsCol('users', uid, 'following'))).catch(() => null),
    getCountFromServer(query(collection(db, ...fsCol('posts')), where('authorId', '==', uid))).catch(() => null),
  ])
  const byGame = (gs?.docs ?? []).map((d) => ({ type: d.id, plays: Number(d.data().plays ?? 0), wins: Number(d.data().wins ?? 0) })).filter((x) => x.plays > 0)
  byGame.sort((a, b) => b.plays - a.plays)
  const fav = byGame[0] ? GAMES().find((g) => g.id === byGame[0].type) : undefined
  return {
    plays: byGame.reduce((n, x) => n + x.plays, 0), wins: byGame.reduce((n, x) => n + x.wins, 0),
    favorite: fav ? `${fav.emoji} ${fav.name}` : '', byGame,
    followers: fol?.data().count ?? 0, following: fing?.data().count ?? 0, posts: posts?.data().count ?? 0,
  }
}
export function earnedBadges(s: FunStats, joinedMs: number, styled: boolean): string[] {
  const out = ['pal']
  if (joinedMs && joinedMs < Date.UTC(2027, 0, 1)) out.push('early')
  if (s.plays >= 5) out.push('gamer')
  if (s.wins >= 1) out.push('champ')
  if (s.byGame.some((g) => g.type === 'snake')) out.push('snake')
  if (s.byGame.some((g) => g.type === 'quiz')) out.push('brain')
  if (s.posts >= 1) out.push('poster')
  if (s.following >= 3) out.push('social')
  if (s.followers >= 3) out.push('popular')
  if (styled) out.push('stylist')
  return out
}

/** Drops anything malformed so a bad doc can never break a profile page. */
export function cleanStyle(raw: unknown): ProfileStyle {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out: ProfileStyle = {}
  const bg = r.bg as ProfileStyle['bg']
  if (bg && typeof bg === 'object') {
    if (bg.kind === 'gradient' && bg.value && GRADIENTS[bg.value]) out.bg = { kind: 'gradient', value: bg.value }
    else if (bg.kind === 'pattern' && bg.value && PATTERNS[bg.value]) out.bg = { kind: 'pattern', value: bg.value }
    else if (bg.kind === 'photo' && typeof bg.photo === 'string' && bg.photo.startsWith('data:image/')) out.bg = { kind: 'photo', photo: bg.photo }
  }
  if (typeof r.frame === 'string' && FRAMES.some((f) => f.id === r.frame)) out.frame = r.frame
  if (typeof r.effect === 'string' && EFFECTS.some((f) => f.id === r.effect)) out.effect = r.effect
  if (isColor(r.nameColor)) out.nameColor = r.nameColor
  if (typeof r.nameFont === 'string' && FONTS.some((f) => f.family === r.nameFont)) out.nameFont = r.nameFont
  const st = r.status as ProfileStyle['status']
  if (st && typeof st === 'object') out.status = { emoji: String(st.emoji ?? '').slice(0, 8), text: String(st.text ?? '').slice(0, 80) }
  if (Array.isArray(r.badges)) out.badges = r.badges.filter((b): b is string => typeof b === 'string' && !!badgeById(b)).slice(0, 6)
  if (typeof r.showStats === 'boolean') out.showStats = r.showStats
  const m = r.music as ProfileStyle['music']
  if (m && typeof m === 'object') out.music = { title: String(m.title ?? '').slice(0, 80), artist: String(m.artist ?? '').slice(0, 80), url: safeUrl(String(m.url ?? '')) }
  if (Array.isArray(r.links)) out.links = (r.links as { label?: unknown; url?: unknown }[]).map((l) => ({ label: String(l?.label ?? '').slice(0, 30), url: safeUrl(String(l?.url ?? '')) })).filter((l) => l.url).slice(0, 5)
  if (typeof r.layout === 'string' && LAYOUTS.some((l) => l.id === r.layout)) out.layout = r.layout as ProfileStyle['layout']
  if (isColor(r.themeColor)) out.themeColor = r.themeColor
  return out
}
export function safeUrl(u: string): string {
  const v = u.trim().slice(0, 300)
  if (!v) return ''
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try { const x = new URL(withProto); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : '' } catch { return '' }
}

export function useProfileStyle(uid?: string): { style: ProfileStyle; loaded: boolean } {
  const [state, setState] = useState<{ style: ProfileStyle; loaded: boolean }>({ style: {}, loaded: false })
  useEffect(() => {
    if (!uid) return
    return onSnapshot(doc(db, ...fsCol('profileStyles', uid)), (s) => setState({ style: cleanStyle(s.data()), loaded: true }), () => setState({ style: {}, loaded: true }))
  }, [uid])
  return state
}
export async function saveProfileStyle(uid: string, style: ProfileStyle) {
  const clean = cleanStyle(style)
  await setDoc(doc(db, ...fsCol('profileStyles', uid)), { ...clean, updatedAt: serverTimestamp() })
}

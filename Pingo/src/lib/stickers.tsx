import { tx } from '../i18n'
/**
 * Pingo's own sticker packs, drawn as inline SVG (no image files, no third-party art).
 * Ids look like "pals:love". Animated packs use CSS keyframes (disabled with prefers-reduced-motion).
 */
import type { ReactNode } from 'react'

type Eyes = 'dot' | 'happy' | 'heart' | 'closed' | 'wide' | 'wink' | 'shades' | 'x' | 'star' | 'angry'
type Mouth = 'smile' | 'open' | 'o' | 'flat' | 'frown' | 'tongue' | 'cat' | 'smirk' | 'grin'
type Extra = 'blush' | 'tears' | 'joy' | 'zzz' | 'hearts' | 'sparkle' | 'anger' | 'q' | 'sweat' | 'hat' | 'wave' | 'note'
interface Face { eyes: Eyes; mouth: Mouth; extras?: Extra[]; color: string }
export interface StickerDef { id: string; label: string; anim?: 'bounce' | 'wiggle' | 'pulse' | 'float' | 'spin' | 'jelly' | 'shake'; render: () => ReactNode }
export interface StickerPack { id: string; name: string; icon: string; animated: boolean; stickers: StickerDef[] }

const INK = '#1a1530'

function eyes(e: Eyes): ReactNode {
  const L = 44, R = 76, Y = 56
  switch (e) {
    case 'dot': return <><circle cx={L} cy={Y} r="6" fill={INK} /><circle cx={R} cy={Y} r="6" fill={INK} /><circle cx={L + 2} cy={Y - 2} r="2" fill="#fff" /><circle cx={R + 2} cy={Y - 2} r="2" fill="#fff" /></>
    case 'happy': return <><path d={`M${L - 8} ${Y + 3} Q${L} ${Y - 8} ${L + 8} ${Y + 3}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /><path d={`M${R - 8} ${Y + 3} Q${R} ${Y - 8} ${R + 8} ${Y + 3}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /></>
    case 'closed': return <><path d={`M${L - 8} ${Y} Q${L} ${Y + 7} ${L + 8} ${Y}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /><path d={`M${R - 8} ${Y} Q${R} ${Y + 7} ${R + 8} ${Y}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /></>
    case 'heart': return <>{[L, R].map((x) => <path key={x} d={`M${x} ${Y + 8} C${x - 14} ${Y - 2} ${x - 8} ${Y - 12} ${x} ${Y - 4} C${x + 8} ${Y - 12} ${x + 14} ${Y - 2} ${x} ${Y + 8}Z`} fill="#ff3d6e" stroke={INK} strokeWidth="2.5" />)}</>
    case 'wide': return <>{[L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r="11" fill="#fff" stroke={INK} strokeWidth="3.5" /><circle cx={x + 1} cy={Y + 1} r="5.5" fill={INK} /><circle cx={x + 3} cy={Y - 2} r="1.8" fill="#fff" /></g>)}</>
    case 'wink': return <><circle cx={L} cy={Y} r="6" fill={INK} /><circle cx={L + 2} cy={Y - 2} r="2" fill="#fff" /><path d={`M${R - 8} ${Y + 2} Q${R} ${Y - 7} ${R + 8} ${Y + 2}`} stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /></>
    case 'shades': return <><path d="M28 48 h28 a4 4 0 0 1 4 4 v4 a12 12 0 0 1 -12 12 h-6 a14 14 0 0 1 -14 -14 v-2 a4 4 0 0 1 0 -4z" fill={INK} /><path d="M64 48 h28 a4 4 0 0 1 0 4 v2 a14 14 0 0 1 -14 14 h-6 a12 12 0 0 1 -12 -12 v-4 a4 4 0 0 1 4 -4z" fill={INK} /><path d="M56 52 h8" stroke={INK} strokeWidth="4" /><path d="M34 53 l8 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" /><path d="M70 53 l8 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" /></>
    case 'x': return <>{[L, R].map((x) => <path key={x} d={`M${x - 6} ${Y - 6} L${x + 6} ${Y + 6} M${x + 6} ${Y - 6} L${x - 6} ${Y + 6}`} stroke={INK} strokeWidth="5" strokeLinecap="round" />)}</>
    case 'star': return <>{[L, R].map((x) => <path key={x} d={`M${x} ${Y - 10} L${x + 3} ${Y - 3} L${x + 10} ${Y - 2} L${x + 4} ${Y + 3} L${x + 6} ${Y + 10} L${x} ${Y + 6} L${x - 6} ${Y + 10} L${x - 4} ${Y + 3} L${x - 10} ${Y - 2} L${x - 3} ${Y - 3}Z`} fill="#ffd23f" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />)}</>
    case 'angry': return <><path d={`M${L - 10} ${Y - 12} L${L + 8} ${Y - 5}`} stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d={`M${R + 10} ${Y - 12} L${R - 8} ${Y - 5}`} stroke={INK} strokeWidth="5" strokeLinecap="round" /><circle cx={L} cy={Y + 3} r="5" fill={INK} /><circle cx={R} cy={Y + 3} r="5" fill={INK} /></>
  }
}
function mouth(m: Mouth): ReactNode {
  switch (m) {
    case 'smile': return <path d="M48 76 Q60 88 72 76" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    case 'grin': return <path d="M44 74 Q60 92 76 74 Z" fill="#fff" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
    case 'open': return <><path d="M44 72 Q60 100 76 72 Z" fill="#7a1f2b" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" /><path d="M52 86 Q60 80 68 86 Q60 94 52 86Z" fill="#ff7a8a" /></>
    case 'o': return <ellipse cx="60" cy="80" rx="7" ry="9" fill="#7a1f2b" stroke={INK} strokeWidth="4" />
    case 'flat': return <path d="M50 80 H70" stroke={INK} strokeWidth="5" strokeLinecap="round" />
    case 'frown': return <path d="M48 86 Q60 74 72 86" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
    case 'tongue': return <><path d="M48 76 Q60 88 72 76" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M60 82 q8 0 7 9 q-1 6 -7 6 q-6 0 -7 -6 q-1 -9 7 -9z" fill="#ff7a8a" stroke={INK} strokeWidth="3" /></>
    case 'cat': return <path d="M48 76 Q54 84 60 76 Q66 84 72 76" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
    case 'smirk': return <path d="M50 80 Q64 86 74 74" stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" />
  }
}
function extra(x: Extra, i: number, color: string): ReactNode {
  switch (x) {
    case 'blush': return <g key={i} opacity="0.55"><ellipse cx="34" cy="72" rx="8" ry="5" fill="#ff5c8a" /><ellipse cx="86" cy="72" rx="8" ry="5" fill="#ff5c8a" /></g>
    case 'tears': return <g key={i} fill="#5ec4ff" stroke={INK} strokeWidth="2.5"><path d="M38 64 q-6 12 0 18 q6 -6 0 -18z" /><path d="M82 64 q-6 12 0 18 q6 -6 0 -18z" /></g>
    case 'joy': return <g key={i} fill="#5ec4ff" stroke={INK} strokeWidth="2.5"><path d="M30 58 q-12 4 -14 14 q10 0 14 -14z" /><path d="M90 58 q12 4 14 14 q-10 0 -14 -14z" /></g>
    case 'zzz': return <text key={i} x="84" y="30" fontSize="20" fontWeight="900" fill={INK} fontFamily="Nunito, sans-serif">z<tspan dy="-8" fontSize="15">z</tspan></text>
    case 'hearts': return <g key={i} fill="#ff3d6e" stroke={INK} strokeWidth="2"><path className="st-float" d="M96 22 c-6 -6 -14 2 -6 8 l6 5 l6 -5 c8 -6 0 -14 -6 -8z" /><path className="st-float d2" d="M18 30 c-4 -4 -10 1 -4 6 l4 3 l4 -3 c6 -5 0 -10 -4 -6z" /></g>
    case 'sparkle': return <g key={i} fill="#ffd23f" stroke={INK} strokeWidth="2"><path className="st-twinkle" d="M98 18 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3z" /><path className="st-twinkle d2" d="M20 24 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z" /></g>
    case 'anger': return <g key={i} stroke="#e2262b" strokeWidth="4" strokeLinecap="round" fill="none"><path d="M92 16 q4 6 0 10 M100 14 q-6 4 -10 0 M104 24 q-4 -6 0 -10 M96 28 q6 -4 10 0" /></g>
    case 'q': return <text key={i} x="90" y="34" fontSize="30" fontWeight="900" fill={INK} fontFamily="Nunito, sans-serif">?</text>
    case 'sweat': return <path key={i} d="M92 34 q-7 10 0 15 q7 -5 0 -15z" fill="#5ec4ff" stroke={INK} strokeWidth="2.5" />
    case 'hat': return <g key={i}><path d="M44 24 L60 -4 L76 24 Z" fill="#c05cff" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" /><circle cx="60" cy="-4" r="5" fill="#ffd23f" stroke={INK} strokeWidth="2.5" /><circle cx="54" cy="14" r="2.5" fill="#ffd23f" /><circle cx="64" cy="8" r="2.5" fill="#5ee0a0" /></g>
    case 'wave': return <g key={i} className="st-wave"><ellipse cx="104" cy="70" rx="10" ry="12" fill={color} stroke={INK} strokeWidth="3.5" /><path d="M98 60 v-8 M104 58 v-10 M110 60 v-8" stroke={INK} strokeWidth="3" strokeLinecap="round" /></g>
    case 'note': return <g key={i} fill={INK}><path className="st-float" d="M96 14 v18 a5 5 0 1 1 -3 -4 v-14 l12 -3 v4z" /></g>
  }
}

function blob(face: Face, shape: 'blob' | 'cat' = 'blob'): () => ReactNode {
  return () => (
    <svg viewBox="-6 -10 132 136" width="100%" height="100%" aria-hidden="true">
      {shape === 'cat' ? <g fill={face.color} stroke={INK} strokeWidth="4" strokeLinejoin="round"><path d="M22 40 L26 6 L50 26 Z" /><path d="M98 40 L94 6 L70 26 Z" /></g> : null}
      <path d="M60 14 C92 14 108 34 108 64 C108 96 88 112 60 112 C30 112 12 96 12 64 C12 34 28 14 60 14Z" fill={face.color} stroke={INK} strokeWidth="4.5" />
      <path d="M30 40 C36 28 48 24 56 24" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.55" />
      {eyes(face.eyes)}
      {mouth(face.mouth)}
      {(face.extras ?? []).map((x, i) => extra(x, i, face.color))}
    </svg>
  )
}

function word(text: string, emoji: string, a: string, b: string): () => ReactNode {
  const gid = `g-w-${text.replace(/[^A-Za-z]/g, '')}`
  return () => (
    <svg viewBox="0 0 140 120" width="100%" height="100%" aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient></defs>
      <path d="M14 46 C10 26 28 14 70 14 C112 14 132 24 128 48 C126 66 112 76 72 76 L50 76 L32 92 L36 74 C20 70 16 60 14 46Z" fill={`url(#${gid})`} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <text x="71" y="56" textAnchor="middle" fontSize={text.length > 5 ? 24 : 30} fontWeight="900" fill="#fff" stroke={INK} strokeWidth="5" paintOrder="stroke" fontFamily="Nunito, 'Baloo 2', sans-serif" letterSpacing="1">{text}</text>
      <text x="108" y="112" textAnchor="middle" fontSize="34">{emoji}</text>
    </svg>
  )
}

const PALS: [string, string, Face, StickerDef['anim']?][] = [
  ['hi', 'Hi!', { eyes: 'happy', mouth: 'grin', extras: ['blush', 'wave'], color: '#ffd23f' }, 'wiggle'],
  ['love', 'Love it', { eyes: 'heart', mouth: 'smile', extras: ['blush', 'hearts'], color: '#ff8ac2' }, 'pulse'],
  ['lol', 'LOL', { eyes: 'happy', mouth: 'open', extras: ['joy'], color: '#ffb347' }, 'shake'],
  ['cry', 'Sad', { eyes: 'closed', mouth: 'frown', extras: ['tears'], color: '#8ec5ff' }, 'float'],
  ['angry', 'Grr', { eyes: 'angry', mouth: 'flat', extras: ['anger'], color: '#ff6b5a' }, 'shake'],
  ['wow', 'Wow', { eyes: 'wide', mouth: 'o', extras: ['sparkle'], color: '#c8f542' }, 'jelly'],
  ['sleepy', 'Sleepy', { eyes: 'closed', mouth: 'o', extras: ['zzz'], color: '#b9a7ff' }, 'float'],
  ['cool', 'Cool', { eyes: 'shades', mouth: 'smirk', color: '#5ee0d0' }, 'bounce'],
  ['wink', 'Wink', { eyes: 'wink', mouth: 'tongue', extras: ['blush'], color: '#ffa36c' }, 'bounce'],
  ['party', 'Party!', { eyes: 'happy', mouth: 'open', extras: ['hat', 'sparkle'], color: '#5ec4ff' }, 'jelly'],
  ['thanks', 'Thanks', { eyes: 'closed', mouth: 'cat', extras: ['blush', 'hearts'], color: '#ffc6d9' }, 'pulse'],
  ['huh', 'Huh?', { eyes: 'dot', mouth: 'flat', extras: ['q', 'sweat'], color: '#e6e0ff' }, 'wiggle'],
  ['star', 'Starstruck', { eyes: 'star', mouth: 'grin', extras: ['sparkle'], color: '#fff07a' }, 'spin'],
  ['dizzy', 'Oops', { eyes: 'x', mouth: 'tongue', extras: ['sweat'], color: '#a8f0c6' }, 'wiggle'],
]
const KITTY: [string, string, Face, StickerDef['anim']][] = [
  ['hello', 'Hello', { eyes: 'happy', mouth: 'cat', extras: ['blush', 'wave'], color: '#ffe1b3' }, 'wiggle'],
  ['purr', 'Purr', { eyes: 'closed', mouth: 'cat', extras: ['hearts', 'blush'], color: '#ffd1e3' }, 'pulse'],
  ['yay', 'Yay', { eyes: 'happy', mouth: 'open', extras: ['sparkle'], color: '#fff0a6' }, 'bounce'],
  ['sob', 'Sob', { eyes: 'closed', mouth: 'frown', extras: ['tears'], color: '#cfe6ff' }, 'shake'],
  ['hmph', 'Hmph', { eyes: 'angry', mouth: 'flat', extras: ['anger'], color: '#ffc0b0' }, 'shake'],
  ['omg', 'OMG', { eyes: 'wide', mouth: 'o', extras: ['sweat'], color: '#e0d4ff' }, 'jelly'],
  ['nap', 'Nap', { eyes: 'closed', mouth: 'cat', extras: ['zzz'], color: '#d8f5e3' }, 'float'],
  ['sing', 'La la', { eyes: 'closed', mouth: 'o', extras: ['note'], color: '#ffe6c7' }, 'wiggle'],
  ['boss', 'Boss', { eyes: 'shades', mouth: 'smirk', color: '#d0d0d8' }, 'bounce'],
  ['spin', 'Wheee', { eyes: 'x', mouth: 'grin', extras: ['sparkle'], color: '#bff2f0' }, 'spin'],
]
const WORDS: [string, string, string, string][] = [
  ['LOL', '😂', '#ff8a3d', '#ff4d3a'], ['OMG', '😱', '#c05cff', '#7b5cff'], ['YAY', '🎉', '#ffd23f', '#ff8a3d'],
  ['GG', '🎮', '#38c6ff', '#2f8cff'], ['BRB', '🏃', '#5ee0a0', '#14b886'], ['THX', '🙏', '#ff8ac2', '#ff4f9a'],
  ['NOPE', '🙅', '#ff6b5a', '#d61f3a'], ['LOVE', '💖', '#ff4f9a', '#c05cff'], ['OK!', '👌', '#c8f542', '#5ee0a0'],
  ['ZZZ', '😴', '#8ec5ff', '#7b5cff'], ['HBD', '🎂', '#ffb347', '#ff4f9a'], ['WHAT', '🤔', '#9aa0b4', '#5a5270'],
]

export const PACKS: StickerPack[] = [
  { id: 'pals', name: 'Pingo Pals', icon: '🟡', animated: false, stickers: PALS.map(([id, label, f, anim]) => ({ id: `pals:${id}`, label, anim, render: blob(f) })) },
  { id: 'kitty', name: 'Wiggly Kitty', icon: '🐱', animated: true, stickers: KITTY.map(([id, label, f, anim]) => ({ id: `kitty:${id}`, label, anim, render: blob(f, 'cat') })) },
  { id: 'words', name: 'Word Pops', icon: '💬', animated: true, stickers: WORDS.map(([w, e, a, b]) => ({ id: `words:${w.toLowerCase().replace(/[^a-z]/g, '')}`, label: w, anim: 'jelly', render: word(w, e, a, b) })) },
]
const BY_ID = new Map(PACKS.flatMap((p) => p.stickers.map((s) => [s.id, { s, p }] as const)))
export function stickerById(id?: string) { return id ? BY_ID.get(id) : undefined }
export function stickerLabel(id?: string) { return tx(stickerById(id)?.s.label ?? 'Sticker') }

/** Renders a sticker. Animated packs move all the time; others only on hover (`live`). */
export function Sticker({ id, size = 120, live = false }: { id?: string; size?: number; live?: boolean }) {
  const hit = stickerById(id)
  if (!hit) return <span className="sticker missing" style={{ width: size, height: size }}>✨</span>
  const anim = hit.s.anim && (hit.p.animated || live) ? `st-${hit.s.anim}` : ''
  return <span className={`sticker ${anim} ${hit.p.animated ? '' : 'hover-anim'} st-h-${hit.s.anim ?? 'bounce'}`} style={{ width: size, height: size }} role="img" aria-label={hit.s.label} data-testid="sticker">{hit.s.render()}</span>
}

const RECENT_KEY = 'pingo-recent-stickers'
export function recentStickers(): string[] { try { return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]).filter((x) => BY_ID.has(x)) } catch { return [] } }
export function pushRecent(id: string) { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recentStickers().filter((x) => x !== id)].slice(0, 16))) } catch { /* ignore */ } }

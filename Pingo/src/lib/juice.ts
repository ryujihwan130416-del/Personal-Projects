/**
 * Game "juice": tiny synthesized sound effects (WebAudio, no audio files), particles, confetti,
 * gentle shake/pop. Sound has a persisted mute toggle; motion effects respect prefers-reduced-motion.
 */
import { useEffect, useState } from 'react'

const MUTE_KEY = 'pingo-sfx-muted'
let ctx: AudioContext | null = null
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })()
const muteSubs = new Set<(m: boolean) => void>()

export function isMuted() { return muted }
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* ignore */ }
  muteSubs.forEach((f) => f(m))
}
export function useMuted(): [boolean, (m: boolean) => void] {
  const [m, setM] = useState(muted)
  useEffect(() => { muteSubs.add(setM); return () => { muteSubs.delete(setM) } }, [])
  return [m, setMuted]
}
export function reducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}

/** One soft enveloped tone. */
function tone(ac: AudioContext, freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.16, slideTo?: number) {
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, ac.currentTime + at)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + at + dur)
  g.gain.setValueAtTime(0.0001, ac.currentTime + at)
  g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + at + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + dur)
  o.connect(g).connect(ac.destination)
  o.start(ac.currentTime + at)
  o.stop(ac.currentTime + at + dur + 0.02)
}

export type Sfx = 'tap' | 'pop' | 'score' | 'start' | 'win' | 'lose' | 'draw' | 'whoosh' | 'bump' | 'tick'
let lastTap = 0
export function sfx(name: Sfx) {
  const ac = audio()
  if (!ac) return
  switch (name) {
    case 'tap': { const n = performance.now(); if (n - lastTap < 40) return; lastTap = n; tone(ac, 660, 0, 0.06, 'triangle', 0.07); break }
    case 'tick': tone(ac, 880, 0, 0.04, 'square', 0.03); break
    case 'pop': tone(ac, 520, 0, 0.09, 'sine', 0.14, 980); break
    case 'score': tone(ac, 660, 0, 0.08, 'triangle', 0.12); tone(ac, 990, 0.07, 0.12, 'triangle', 0.12); break
    case 'start': tone(ac, 392, 0, 0.1, 'triangle', 0.1); tone(ac, 523, 0.09, 0.1, 'triangle', 0.1); tone(ac, 784, 0.18, 0.16, 'triangle', 0.11); break
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(ac, f, i * 0.09, 0.22, 'triangle', 0.12)); tone(ac, 1568, 0.38, 0.35, 'sine', 0.06); break
    case 'draw': tone(ac, 523, 0, 0.16, 'triangle', 0.1); tone(ac, 523, 0.16, 0.2, 'triangle', 0.1); break
    case 'lose': tone(ac, 440, 0, 0.2, 'sine', 0.1, 330); tone(ac, 330, 0.18, 0.3, 'sine', 0.09, 262); break
    case 'whoosh': tone(ac, 300, 0, 0.18, 'sine', 0.06, 900); break
    case 'bump': tone(ac, 160, 0, 0.12, 'sine', 0.16, 90); break
  }
}

/** Little particle burst at a screen point (or an element's centre). */
export function burst(target: { x: number; y: number } | Element | null, opts: { count?: number; colors?: string[]; emoji?: string[]; spread?: number } = {}) {
  if (!target || reducedMotion() || typeof document === 'undefined') return
  const p = target instanceof Element ? (() => { const r = target.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })() : target
  const layer = document.createElement('div')
  layer.className = 'juice-layer'
  const colors = opts.colors ?? ['#ff4d3a', '#ffd23f', '#5ee0a0', '#38c6ff', '#c05cff', '#ff8ac2']
  const n = opts.count ?? 14
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i')
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.5
    const dist = (opts.spread ?? 60) * (0.6 + Math.random() * 0.7)
    s.style.left = `${p.x}px`
    s.style.top = `${p.y}px`
    s.style.setProperty('--dx', `${Math.cos(ang) * dist}px`)
    s.style.setProperty('--dy', `${Math.sin(ang) * dist - 10}px`)
    s.style.setProperty('--rot', `${Math.random() * 360}deg`)
    if (opts.emoji) { s.textContent = opts.emoji[i % opts.emoji.length]; s.className = 'emo' } else s.style.background = colors[i % colors.length]
    layer.appendChild(s)
  }
  document.body.appendChild(layer)
  window.setTimeout(() => layer.remove(), 900)
}

/** Full-screen confetti for a win (canvas, ~2.4 s, then removed). */
export function confetti() {
  if (reducedMotion() || typeof document === 'undefined') return
  const c = document.createElement('canvas')
  c.className = 'juice-confetti'
  c.width = window.innerWidth * devicePixelRatio
  c.height = window.innerHeight * devicePixelRatio
  document.body.appendChild(c)
  const g = c.getContext('2d')
  if (!g) { c.remove(); return }
  const colors = ['#ff4d3a', '#ffd23f', '#5ee0a0', '#38c6ff', '#c05cff', '#ff8ac2', '#c8f542']
  const W = c.width, H = c.height, k = devicePixelRatio
  const bits = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35 + (Math.random() - 0.5) * 40 * k,
    vx: (Math.random() - 0.5) * 14 * k, vy: (-6 - Math.random() * 10) * k,
    w: (6 + Math.random() * 6) * k, h: (8 + Math.random() * 8) * k, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
    col: colors[Math.floor(Math.random() * colors.length)],
  }))
  const t0 = performance.now()
  let last = t0
  const frame = (now: number) => {
    const t = now - t0
    // time-based physics (units per 60 Hz frame) so it looks the same at 60/90/120 Hz or under load
    const f = Math.min(3, (now - last) / (1000 / 60))
    last = now
    g.clearRect(0, 0, W, H)
    g.globalAlpha = t > 1800 ? Math.max(0, 1 - (t - 1800) / 600) : 1
    for (const b of bits) {
      b.vy += 0.32 * k * f; b.vx *= Math.pow(0.99, f); b.x += b.vx * f; b.y += b.vy * f; b.r += b.vr * f
      g.save(); g.translate(b.x, b.y); g.rotate(b.r); g.fillStyle = b.col; g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.r * 2))); g.restore()
    }
    if (t < 2400) requestAnimationFrame(frame); else c.remove()
  }
  requestAnimationFrame(frame)
}

/**
 * Short transform-only animations via the Web Animations API: compositor-friendly,
 * no forced reflow (the old class-toggle trick read offsetWidth), and restartable.
 */
function play(el: Element | null, frames: Keyframe[], ms: number, easing = 'cubic-bezier(0.22, 1, 0.36, 1)') {
  if (!el || reducedMotion() || typeof (el as HTMLElement).animate !== 'function') return
  ;(el as HTMLElement).getAnimations?.().forEach((a) => { if ((a as Animation & { id: string }).id === 'juice') a.cancel() })
  const a = (el as HTMLElement).animate(frames, { duration: ms, easing })
  a.id = 'juice'
}
export const shake = (el: Element | null) => play(el, [
  { transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-6px,0,0) rotate(-0.6deg)' }, { transform: 'translate3d(5px,0,0) rotate(0.5deg)' },
  { transform: 'translate3d(-3px,0,0)' }, { transform: 'translate3d(2px,0,0)' }, { transform: 'translate3d(0,0,0)' },
], 420, 'ease-out')
export const pop = (el: Element | null) => play(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], 320)
/** Tiny "can't go that way" wiggle. */
export const nudge = (el: Element | null) => play(el, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-3px,0,0)' }, { transform: 'translate3d(3px,0,0)' }, { transform: 'translate3d(0,0,0)' }], 200, 'ease-out')

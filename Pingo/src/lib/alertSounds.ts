/**
 * Call & message sounds, synthesized with WebAudio (no audio files, nothing to license):
 *  - incoming-call ringtone: a bright two-burst marimba-style arpeggio, looping until stopped
 *  - outgoing ringback: the standard 440+480 Hz tone, 1 s on / 2 s off (what Korean phones play)
 *  - message: a short two-note "ding"
 * Preferences live in localStorage and can be changed in Settings → Sounds & alerts.
 */
import { useEffect, useState } from 'react'

export interface AlertPrefs { ring: boolean; msgSound: boolean; msgNotify: boolean; vibrate: boolean; background: boolean }
const KEY = 'pingo-alert-prefs'
const DEFAULTS: AlertPrefs = { ring: true, msgSound: true, msgNotify: true, vibrate: true, background: true }
let prefs: AlertPrefs = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') } } catch { return { ...DEFAULTS } } })()
const subs = new Set<(p: AlertPrefs) => void>()
export const alertPrefs = () => prefs
export function setAlertPrefs(p: Partial<AlertPrefs>) {
  prefs = { ...prefs, ...p }
  try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch { /* ignore */ }
  subs.forEach((f) => f(prefs))
}
export function useAlertPrefs(): [AlertPrefs, (p: Partial<AlertPrefs>) => void] {
  const [p, setP] = useState(prefs)
  useEffect(() => { subs.add(setP); return () => { subs.delete(setP) } }, [])
  return [p, setAlertPrefs]
}

let ctx: AudioContext | null = null
function ac(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch { return null }
}
// Browsers only allow audio after a user gesture: unlock on the first tap/key.
if (typeof document !== 'undefined') {
  const unlock = () => { const a = ac(); if (a && a.state === 'running') { document.removeEventListener('pointerdown', unlock, true); document.removeEventListener('keydown', unlock, true) } }
  document.addEventListener('pointerdown', unlock, true)
  document.addEventListener('keydown', unlock, true)
}

function note(a: AudioContext, out: AudioNode, freq: number, at: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  const o = a.createOscillator(), g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(out)
  o.start(at); o.stop(at + dur + 0.05)
}

/* ---------- looping tones ---------- */
type Loop = { timer: number; gain: GainNode }
let ring: Loop | null = null
let back: Loop | null = null

function ringBurst(a: AudioContext, out: AudioNode, t0: number) {
  // One voice, two short beeps. Notes no longer stack into several rings at once.
  note(a, out, 880, t0, 0.38, 0.2, 'sine')
  note(a, out, 880, t0 + 0.52, 0.38, 0.2, 'sine')
}
let ringGen = 0
export function startRingtone() {
  if (ring || !prefs.ring) return
  const a = ac(); if (!a) return
  const gain = a.createGain(); gain.gain.value = 0.7; gain.connect(a.destination)
  const gen = ++ringGen
  ring = { timer: 0, gain }
  let last = 0
  const play = () => {
    if (gen !== ringGen || !ring) return
    const now = Date.now()
    // A backgrounded WebView can fire several timers together when the app returns.
    if (now - last < 1800) {
      ring.timer = window.setTimeout(play, 1800 - (now - last))
      return
    }
    last = now
    ringBurst(a, gain, a.currentTime + 0.02)
    if (prefs.vibrate) try { navigator.vibrate?.([400, 200, 400]) } catch { /* ignore */ }
    ring.timer = window.setTimeout(play, 2400)
  }
  play()
}
export function stopRingtone() {
  ringGen += 1
  if (!ring) return
  clearTimeout(ring.timer)
  try { ring.gain.disconnect() } catch { /* already stopped */ }
  ring = null
  try { navigator.vibrate?.(0) } catch { /* ignore */ }
}

export function startRingback() {
  if (back) return
  const a = ac(); if (!a) return
  const gain = a.createGain(); gain.gain.value = 1; gain.connect(a.destination)
  const play = () => {
    const t = a.currentTime + 0.05
    for (const f of [440, 480]) {
      const o = a.createOscillator(), g = a.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.03)
      g.gain.setValueAtTime(0.06, t + 0.97); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0)
      o.connect(g).connect(gain); o.start(t); o.stop(t + 1.05)
    }
  }
  play()
  back = { timer: window.setInterval(play, 3000), gain }
}
export function stopRingback() {
  if (!back) return
  clearInterval(back.timer); back.gain.disconnect(); back = null
}

let lastDing = 0
export function messageDing() {
  if (!prefs.msgSound) return
  const now = Date.now(); if (now - lastDing < 600) return; lastDing = now
  const a = ac(); if (!a) return
  const t = a.currentTime + 0.02
  note(a, a.destination, 1174.7, t, 0.18, 0.16, 'sine')
  note(a, a.destination, 1760, t + 0.09, 0.32, 0.14, 'sine')
  if (prefs.vibrate) try { navigator.vibrate?.(60) } catch { /* ignore */ }
}
export const isRinging = () => !!ring
export const isRingback = () => !!back

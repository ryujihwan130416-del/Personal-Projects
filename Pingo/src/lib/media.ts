import { getDownloadURL, ref as sref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase/app'
import { storageConfigured } from '../firebase/config'

const MAX_DATA_URL_BYTES = 180_000
const MAX_DIM = 1280

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

/** Compress an image into a JPEG data URL small enough for a Firestore document. */
export async function fileToDataUrl(file: File): Promise<string> {
  if (file.type === 'image/svg+xml' && file.size <= MAX_DATA_URL_BYTES) {
    const text = await file.text()
    return `data:image/svg+xml;utf8,${encodeURIComponent(text)}`
  }
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not compress image')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.82, 0.7, 0.55, 0.4, 0.28]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= MAX_DATA_URL_BYTES) return url
  }
  const fallback = canvas.toDataURL('image/jpeg', 0.2)
  if (fallback.length > 700_000) throw new Error('Image is too large to store')
  return fallback
}

/**
 * Upload a photo. Uses Storage when a DMly bucket/emulator is configured;
 * otherwise stores a compressed data URL in Firestore (no default-bucket use).
 */
export async function uploadImage(path: string, file: File): Promise<string> {
  if (storageConfigured) {
    const r = sref(storage, path)
    await uploadBytes(r, file, { contentType: file.type })
    return getDownloadURL(r)
  }
  return fileToDataUrl(file)
}

/** Max raw size for files stored inline in a Firestore message (base64 grows ~33%; Firestore docs cap at 1 MiB). */
export const MAX_FILE_BYTES = 700 * 1024
/** Max voice message length. Opus at ~32 kbps keeps 60 s around 240 KB. */
export const MAX_VOICE_MS = 60_000

export function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('Could not read file'))
    r.readAsDataURL(blob)
  })
}

export async function fileToInline(file: File): Promise<{ url: string; name: string; size: number; type: string }> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`Files must be under ${Math.round(MAX_FILE_BYTES / 1024)} KB`)
  const url = await readAsDataUrl(file)
  return { url, name: file.name.slice(0, 120), size: file.size, type: file.type || 'application/octet-stream' }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function pickAudioMime(): string {
  const opts = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4']
  for (const m of opts) {
    try { if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m } catch { /* ignore */ }
  }
  return ''
}

/** Minimal voice recorder: start() asks for the mic, stop() resolves with a data URL + duration. Auto-stops at MAX_VOICE_MS. */
export class VoiceRecorder {
  private rec: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null
  private started = 0
  private timer = 0
  private done: ((v: { url: string; duration: number } | null) => void) | null = null
  onAutoStop?: () => void

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mime = pickAudioMime()
    this.rec = new MediaRecorder(this.stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 })
    this.chunks = []
    this.rec.ondataavailable = (e) => { if (e.data.size) this.chunks.push(e.data) }
    this.rec.onstop = async () => {
      const duration = Date.now() - this.started
      this.stream?.getTracks().forEach((t) => t.stop())
      const cb = this.done
      this.done = null
      if (!cb) return
      if (!this.chunks.length) { cb(null); return }
      const blob = new Blob(this.chunks, { type: this.rec?.mimeType || mime || 'audio/webm' })
      cb({ url: await readAsDataUrl(blob), duration })
    }
    this.started = Date.now()
    this.rec.start(250)
    this.timer = window.setTimeout(() => this.onAutoStop?.(), MAX_VOICE_MS)
  }

  elapsed() { return this.started ? Date.now() - this.started : 0 }

  stop(): Promise<{ url: string; duration: number } | null> {
    window.clearTimeout(this.timer)
    return new Promise((resolve) => {
      if (!this.rec || this.rec.state === 'inactive') { resolve(null); return }
      this.done = resolve
      this.rec.stop()
    })
  }

  cancel() {
    window.clearTimeout(this.timer)
    this.done = null
    try { if (this.rec && this.rec.state !== 'inactive') this.rec.stop() } catch { /* ignore */ }
    this.stream?.getTracks().forEach((t) => t.stop())
  }
}

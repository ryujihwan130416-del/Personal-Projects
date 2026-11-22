import { tx } from '../i18n'
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore'
import QRCode from 'qrcode'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { IconBack } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { dismiss, loadSuggestions, usernameFromQr, type Suggestion } from '../lib/friends'
import { follow, unfollow } from '../lib/follow'
import { normalizeUsername } from '../lib/ids'
import type { UserProfile } from '../types'

type Tab = 'suggest' | 'qr' | 'scan'

export function FriendsPage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'suggest')
  return (
    <div className="screen" data-testid="friends-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={tx("Back")}><IconBack /></button>
        <h2>{tx("Friends")}</h2>
      </div>
      <div className="seg big friends-seg" role="tablist">
        {([['suggest', tx('Suggestions')], ['qr', tx('My QR')], ['scan', tx('Scan')]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} data-testid={`friends-tab-${id}`}>{label}</button>
        ))}
      </div>
      <div className="friends-body phase" key={tab}>
        {tab === 'suggest' ? <Suggestions /> : tab === 'qr' ? <MyQr /> : <Scan />}
      </div>
    </div>
  )
}

function Suggestions() {
  const { user, isBlocked } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [list, setList] = useState<Suggestion[] | null>(null)
  const [followed, setFollowed] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!user) return
    let live = true
    void loadSuggestions(user.uid, isBlocked).then((l) => { if (live) setList(l) })
    return () => { live = false }
  }, [user, isBlocked])
  if (!user) return null
  if (!list) return <div className="spinner" />
  if (!list.length) return <div className="empty"><h3>{tx("No suggestions yet")}</h3><p>{tx("Follow a few people or join a group and we’ll find friends of friends.")}</p></div>
  const toggle = async (s: Suggestion) => {
    const on = followed.has(s.person.uid)
    try {
      if (on) await unfollow(user.uid, s.person.uid)
      else await follow(user.uid, s.person.uid)
      const n = new Set(followed); if (on) n.delete(s.person.uid); else n.add(s.person.uid)
      setFollowed(n)
      if (!on) toast(tx('Following {name} 🎉', { name: s.person.displayName }))
    } catch { toast(tx("Could not update")) }
  }
  return (
    <div className="list" data-testid="suggestions">
      {list.map((s) => (
        <div key={s.person.uid} className="list-row sugg-row" data-testid={`sugg-${s.person.username}`}>
          <button type="button" className="sugg-main" onClick={() => nav(`/u/${s.person.username}`)}>
            <Avatar name={s.person.displayName} photoURL={s.person.photoURL} size={48} />
            <div className="meta">
              <div className="name">{s.person.displayName}</div>
              <div className="preview"><p>@{s.person.username}</p></div>
              <div className="sugg-reason" data-testid="sugg-reason">{s.reason}</div>
            </div>
          </button>
          <button type="button" className={`btn ${followed.has(s.person.uid) ? 'btn-ghost' : 'btn-lime'} sugg-follow`} onClick={() => void toggle(s)} data-testid={`sugg-follow-${s.person.username}`}>
            {followed.has(s.person.uid) ? tx('Following') : tx('Follow')}
          </button>
          <button type="button" className="icon-btn" aria-label={tx("Dismiss")} onClick={() => { dismiss(s.person.uid); setList(list.filter((x) => x !== s)) }} data-testid={`sugg-dismiss-${s.person.username}`}>×</button>
        </div>
      ))}
    </div>
  )
}

export function addLink(username: string) { return `${location.origin}/add/${username}` }

function MyQr() {
  const { profile } = useAuth()
  const toast = useToast()
  const [img, setImg] = useState('')
  const link = profile ? addLink(profile.username) : ''
  useEffect(() => {
    if (!link) return
    void QRCode.toDataURL(link, { margin: 1, width: 320, errorCorrectionLevel: 'M', color: { dark: '#1a1530', light: '#ffffff' } }).then(setImg)
  }, [link])
  if (!profile) return null
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast(tx("Link copied")) } catch { toast(link) } }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: tx('Add me on Pingo'), text: tx('Add me on Pingo: @{username}', { username: profile.username }), url: link }) } catch { /* cancelled */ } }
    else void copy()
  }
  return (
    <div className="qr-card" data-testid="my-qr-card">
      <Avatar name={profile.displayName} photoURL={profile.photoURL} size={64} />
      <h3>{profile.displayName}</h3>
      <div className="at">@{profile.username}</div>
      <div className="qr-frame">{img ? <img src={img} alt={`QR code for @${profile.username}`} data-testid="my-qr" /> : <div className="spinner" />}</div>
      <p className="qr-hint">{tx("Friends can scan this in Pingo (Friends → Scan) or with their phone camera.")}</p>
      <code className="qr-link" data-testid="my-qr-link">{link}</code>
      <div className="qr-actions">
        <button type="button" className="btn btn-ghost" onClick={() => void copy()} data-testid="qr-copy">{tx("Copy link")}</button>
        <button type="button" className="btn btn-ghost" onClick={() => void share()} data-testid="qr-share">{tx("Share")}</button>
        <a className="btn btn-primary" href={img} download={`pingo-${profile.username}.png`} data-testid="qr-download">{tx("Save image")}</a>
      </div>
    </div>
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
function makeDetector(): Detector | null {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  try { return BD ? new BD({ formats: ['qr_code'] }) : null } catch { return null }
}
async function decodeCanvas(canvas: HTMLCanvasElement, det: Detector | null): Promise<string | null> {
  if (det) {
    try { const r = await det.detect(canvas); if (r[0]?.rawValue) return r[0].rawValue } catch { /* fall back */ }
  }
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const { default: jsQR } = await import('jsqr')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

function Scan() {
  const nav = useNavigate()
  const toast = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [on, setOn] = useState(false)
  const [err, setErr] = useState('')
  const [manual, setManual] = useState('')
  const stop = useCallback(() => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setOn(false) }, [])
  useEffect(() => stop, [stop])

  const found = useCallback((raw: string) => {
    const u = usernameFromQr(raw)
    if (!u) { toast(tx("That QR code isn’t a Pingo friend code")); return false }
    stop()
    nav(`/add/${u}`)
    return true
  }, [nav, stop, toast])

  const start = async () => {
    setErr('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = s
      setOn(true)
      const v = videoRef.current
      if (!v) return
      v.srcObject = s
      await v.play()
      const det = makeDetector()
      const canvas = document.createElement('canvas')
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return
        const vw = v.videoWidth, vh = v.videoHeight
        if (vw && vh) {
          const k = Math.min(1, 640 / Math.max(vw, vh))
          canvas.width = Math.round(vw * k); canvas.height = Math.round(vh * k)
          canvas.getContext('2d', { willReadFrequently: true })?.drawImage(v, 0, 0, canvas.width, canvas.height)
          const r = await decodeCanvas(canvas, det)
          if (r && usernameFromQr(r)) { found(r); return }
        }
        window.setTimeout(() => void tick(), 250)
      }
      void tick()
    } catch (e) {
      setErr(e instanceof Error && e.name === 'NotAllowedError' ? tx('Camera permission was denied. You can scan a screenshot instead.') : tx('No camera available. You can scan a screenshot instead.'))
      stop()
    }
  }

  const fromImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const url = URL.createObjectURL(f)
    try {
      const img = new Image()
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
      const canvas = document.createElement('canvas')
      const k = Math.min(1, 1200 / Math.max(img.width, img.height))
      canvas.width = Math.round(img.width * k); canvas.height = Math.round(img.height * k)
      canvas.getContext('2d', { willReadFrequently: true })?.drawImage(img, 0, 0, canvas.width, canvas.height)
      const r = await decodeCanvas(canvas, makeDetector())
      if (!r) toast(tx("No QR code found in that image"))
      else found(r)
    } catch { toast(tx("Could not read that image")) } finally { URL.revokeObjectURL(url) }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const u = usernameFromQr(manual) ?? normalizeUsername(manual)
    if (u) nav(`/add/${u}`)
  }

  return (
    <div className="scan" data-testid="scan">
      <div className={`scan-view ${on ? 'on' : ''}`}>
        <video ref={videoRef} muted playsInline data-testid="scan-video" />
        {on ? <div className="scan-reticle" aria-hidden="true"><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /><b className="scan-line" /></div> : <div className="scan-idle"><div className="scan-idle-frame" aria-hidden="true"><i className="c1" /><i className="c2" /><i className="c3" /><i className="c4" /><b className="scan-line" /><span className="scan-cam">📷</span></div><span>{tx("Point your camera at a Pingo QR code")}</span></div>}
      </div>
      {err ? <p className="form-error" data-testid="scan-error">{err}</p> : null}
      <div className="qr-actions">
        {on ? <button type="button" className="btn btn-ghost" onClick={stop} data-testid="scan-stop">{tx("Stop camera")}</button>
          : <button type="button" className="btn btn-primary" onClick={() => void start()} data-testid="scan-start">{tx("Start camera")}</button>}
        <label className="btn btn-ghost" style={{ cursor: 'pointer' }} data-testid="scan-shot">
          🖼️ {tx('Scan a screenshot')}
          <input className="hidden-file" type="file" accept="image/*" onChange={(e) => void fromImage(e)} data-testid="scan-file" />
        </label>
      </div>
      <form className="scan-manual" onSubmit={submit}>
        <input className="input" placeholder={tx("…or paste a link / @username")} value={manual} onChange={(e) => setManual(e.target.value)} data-testid="scan-manual" />
        <button className="btn btn-lime" type="submit" data-testid="scan-go">{tx("Go")}</button>
      </form>
    </div>
  )
}

/** /add/:username — landing page for QR codes and shared links. */
export function AddFriendRedirect() {
  const { username = '' } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [person, setPerson] = useState<UserProfile | null | undefined>(undefined)
  const [following, setFollowing] = useState(false)
  useEffect(() => {
    const uname = normalizeUsername(username)
    void (async () => {
      let uid = ''
      const u = await getDoc(doc(db, ...fsCol('usernames', uname))).catch(() => null)
      if (u?.exists()) uid = String(u.data().uid)
      else {
        const s = await getDocs(query(collection(db, ...fsCol('users')), where('username', '==', uname))).catch(() => null)
        uid = s?.docs[0]?.id ?? ''
      }
      if (!uid) { setPerson(null); return }
      const p = await getDoc(doc(db, ...fsCol('users', uid))).catch(() => null)
      if (!p?.exists()) { setPerson(null); return }
      const d = p.data()
      setPerson({ uid, username: d.username, displayName: d.displayName, bio: d.bio ?? '', link: d.link ?? '', photoURL: d.photoURL ?? '', createdAt: d.createdAt ?? null })
    })()
  }, [username])
  useEffect(() => {
    if (!user || !person) return
    return onSnapshot(doc(db, ...fsCol('users', user.uid, 'following', person.uid)), (s) => setFollowing(s.exists()))
  }, [user, person])
  if (person === undefined) return <div className="spinner" />
  return (
    <div className="screen" data-testid="add-friend-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav('/friends')} aria-label={tx("Back")}><IconBack /></button>
        <h2>{tx("Add friend")}</h2>
      </div>
      {person === null ? <div className="empty"><h3>{tx("No one with that username")}</h3><p>{tx("Double-check the code or link.")}</p></div> : (
        <div className="qr-card fade-in">
          <Avatar name={person.displayName} photoURL={person.photoURL} size={96} />
          <h3 data-testid="add-name">{person.displayName}</h3>
          <div className="at">@{person.username}</div>
          {person.bio ? <p className="bio">{person.bio}</p> : null}
          {person.uid === user?.uid ? <p className="qr-hint">{tx("That’s you! 👋")}</p> : (
            <div className="qr-actions">
              <button type="button" className={`btn ${following ? 'btn-ghost' : 'btn-lime'}`} data-testid="add-follow" onClick={() => void (async () => {
                if (!user) return
                if (following) await unfollow(user.uid, person.uid)
                else { await follow(user.uid, person.uid); toast(tx("You're now following {name} 🎉", { name: person.displayName })) }
              })()}>{following ? tx('Following ✓') : tx('Follow')}</button>
              <button type="button" className="btn btn-ghost" onClick={() => nav(`/u/${person.username}`)} data-testid="add-view">{tx("View profile")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

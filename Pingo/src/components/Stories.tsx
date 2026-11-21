import { askConfirm } from './ConfirmDialog'
import { tx } from '../i18n'
import { addDoc, collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, Timestamp, where } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { formatListTime } from '../lib/format'
import { fileToDataUrl } from '../lib/media'
import { Avatar } from './Avatar'
import { useToast } from './Toast'

export interface StoryDoc {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  authorPhoto: string
  kind: 'text' | 'photo'
  text: string
  photoURL: string
  bg: string
  createdAt: Timestamp | null
  expiresAt: Timestamp | null
}
export const STORY_MS = 24 * 3600 * 1000
const SLIDE_MS = 5000
export const STORY_BGS: Record<string, string> = {
  sunset: 'linear-gradient(160deg, #ff4d3a, #ff8a3d 55%, #ffd23f)',
  ocean: 'linear-gradient(160deg, #2f8cff, #38c6ff 60%, #5ee0d0)',
  grape: 'linear-gradient(160deg, #7b5cff, #c05cff)',
  mint: 'linear-gradient(160deg, #14b886, #c8f542)',
  candy: 'linear-gradient(160deg, #ff4f9a, #ffb4a2)',
  night: 'linear-gradient(160deg, #16121f, #3b2f63)',
  lemon: 'linear-gradient(160deg, #ffd23f, #fff3d6)',
  dots: 'radial-gradient(circle at 20% 20%, #fff6 0 6px, transparent 7px) 0 0 / 34px 34px, linear-gradient(160deg, #ff8a3d, #ff4f9a)',
}

/* ---------- shared store: one subscription for strip, rings and viewer ---------- */
let storeUid = ''
let stories: StoryDoc[] = []
let circle = new Set<string>()
let unsubs: (() => void)[] = []
const subs = new Set<() => void>()
const SEEN_KEY = 'pingo-story-seen'
let seen = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[] } catch { return [] } })())
const notify = () => subs.forEach((f) => f())
export function markSeen(id: string) {
  if (seen.has(id)) return
  seen.add(id)
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-500))) } catch { /* ignore */ }
  notify()
}

function asStory(id: string, d: Record<string, unknown>): StoryDoc {
  return {
    id, authorId: String(d.authorId ?? ''), authorName: String(d.authorName ?? ''), authorUsername: String(d.authorUsername ?? ''),
    authorPhoto: String(d.authorPhoto ?? ''), kind: d.kind === 'photo' ? 'photo' : 'text', text: String(d.text ?? ''),
    photoURL: String(d.photoURL ?? ''), bg: String(d.bg ?? 'sunset'), createdAt: (d.createdAt as Timestamp) ?? null, expiresAt: (d.expiresAt as Timestamp) ?? null,
  }
}
export const isLive = (s: StoryDoc, now = Date.now()) => {
  const c = s.createdAt?.toMillis() ?? now
  return now - c < STORY_MS && (!s.expiresAt || s.expiresAt.toMillis() > now)
}

function start(uid: string) {
  if (storeUid === uid) return
  unsubs.forEach((u) => u())
  storeUid = uid
  stories = []
  circle = new Set([uid])
  const since = Timestamp.fromMillis(Date.now() - STORY_MS)
  let following = new Set<string>()
  let chatMates = new Set<string>()
  const recompute = () => { circle = new Set([uid, ...following, ...chatMates]); notify() }
  unsubs = [
    onSnapshot(query(collection(db, ...fsCol('stories')), where('createdAt', '>', since)), (s) => {
      stories = s.docs.map((d) => asStory(d.id, d.data()))
      stories.sort((a, b) => (a.createdAt?.toMillis() ?? Date.now()) - (b.createdAt?.toMillis() ?? Date.now()))
      notify()
    }, () => { /* offline */ }),
    onSnapshot(collection(db, ...fsCol('users', uid, 'following')), (s) => { following = new Set(s.docs.map((d) => d.id)); recompute() }, () => {}),
    onSnapshot(query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', uid)), (s) => {
      chatMates = new Set(s.docs.flatMap((d) => (d.data().requestStatus === 'declined' ? [] : (d.data().memberIds as string[]) ?? [])))
      recompute()
    }, () => {}),
  ]
  // Stories expire after 24 h with no server job: the owner's own client removes its expired ones.
  void getDocs(query(collection(db, ...fsCol('stories')), where('authorId', '==', uid))).then((s) => {
    s.docs.filter((d) => !isLive(asStory(d.id, d.data()))).forEach((d) => void deleteStory(d.id))
  }).catch(() => {})
}

/** Live stories from me + people I follow or chat with, grouped by author (unseen authors first, me first). */
export function useStoryGroups() {
  const { user, isBlocked } = useAuth()
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!user) return
    start(user.uid)
    const f = () => setTick((x) => x + 1)
    subs.add(f)
    const iv = window.setInterval(f, 60000)
    f()
    return () => { subs.delete(f); window.clearInterval(iv) }
  }, [user])
  const uid = user?.uid ?? ''
  const now = Date.now()
  const live = stories.filter((s) => isLive(s, now) && circle.has(s.authorId) && !isBlocked(s.authorId))
  const byAuthor = new Map<string, StoryDoc[]>()
  for (const s of live) byAuthor.set(s.authorId, [...(byAuthor.get(s.authorId) ?? []), s])
  const groups = [...byAuthor.entries()].map(([authorId, list]) => ({ authorId, list, unseen: list.some((s) => !seen.has(s.id)) }))
  groups.sort((a, b) => (a.authorId === uid ? -1 : b.authorId === uid ? 1 : Number(b.unseen) - Number(a.unseen) || (b.list.at(-1)?.createdAt?.toMillis() ?? 0) - (a.list.at(-1)?.createdAt?.toMillis() ?? 0)))
  return { groups, uid }
}

export function useStoryRings(): Record<string, 'seen' | 'unseen'> {
  const { groups } = useStoryGroups()
  return useMemo(() => Object.fromEntries(groups.map((g) => [g.authorId, g.unseen ? 'unseen' : 'seen'] as const)), [groups])
}

/* ---------- viewer host (one per app) ---------- */
let openState: { authorId: string } | null = null
const openSubs = new Set<() => void>()
export function openStories(authorId: string) { openState = { authorId }; openSubs.forEach((f) => f()) }
let composeOpen = false
export function openStoryComposer() { composeOpen = true; openSubs.forEach((f) => f()) }

export function StoryHost() {
  const [, setT] = useState(0)
  useEffect(() => { const f = () => setT((x) => x + 1); openSubs.add(f); return () => { openSubs.delete(f) } }, [])
  const close = () => { openState = null; composeOpen = false; openSubs.forEach((f) => f()) }
  if (composeOpen) return <StoryComposer onClose={close} />
  if (openState) return <StoryViewer startAuthor={openState.authorId} onClose={close} />
  return null
}

export async function deleteStory(id: string) {
  try {
    const v = await getDocs(collection(db, ...fsCol('stories', id, 'views')))
    await Promise.all(v.docs.map((d) => deleteDoc(d.ref)))
  } catch { /* views may be unreadable; story delete still works */ }
  await deleteDoc(doc(db, ...fsCol('stories', id)))
}

/* ---------- strip ---------- */
export function StoryStrip() {
  const { profile } = useAuth()
  const { groups, uid } = useStoryGroups()
  const mine = groups.find((g) => g.authorId === uid)
  const others = groups.filter((g) => g.authorId !== uid)
  if (!profile) return null
  return (
    <div className="story-strip" data-testid="story-strip">
      <div className="story-item">
        <button type="button" className="story-me" onClick={() => (mine ? openStories(uid) : openStoryComposer())} data-testid="story-mine">
          <Avatar name={profile.displayName} photoURL={profile.photoURL} size={54} ring={mine ? (mine.unseen ? 'unseen' : 'seen') : undefined} />
        </button>
        <button type="button" className="story-add" onClick={openStoryComposer} aria-label={tx("Add to your story")} data-testid="story-add">+</button>
        <span>{tx("Your story")}</span>
      </div>
      {others.map((g) => (
        <button key={g.authorId} type="button" className="story-item" onClick={() => openStories(g.authorId)} data-testid={`story-${g.list[0].authorUsername}`}>
          <Avatar name={g.list[0].authorName} photoURL={g.list[0].authorPhoto} size={54} ring={g.unseen ? 'unseen' : 'seen'} />
          <span>{g.list[0].authorName.split(' ')[0]}</span>
        </button>
      ))}
      {!others.length ? <p className="story-hint">{tx("Stories from friends show up here for 24 hours.")}</p> : null}
    </div>
  )
}

/* ---------- Feed: stories card + "all stories" sheet ---------- */
function storyBg(s: StoryDoc) {
  return s.kind === 'photo' && s.photoURL ? `center / cover no-repeat url("${s.photoURL}")` : (STORY_BGS[s.bg] ?? STORY_BGS.sunset)
}

/** Top of the Feed: your story + every friend's story in one strip, with a button that opens them all. */
export function FeedStories() {
  const { groups } = useStoryGroups()
  const [open, setOpen] = useState(false)
  const count = groups.reduce((n, g) => n + g.list.length, 0)
  // Line the card up with the feed's posts (their width can be customised in the UI editor).
  const ref = useRef<HTMLElement>(null)
  const [w, setW] = useState<number | undefined>()
  useEffect(() => {
    const feed = ref.current?.parentElement
    if (!feed) return
    const measure = () => { const p = feed.querySelector<HTMLElement>('.post-card'); setW(p ? p.getBoundingClientRect().width : undefined) }
    measure()
    const ro = new ResizeObserver(measure); ro.observe(feed)
    const mo = new MutationObserver(measure); mo.observe(feed, { childList: true })
    return () => { ro.disconnect(); mo.disconnect() }
  }, [])
  return (
    <section className="feed-stories" ref={ref} style={w && w > 260 ? { width: w } : undefined} data-testid="feed-stories">
      <header className="feed-stories-head">
        <h2><span aria-hidden="true">✨</span>{tx('Stories')}{count ? <em className="feed-stories-count">{count}</em> : null}</h2>
        <button type="button" className="feed-stories-all" onClick={() => setOpen(true)} data-testid="feed-stories-all">{tx('See all')} ›</button>
      </header>
      <StoryStrip />
      {open ? <StoriesSheet onClose={() => setOpen(false)} /> : null}
    </section>
  )
}

function StoriesSheet({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const { groups, uid } = useStoryGroups()
  const mine = groups.find((g) => g.authorId === uid)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const openAt = (authorId: string) => { onClose(); openStories(authorId) }
  return createPortal(
    <div className="stories-sheet-backdrop" onClick={onClose} role="presentation">
      <div className="stories-sheet" role="dialog" aria-modal="true" aria-label={tx('Stories')} onClick={(e) => e.stopPropagation()} data-testid="stories-sheet">
        <header>
          <h2>{tx('Stories')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={tx('Close')} data-testid="stories-sheet-close">✕</button>
        </header>
        <div className="stories-grid">
          {!mine && profile ? (
            <button type="button" className="story-tile story-tile-add" onClick={() => { onClose(); openStoryComposer() }} data-testid="stories-sheet-add">
              <span className="story-tile-plus">+</span>
              <b>{tx('Add to your story')}</b>
            </button>
          ) : null}
          {groups.map((g) => {
            const last = g.list[g.list.length - 1]
            return (
              <button key={g.authorId} type="button" className={`story-tile ${g.unseen ? 'unseen' : 'seen'}`} style={{ background: storyBg(last) }} onClick={() => openAt(g.authorId)} data-testid="stories-sheet-tile">
                {last.kind === 'text' ? <span className="story-tile-text">{last.text}</span> : null}
                <span className="story-tile-foot">
                  <Avatar name={last.authorName} photoURL={last.authorPhoto} size={30} ring={g.unseen ? 'unseen' : 'seen'} />
                  <span><b>{g.authorId === uid ? tx('Your story') : last.authorName}</b><small>{formatListTime(last.createdAt?.toMillis())}{g.list.length > 1 ? ` · ${g.list.length}` : ''}</small></span>
                </span>
              </button>
            )
          })}
        </div>
        {!groups.length ? <p className="story-hint">{tx('Stories from friends show up here for 24 hours.')}</p> : null}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- viewer ---------- */
function StoryViewer({ startAuthor, onClose }: { startAuthor: string; onClose: () => void }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { groups, uid } = useStoryGroups()
  const order = useMemo(() => {
    const ids = groups.map((g) => g.authorId)
    const i = ids.indexOf(startAuthor)
    return i < 0 ? ids : [...ids.slice(i), ...ids.slice(0, i)].filter((id) => id !== uid || startAuthor === uid)
  }, [groups.length, startAuthor]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ai, setAi] = useState(0)
  const group = groups.find((g) => g.authorId === order[ai])
  const [si, setSi] = useState(() => { const g = groups.find((x) => x.authorId === startAuthor); const k = g ? g.list.findIndex((s) => !seen.has(s.id)) : 0; return Math.max(0, k) })
  const story = group?.list[Math.min(si, (group?.list.length ?? 1) - 1)]
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [viewers, setViewers] = useState<{ uid: string; name: string; photo: string; at: Timestamp | null }[] | null>(null)
  const elapsed = useRef(0)
  const viewed = useRef(new Set<string>())

  const next = useCallback(() => {
    if (!group) { onClose(); return }
    if (si < group.list.length - 1) { setSi(si + 1); return }
    if (ai < order.length - 1) { setAi(ai + 1); setSi(0); return }
    onClose()
  }, [group, si, ai, order.length, onClose])
  const prev = () => {
    if (si > 0) { setSi(si - 1); return }
    if (ai > 0) { const g = groups.find((x) => x.authorId === order[ai - 1]); setAi(ai - 1); setSi(Math.max(0, (g?.list.length ?? 1) - 1)) }
    else { elapsed.current = 0; setProgress(0) }
  }

  useEffect(() => { elapsed.current = 0; setProgress(0); setViewers(null) }, [story?.id])
  useEffect(() => {
    if (!story || !user) return
    markSeen(story.id)
    if (story.authorId !== user.uid && !viewed.current.has(story.id)) {
      viewed.current.add(story.id)
      void setDoc(doc(db, ...fsCol('stories', story.id, 'views', user.uid)), { uid: user.uid, name: profile?.displayName ?? '', photo: (profile?.photoURL ?? '').length < 300000 ? profile?.photoURL ?? '' : '', at: serverTimestamp() }).catch(() => { /* already viewed */ })
    }
  }, [story?.id, user, profile])
  useEffect(() => {
    if (!story || paused || viewers) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      elapsed.current += now - last
      last = now
      const p = Math.min(1, elapsed.current / SLIDE_MS)
      setProgress(p)
      if (p >= 1) { next(); return }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [story?.id, paused, viewers, next])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  if (!group || !story) return null
  const mine = story.authorId === uid

  const showViewers = async () => {
    setPaused(true)
    try {
      const s = await getDocs(collection(db, ...fsCol('stories', story.id, 'views')))
      setViewers(s.docs.map((d) => ({ uid: d.id, name: String(d.data().name ?? ''), photo: String(d.data().photo ?? ''), at: (d.data().at as Timestamp) ?? null })))
    } catch { toast(tx("Could not load viewers")) }
  }
  const del = async () => {
    setPaused(true)
    const ok = await askConfirm(tx('Delete this story?'), { danger: true })
    setPaused(false)
    if (!ok) return
    try { await deleteStory(story.id); toast(tx("Story deleted")); if (group.list.length <= 1) onClose(); else setSi(Math.max(0, si - 1)) } catch (e) { toast(e instanceof Error ? e.message : tx('Could not delete')) }
  }

  return createPortal(
    <div className="story-viewer" data-testid="story-viewer" role="dialog" aria-label={`${story.authorName}'s story`}>
      <div className="story-stage" key={story.id} style={story.kind === 'text' ? { background: STORY_BGS[story.bg] ?? STORY_BGS.sunset } : undefined}
        onPointerDown={() => setPaused(true)} onPointerUp={(e) => {
          setPaused(false)
          if ((e.target as Element).closest('button')) return
          const r = e.currentTarget.getBoundingClientRect()
          if (e.clientX - r.left < r.width * 0.33) prev(); else next()
        }} onPointerLeave={() => setPaused(false)}>
        {story.kind === 'photo' ? <img src={story.photoURL} alt="" className="story-photo" draggable={false} /> : null}
        {story.text ? <p className={`story-text ${story.kind === 'photo' ? 'caption' : ''}`} data-testid="story-text">{story.text}</p> : null}
        <div className="story-top">
          <div className="story-bars">
            {group.list.map((s, i) => <i key={s.id}><b style={{ transform: `scaleX(${i < si ? 1 : i === si ? progress : 0})` }} /></i>)}
          </div>
          <div className="story-who">
            <Avatar name={story.authorName} photoURL={story.authorPhoto} size={34} />
            <b>{mine ? tx('Your story') : story.authorName}</b>
            <small>{formatListTime(story.createdAt?.toMillis())}</small>
            <span style={{ flex: 1 }} />
            {paused ? <small className="story-paused">❚❚</small> : null}
            <button type="button" className="story-x" onClick={onClose} aria-label={tx("Close")} data-testid="story-close">×</button>
          </div>
        </div>
        {mine ? (
          <div className="story-owner">
            <button type="button" onClick={() => void showViewers()} data-testid="story-seen-by">{tx("👁 Seen by")}</button>
            <button type="button" onClick={() => openStoryComposer()}>{tx("＋ Add")}</button>
            <button type="button" className="danger" onClick={() => void del()} data-testid="story-delete">{tx("🗑 Delete")}</button>
          </div>
        ) : null}
        {viewers ? (
          <div className="story-sheet" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} data-testid="story-viewers">
            <header><b>{tx('Seen by {n}', { n: viewers.length })}</b><button type="button" onClick={() => { setViewers(null); setPaused(false) }}>{tx("Done")}</button></header>
            {viewers.length === 0 ? <p>{tx("No views yet.")}</p> : null}
            {viewers.map((v) => (
              <div key={v.uid} className="story-viewer-row" data-testid="story-viewer-row"><Avatar name={v.name} photoURL={v.photo} size={36} /><b>{v.name || 'Someone'}</b><small>{formatListTime(v.at?.toMillis())}</small></div>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- composer ---------- */
function StoryComposer({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [kind, setKind] = useState<'text' | 'photo'>('text')
  const [text, setText] = useState('')
  const [bg, setBg] = useState('sunset')
  const [photo, setPhoto] = useState('')
  const [busy, setBusy] = useState(false)
  const post = async () => {
    if (!user || !profile) return
    if (kind === 'text' && !text.trim()) { toast(tx("Write something first")); return }
    if (kind === 'photo' && !photo) { toast(tx("Pick a photo first")); return }
    setBusy(true)
    try {
      await addDoc(collection(db, ...fsCol('stories')), {
        authorId: user.uid, authorName: profile.displayName, authorUsername: profile.username,
        authorPhoto: profile.photoURL.length < 300000 ? profile.photoURL : '',
        kind, text: text.trim().slice(0, 300), photoURL: kind === 'photo' ? photo : '', bg,
        createdAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + STORY_MS),
      })
      toast(tx("Added to your story ✨ (visible for 24 h)"))
      onClose()
    } catch (e) { toast(e instanceof Error ? e.message : tx('Could not post the story')) } finally { setBusy(false) }
  }
  return createPortal(
    <div className="backdrop center" onClick={onClose}>
      <div className="story-compose" onClick={(e) => e.stopPropagation()} data-testid="story-composer">
        <div className="seg">
          <button type="button" className={kind === 'text' ? 'on' : ''} onClick={() => setKind('text')} data-testid="story-kind-text">{tx("Aa Text")}</button>
          <button type="button" className={kind === 'photo' ? 'on' : ''} onClick={() => setKind('photo')} data-testid="story-kind-photo">{tx("📷 Photo")}</button>
        </div>
        <div className="story-compose-preview" style={kind === 'text' ? { background: STORY_BGS[bg] } : undefined}>
          {kind === 'photo' ? (photo ? <img src={photo} alt="" /> : <label className="story-pick">{tx("Choose a photo")}<input type="file" accept="image/*" className="hidden-file" data-testid="story-photo-input" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { setPhoto(await fileToDataUrl(f)) } catch (err) { toast(err instanceof Error ? err.message : tx('Could not read photo')) } }} /></label>) : null}
          <textarea className={`story-text-input ${kind === 'photo' ? 'caption' : ''}`} maxLength={300} placeholder={kind === 'text' ? tx('Type something…') : tx('Add a caption (optional)')} value={text} onChange={(e) => setText(e.target.value)} data-testid="story-text-input" />
        </div>
        {kind === 'text' ? (
          <div className="story-bgs">{Object.entries(STORY_BGS).map(([k, v]) => <button key={k} type="button" className={bg === k ? 'on' : ''} style={{ background: v }} onClick={() => setBg(k)} aria-label={k} data-testid={`story-bg-${k}`} />)}</div>
        ) : photo ? <button type="button" className="btn btn-ghost" onClick={() => setPhoto('')}>{tx("Choose another photo")}</button> : null}
        <div className="result-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tx("Cancel")}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void post()} data-testid="story-post">{tx("Share to story")}</button>
        </div>
        <small className="a-note">{tx("Visible to people you follow or chat with, for 24 hours.")}</small>
      </div>
    </div>,
    document.body,
  )
}

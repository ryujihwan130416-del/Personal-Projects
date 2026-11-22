import { FeedStories } from '../components/Stories'
import { tx } from '../i18n'
import { ReportDialog } from '../components/ReportDialog'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { IconBack, IconClose } from '../components/Icons'
import { Lightbox } from '../components/Lightbox'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { uploadImage } from '../lib/media'
import { formatListTime } from '../lib/format'
import { useMyChats } from './Inbox'
import type { CommentDoc, PostDoc } from '../types'
import { useT } from '../i18n'

function asPost(id: string, d: Record<string, unknown>): PostDoc {
  return {
    id,
    authorId: String(d.authorId ?? ''),
    authorName: String(d.authorName ?? ''),
    authorUsername: String(d.authorUsername ?? ''),
    authorPhoto: String(d.authorPhoto ?? ''),
    text: String(d.text ?? ''),
    photoURLs: (d.photoURLs as string[]) ?? [],
    createdAt: (d.createdAt as PostDoc['createdAt']) ?? null,
    likeCount: Number(d.likeCount ?? 0),
    commentCount: Number(d.commentCount ?? 0),
  }
}

export function useFeedPosts() {
  const [posts, setPosts] = useState<PostDoc[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const qy = query(collection(db, ...fsCol('posts')), orderBy('createdAt', 'desc'))
    return onSnapshot(qy, (snap) => {
      setPosts(snap.docs.map((d) => asPost(d.id, d.data())))
      setReady(true)
    }, () => setReady(true))
  }, [])
  return { posts, ready }
}

export function FeedPage() {
  const { user, blockedIds } = useAuth()
  const t = useT()
  const { chats } = useMyChats()
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const { posts, ready } = useFeedPosts()
  const nav = useNavigate()

  useEffect(() => {
    if (!user) return
    return onSnapshot(collection(db, ...fsCol('users', user.uid, 'following')), (snap) => {
      setFollowing(new Set(snap.docs.map((d) => d.id)))
    })
  }, [user])

  const allowed = useMemo(() => {
    const ids = new Set<string>([user?.uid ?? ''])
    following.forEach((id) => ids.add(id))
    for (const c of chats) c.memberIds.forEach((id) => ids.add(id))
    return ids
  }, [user, following, chats])

  const visible = posts.filter((p) => allowed.has(p.authorId) && !blockedIds.has(p.authorId))

  return (
    <div className="screen" data-testid="feed-screen">
      <div className="topbar">
        <h1>{t('feed.title')}</h1>
        <button type="button" className="btn btn-primary" style={{ width: 'auto', padding: '8px 14px' }} data-testid="new-post-btn" onClick={() => nav('/compose')}>{t('feed.write')}</button>
      </div>
      <div className="feed">
        <FeedStories />
        {!ready ? <div className="skeleton-list">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 60 }} />)}</div> : null}
        {ready && visible.length === 0 ? (
          <div className="empty"><h3>{t('feed.emptyTitle')}</h3><p>{t('feed.emptyBody')}</p></div>
        ) : null}
        {visible.map((p) => <PostCard key={p.id} post={p} />)}
      </div>
    </div>
  )
}

export function PostCard({ post, detail }: { post: PostDoc; detail?: boolean }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const t = useT()
  const [liked, setLiked] = useState(false)
  const [light, setLight] = useState<string | null>(null)
  const [reporting, setReporting] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(db, ...fsCol('posts', post.id, 'likes', user.uid)), (s) => setLiked(s.exists()))
  }, [user, post.id])

  const toggleLike = async () => {
    if (!user) return
    const ref = doc(db, ...fsCol('posts', post.id, 'likes', user.uid))
    if (liked) {
      await deleteDoc(ref)
      await updateDoc(doc(db, ...fsCol('posts', post.id)), { likeCount: increment(-1) })
    } else {
      await setDoc(ref, { createdAt: serverTimestamp() })
      await updateDoc(doc(db, ...fsCol('posts', post.id)), { likeCount: increment(1) })
    }
  }

  const del = async () => {
    if (!user || user.uid !== post.authorId) return
    await deleteDoc(doc(db, ...fsCol('posts', post.id)))
    toast(t('feed.deleted'))
    if (detail) nav('/feed')
  }

  return (
    <article className="post-card" data-testid={`post-${post.id}`}>
      <button type="button" className="post-head" onClick={() => nav(`/u/${post.authorUsername}`)}>
        <Avatar name={post.authorName} photoURL={post.authorPhoto} size={40} />
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div className="name">{post.authorName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 700 }}>@{post.authorUsername} · {formatListTime(post.createdAt?.toMillis())}</div>
        </div>
      </button>
      {post.text ? <p className="post-text">{post.text}</p> : null}
      {post.photoURLs.length ? (
        <div className={`post-photos n${Math.min(post.photoURLs.length, 4)}`}>
          {post.photoURLs.map((u) => <img key={u} src={u} alt="" onClick={() => setLight(u)} />)}
        </div>
      ) : null}
      <div className="post-actions">
        <button className="btn btn-ghost" type="button" data-testid={`like-${post.id}`} onClick={() => void toggleLike()}>
          {liked ? '♥' : '♡'} {post.likeCount}
        </button>
        <button className="btn btn-ghost" type="button" data-testid={`comment-open-${post.id}`} onClick={() => !detail && nav(`/post/${post.id}`)}>
          {t('feed.comments', { n: post.commentCount })}
        </button>
        {user?.uid === post.authorId ? (
          <button className="btn btn-ghost" type="button" data-testid={`delete-post-${post.id}`} onClick={() => void del()}>{t('common.delete')}</button>
        ) : (
          <button className="btn btn-ghost post-report" type="button" data-testid={`report-post-${post.id}`} aria-label={tx("Report post")} onClick={() => setReporting(true)}>{tx("🚩 Report")}</button>
        )}
      </div>
      {light ? <Lightbox src={light} onClose={() => setLight(null)} /> : null}
      {reporting ? <ReportDialog target={{ type: 'post', targetUid: post.authorId, targetId: post.id, snapshot: { text: post.text || '[photo post]', kind: 'post', name: post.authorName } }} onClose={() => setReporting(false)} /> : null}
    </article>
  )
}

export function PostDetailPage() {
  const { postId } = useParams()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const t = useT()
  const [post, setPost] = useState<PostDoc | null>(null)
  const [comments, setComments] = useState<CommentDoc[]>([])
  const [text, setText] = useState('')

  useEffect(() => {
    if (!postId) return
    return onSnapshot(doc(db, ...fsCol('posts', postId)), (s) => {
      if (!s.exists()) { setPost(null); return }
      setPost(asPost(s.id, s.data()))
    })
  }, [postId])

  useEffect(() => {
    if (!postId) return
    const qy = query(collection(db, ...fsCol('posts', postId, 'comments')), orderBy('createdAt', 'asc'))
    return onSnapshot(qy, (snap) => {
      setComments(snap.docs.map((d) => {
        const x = d.data()
        return { id: d.id, authorId: x.authorId, authorName: x.authorName, authorPhoto: x.authorPhoto ?? '', text: x.text, createdAt: x.createdAt ?? null }
      }))
    })
  }, [postId])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !profile || !postId || !text.trim()) return
    await addDoc(collection(db, ...fsCol('posts', postId, 'comments')), {
      authorId: user.uid,
      authorName: profile.displayName,
      authorPhoto: profile.photoURL,
      text: text.trim(),
      createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, ...fsCol('posts', postId)), { commentCount: increment(1) })
    setText('')
  }

  return (
    <div className="screen" data-testid="post-detail-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>{t('feed.post')}</h2>
      </div>
      <div className="feed">
        {post ? <PostCard post={post} detail /> : <div className="spinner" />}
        <h3 className="section">{t('feed.commentsHeading')}</h3>
        {comments.map((c) => (
          <div key={c.id} className="list-row" data-testid={`comment-${c.id}`} style={{ boxShadow: '2px 2px 0 var(--border)' }}>
            <Avatar name={c.authorName} photoURL={c.authorPhoto} size={36} />
            <div className="meta">
              <div className="name">{c.authorName}</div>
              <div className="preview"><p>{c.text}</p></div>
            </div>
          </div>
        ))}
        <form onSubmit={(e) => void send(e)} className="join-row" style={{ marginTop: 8 }}>
          <input className="input" data-testid="comment-input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('feed.commentPlaceholder')} />
          <button className="btn btn-primary" type="submit" style={{ width: 'auto' }} data-testid="comment-send">{t('feed.send')}</button>
        </form>
      </div>
    </div>
  )
}

export function ComposePage() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const t = useT()
  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user || !profile) return
    if (!text.trim() && files.length === 0) { toast(t('feed.needContent')); return }
    setBusy(true)
    try {
      const photoURLs: string[] = []
      for (const f of files.slice(0, 4)) {
        photoURLs.push(await uploadImage(`post-media/${user.uid}/${Date.now()}-${f.name}`, f))
      }
      const refDoc = await addDoc(collection(db, ...fsCol('posts')), {
        authorId: user.uid,
        authorName: profile.displayName,
        authorUsername: profile.username,
        authorPhoto: profile.photoURL,
        text: text.trim(),
        photoURLs,
        createdAt: serverTimestamp(),
        likeCount: 0,
        commentCount: 0,
      })
      toast(t('feed.posted'))
      nav(`/post/${refDoc.id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('feed.uploadFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen" data-testid="compose-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconClose /></button>
        <h2>{t('feed.newPost')}</h2>
      </div>
      <form className="profile" onSubmit={(e) => void submit(e)}>
        <textarea className="textarea input" data-testid="post-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t('feed.placeholder')} />
        <label className="btn btn-ghost" style={{ margin: '12px 0', cursor: 'pointer' }}>
          {t('feed.addPhotos')}
          <input className="hidden-file" type="file" accept="image/*" multiple data-testid="post-photos" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))} />
        </label>
        {files.length ? <p style={{ fontWeight: 700, marginBottom: 12 }}>{t('feed.photosSelected', { n: files.length })}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={busy} data-testid="post-submit">{t('feed.publish')}</button>
      </form>
    </div>
  )
}

export async function loadUserPosts(uid: string): Promise<PostDoc[]> {
  const qy = query(collection(db, ...fsCol('posts')), orderBy('createdAt', 'desc'))
  const snap = await getDocs(qy)
  return snap.docs.map((d) => asPost(d.id, d.data())).filter((p) => p.authorId === uid)
}

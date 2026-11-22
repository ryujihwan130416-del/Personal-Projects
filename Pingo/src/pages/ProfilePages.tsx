import { tx } from '../i18n'
import { ReportDialog } from '../components/ReportDialog'
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore'
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { ProfileCard } from '../components/ProfileCard'
import { openStories, useStoryRings } from '../components/Stories'
import { loadFunStats, useProfileStyle, type FunStats } from '../lib/profileStyle'
import { IconBack, IconGear, IconMoon, IconSun } from '../components/Icons'
import { Lightbox } from '../components/Lightbox'
import { useToast } from '../components/Toast'
import { updateOwnProfile, useAuth } from '../contexts/AuthContext'
import { usePrefs } from '../lib/prefs'
import { db, fsCol } from '../firebase/app'
import { uploadImage } from '../lib/media'
import { APP_NAME } from '../firebase/config'
import { usePresenceMap } from '../lib/hooks'
import { dmChatId, normalizeUsername } from '../lib/ids'
import { formatLastActive } from '../lib/format'
import type { PostDoc, UserProfile } from '../types'
import { UpcomingList } from '../components/EventBits'
import { useLocale, useT } from '../i18n'

async function loadUserByUsername(username: string): Promise<UserProfile | null> {
  const uname = normalizeUsername(username)
  const u = await getDoc(doc(db, ...fsCol('usernames', uname)))
  if (u.exists()) {
    const uid = u.data().uid as string
    const snap = await getDoc(doc(db, ...fsCol('users', uid)))
    if (!snap.exists()) return null
    return mapUser(uid, snap.data())
  }
  const qy = query(collection(db, ...fsCol('users')), where('username', '==', uname))
  const snap = await getDocs(qy)
  if (snap.empty) return null
  const d = snap.docs[0]
  return mapUser(d.id, d.data())
}

function mapUser(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    username: String(data.username),
    displayName: String(data.displayName),
    bio: String(data.bio ?? ''),
    link: String(data.link ?? ''),
    photoURL: String(data.photoURL ?? ''),
    createdAt: (data.createdAt as UserProfile['createdAt']) ?? null,
  }
}

export async function openOrCreateDm(me: UserProfile, other: UserProfile): Promise<string> {
  const id = dmChatId(me.uid, other.uid)
  const ref = doc(db, ...fsCol('chats', id))
  const existing = await getDoc(ref)
  if (existing.exists()) return id
  await setDoc(ref, {
    type: 'dm',
    memberIds: [me.uid, other.uid],
    memberInfo: {
      [me.uid]: { displayName: me.displayName, username: me.username, photoURL: me.photoURL },
      [other.uid]: { displayName: other.displayName, username: other.username, photoURL: other.photoURL },
    },
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
    unread: { [me.uid]: 0, [other.uid]: 0 },
    requestStatus: 'pending',
    requestFrom: me.uid,
  })
  return id
}

function ProfileBody({
  person,
  mine,
  online,
  lastActive,
}: {
  person: UserProfile
  mine: boolean
  online?: boolean
  lastActive?: number
}) {
  const nav = useNavigate()
  const { profile, isBlocked, user, logout } = useAuth()
  const toast = useToast()
  const t = useT()
  const [light, setLight] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [following, setFollowing] = useState(false)
  const [posts, setPosts] = useState<PostDoc[]>([])
  const { style } = useProfileStyle(person.uid)
  const rings = useStoryRings()
  const [stats, setStats] = useState<FunStats | null>(null)
  useEffect(() => {
    if (!style.showStats) return
    let live = true
    void loadFunStats(person.uid).then((s) => { if (live) setStats(s) })
    return () => { live = false }
  }, [person.uid, style.showStats])

  useEffect(() => {
    if (!user || mine) return
    return onSnapshot(doc(db, ...fsCol('users', user.uid, 'following', person.uid)), (s) => setFollowing(s.exists()))
  }, [user, mine, person.uid])

  useEffect(() => {
    const qy = query(collection(db, ...fsCol('posts')), where('authorId', '==', person.uid))
    return onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => {
        const x = d.data()
        return {
          id: d.id,
          authorId: x.authorId,
          authorName: x.authorName,
          authorUsername: x.authorUsername,
          authorPhoto: x.authorPhoto ?? '',
          text: x.text ?? '',
          photoURLs: x.photoURLs ?? [],
          createdAt: x.createdAt ?? null,
          likeCount: x.likeCount ?? 0,
          commentCount: x.commentCount ?? 0,
        } as PostDoc
      })
      list.sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0))
      setPosts(list)
    })
  }, [person.uid])

  const toggleFollow = async () => {
    if (!user) return
    const fRef = doc(db, ...fsCol('users', user.uid, 'following', person.uid))
    const rRef = doc(db, ...fsCol('users', person.uid, 'followers', user.uid))
    if (following) {
      await deleteDoc(fRef)
      await deleteDoc(rRef)
      toast(t('profile.unfollowed'))
    } else {
      await setDoc(fRef, { createdAt: serverTimestamp() })
      await setDoc(rRef, { createdAt: serverTimestamp() })
      toast(t('profile.followed'))
    }
  }


  const startDm = async () => {
    if (!profile) return
    if (isBlocked(person.uid)) { toast(t('profile.blockedUser')); return }
    setBusy(true)
    try {
      const id = await openOrCreateDm(profile, person)
      nav(`/chat/${id}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleBlock = async () => {
    if (!user) return
    const ref = doc(db, ...fsCol('users', user.uid, 'blocked', person.uid))
    if (isBlocked(person.uid)) {
      await deleteDoc(ref)
      const chatRef = doc(db, ...fsCol('chats', dmChatId(user.uid, person.uid)))
      const chat = await getDoc(chatRef)
      if (chat.exists()) {
        const blocked = ((chat.data().blockedUids as string[]) ?? []).filter((id) => id !== person.uid)
        await updateDoc(chatRef, { blockedUids: blocked })
      }
      toast(t('profile.unblocked'))
    } else {
      await setDoc(ref, { createdAt: serverTimestamp() })
      const chatRef = doc(db, ...fsCol('chats', dmChatId(user.uid, person.uid)))
      const chat = await getDoc(chatRef)
      if (chat.exists()) {
        const blocked = new Set((chat.data().blockedUids as string[]) ?? [])
        blocked.add(person.uid)
        await updateDoc(chatRef, { blockedUids: [...blocked] })
      }
      toast(t('profile.blocked'))
    }
  }


  return (
    <div className="profile" data-testid="profile-screen">
      <ProfileCard
        person={person}
        style={style}
        stats={stats}
        online={online}
        ring={rings[person.uid]}
        onAvatar={() => { if (rings[person.uid]) openStories(person.uid); else if (person.photoURL) setLight(true) }}
      >
        {!mine && !online ? (
          <p className="at">{formatLastActive(lastActive)}</p>
        ) : null}
        {mine ? <ProfileMenu /> : null}
        {mine ? null : <div className="profile-actions">
          {mine ? null : (
            <>
              <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void startDm()} data-testid="start-dm">{t('profile.message')}</button>
              <button className="btn btn-lime" type="button" onClick={() => void toggleFollow()} data-testid="follow-btn">
                {following ? t('profile.following') : t('profile.follow')}
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => void toggleBlock()} data-testid="block-btn">
                {isBlocked(person.uid) ? t('profile.unblock') : t('profile.block')}
              </button>
            </>
          )}
        </div>}
        {!mine ? (
          <button className="btn btn-text" type="button" onClick={() => setReportOpen(true)} data-testid="report-btn">{t('profile.report')}</button>
        ) : null}
      </ProfileCard>
      {mine ? <UpcomingList uid={person.uid} limit={4} testId="upcoming-profile" /> : null}
      <h3 className="section">{t('profile.posts', { n: posts.length })}</h3>
      <div className="post-grid" data-testid="profile-posts">
        {posts.length === 0 ? <p style={{ gridColumn: '1 / -1', fontWeight: 700, color: 'var(--text-secondary)' }}>{t('profile.noPosts')}</p> : null}
        {posts.map((post) => (
          <Link key={post.id} to={`/post/${post.id}`} data-testid={`grid-post-${post.id}`}>
            {post.photoURLs[0] ? <img src={post.photoURLs[0]} alt="" /> : (post.text || t('profile.postFallback')).slice(0, 40)}
          </Link>
        ))}
      </div>
      {mine ? (
        <div className="profile-foot">
          <button className="btn btn-ghost" type="button" onClick={() => void logout()} data-testid="logout">{t('profile.logout')}</button>
          <p style={{ marginTop: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>{APP_NAME}</p>
        </div>
      ) : null}
      {light && person.photoURL ? <Lightbox src={person.photoURL} alt={person.displayName} onClose={() => setLight(false)} /> : null}
      {reportOpen ? <ReportDialog target={{ type: 'user', targetUid: person.uid, snapshot: { text: `${person.displayName} (@${person.username})${person.bio ? ` — ${person.bio}` : ''}`, kind: 'user', name: person.displayName } }} onClose={() => setReportOpen(false)} /> : null}
    </div>
  )
}

/** Compact ⋯ menu on your own profile (replaces the three big buttons). */
function ProfileMenu() {
  const nav = useNavigate()
  const t = useT()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (!(e.target as Element).closest?.('.pmenu')) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])
  const go = (to: string) => { setOpen(false); nav(to) }
  return (
    <div className="pmenu">
      <button type="button" className="pmenu-btn" aria-label={tx("Profile menu")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="profile-menu-btn">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor" /><circle cx="12" cy="12" r="2" fill="currentColor" /><circle cx="19" cy="12" r="2" fill="currentColor" /></svg>
      </button>
      {open ? (
        <div className="pmenu-list" role="menu" data-testid="profile-menu">
          <button type="button" role="menuitem" onClick={() => go('/profile/edit')} data-testid="edit-profile"><span aria-hidden="true">✏️</span>{t('profile.edit')}</button>
          <button type="button" role="menuitem" onClick={() => go('/profile/customize')} data-testid="customize-profile"><span aria-hidden="true">🎨</span>{tx("Customize profile")}</button>
          <button type="button" role="menuitem" onClick={() => go('/friends')} data-testid="open-friends"><span aria-hidden="true">👥</span>{tx("Friends & QR")}</button>
        </div>
      ) : null}
    </div>
  )
}

export function MyProfilePage() {
  const { profile } = useAuth()
  const { theme, toggle } = usePrefs()
  const nav = useNavigate()
  const t = useT()
  const { locale } = useLocale()
  if (!profile) return <div className="spinner" />
  return (
    <div className="screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>{t('profile.title')}</h2>
        <button type="button" className="icon-btn lang-btn" onClick={() => nav('/settings#language')} aria-label={t('profile.language')} title={t('profile.language')} data-testid="lang-toggle">
          {locale.toUpperCase()}
        </button>
        <button type="button" className="icon-btn" onClick={toggle} aria-label={t('profile.theme')} data-testid="theme-toggle">
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <button type="button" className="icon-btn" onClick={() => nav('/settings')} aria-label={tx("Settings")} data-testid="open-settings">
          <IconGear />
        </button>
      </div>
      <ProfileBody person={profile} mine />
    </div>
  )
}

export function UserProfilePage() {
  const { username } = useParams()
  const { profile } = useAuth()
  const nav = useNavigate()
  const t = useT()
  const [person, setPerson] = useState<UserProfile | null>(null)
  const [missing, setMissing] = useState(false)
  const presence = usePresenceMap(person ? [person.uid] : [])

  useEffect(() => {
    if (!username) return
    void loadUserByUsername(username).then((u) => {
      if (!u) setMissing(true)
      else setPerson(u)
    })
  }, [username])

  if (profile && person && profile.uid === person.uid) {
    nav('/profile', { replace: true })
  }
  if (missing) {
    return (
      <div className="screen">
        <div className="topbar">
          <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
          <h2>{t('profile.title')}</h2>
        </div>
        <div className="empty"><h3>{t('profile.notFound')}</h3></div>
      </div>
    )
  }
  if (!person) return <div className="spinner" />
  const p = presence[person.uid]
  return (
    <div className="screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>@{person.username}</h2>
      </div>
      <ProfileBody person={person} mine={false} online={p?.state === 'online'} lastActive={p?.lastActive} />
    </div>
  )
}

export function EditProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const t = useT()
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [link, setLink] = useState(profile?.link ?? '')
  const [photoURL, setPhotoURL] = useState(profile?.photoURL ?? '')
  const [busy, setBusy] = useState(false)
  const [light, setLight] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName)
      setBio(profile.bio)
      setLink(profile.link)
      setPhotoURL(profile.photoURL)
    }
  }, [profile])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setBusy(true)
    try {
      const path = `avatars/${user.uid}/${Date.now()}-${file.name}`
      const url = await uploadImage(path, file)
      setPhotoURL(url)
      await updateOwnProfile(user.uid, { photoURL: url })
      await refreshProfile()
      toast(t('profile.photoChanged'))
    } catch (err) {
      toast(err instanceof Error ? err.message : t('profile.uploadFailed'))
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const name = displayName.trim()
    if (!name) { toast(t('profile.enterName')); return }
    setBusy(true)
    try {
      await updateOwnProfile(user.uid, { displayName: name, bio: bio.trim().slice(0, 160), link: link.trim().slice(0, 200), photoURL })
      await refreshProfile()
      toast(t('profile.saved'))
      nav(-1)
    } finally {
      setBusy(false)
    }
  }

  if (!profile) return <div className="spinner" />

  return (
    <div className="screen" data-testid="edit-profile-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>{t('profile.edit')}</h2>
      </div>
      <form className="profile" onSubmit={(e) => void save(e)}>
        <div className="profile-hero">
          <Avatar name={displayName || profile.displayName} photoURL={photoURL} size={112} onClick={() => photoURL && setLight(true)} testId="edit-photo" />
          <label className="btn btn-text" style={{ cursor: 'pointer' }}>
            {t('profile.changePhoto')}
            <input className="hidden-file" type="file" accept="image/*" data-testid="photo-input" onChange={(e) => void onFile(e)} />
          </label>
        </div>
        <div className="field">
          <label>{t('profile.name')}</label>
          <input className="input" data-testid="edit-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </div>
        <div className="field">
          <label>{t('profile.username')}</label>
          <input className="input" value={`@${profile.username}`} disabled />
        </div>
        <div className="field">
          <label>{t('profile.bio')}</label>
          <textarea className="textarea input" data-testid="edit-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} />
        </div>
        <div className="field">
          <label>{t('profile.link')}</label>
          <input className="input" data-testid="edit-link" value={link} onChange={(e) => setLink(e.target.value)} placeholder={tx("https://")} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} data-testid="save-profile">{t('common.save')}</button>
      </form>
      {light && photoURL ? <Lightbox src={photoURL} alt="" onClose={() => setLight(false)} /> : null}
    </div>
  )
}

import { addDoc, collection, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { IconBack } from '../components/Icons'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../components/Toast'
import { db, fsCol } from '../firebase/app'
import { normalizeUsername } from '../lib/ids'
import type { ChatMemberInfo, UserProfile } from '../types'
import { useT } from '../i18n'

export function NewGroupPage() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const t = useT()
  const [title, setTitle] = useState('')
  const [qtext, setQtext] = useState('')
  const [results, setResults] = useState<UserProfile[]>([])
  const [picked, setPicked] = useState<UserProfile[]>([])
  const [busy, setBusy] = useState(false)

  const search = async (e?: FormEvent) => {
    e?.preventDefault()
    const term = normalizeUsername(qtext)
    if (!term) return
    const snap = await getDocs(query(collection(db, ...fsCol('users')), where('username', '>=', term), where('username', '<=', term + '\uf8ff'), limit(20)))
    const list: UserProfile[] = []
    snap.forEach((d) => {
      if (d.id === user?.uid) return
      const data = d.data()
      list.push({
        uid: d.id,
        username: data.username,
        displayName: data.displayName,
        bio: data.bio ?? '',
        link: data.link ?? '',
        photoURL: data.photoURL ?? '',
        createdAt: data.createdAt ?? null,
      })
    })
    setResults(list)
  }

  const toggle = (u: UserProfile) => {
    setPicked((prev) => (prev.some((p) => p.uid === u.uid) ? prev.filter((p) => p.uid !== u.uid) : [...prev, u]))
  }

  const create = async () => {
    if (!user || !profile) return
    if (picked.length < 1) { toast(t('group.pickMembers')); return }
    const name = title.trim() || picked.map((p) => p.displayName).join(', ')
    setBusy(true)
    const memberIds = [user.uid, ...picked.map((p) => p.uid)]
    const memberInfo: Record<string, ChatMemberInfo> = {
      [user.uid]: { displayName: profile.displayName, username: profile.username, photoURL: profile.photoURL },
    }
    for (const p of picked) memberInfo[p.uid] = { displayName: p.displayName, username: p.username, photoURL: p.photoURL }
    const ref = await addDoc(collection(db, ...fsCol('chats')), {
      type: 'group',
      memberIds,
      memberInfo,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      lastMessage: { text: t('group.created'), senderId: user.uid, type: 'system', createdAt: serverTimestamp() },
      lastMessageAt: serverTimestamp(),
      unread: Object.fromEntries(memberIds.map((id) => [id, id === user.uid ? 0 : 1])),
      requestStatus: 'accepted',
      title: name,
    })
    nav(`/chat/${ref.id}`, { replace: true })
  }

  return (
    <div className="screen" data-testid="new-group-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')}><IconBack /></button>
        <h2>{t('group.title')}</h2>
      </div>
      <div className="search-box">
        <div className="field">
          <label>{t('group.name')}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('group.namePlaceholder')} />
        </div>
        <form onSubmit={(e) => void search(e)}>
          <input className="input" value={qtext} onChange={(e) => setQtext(e.target.value)} placeholder={t('group.findMembers')} />
        </form>
      </div>
      {picked.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '0 16px 8px' }}>
          {picked.map((p) => (
            <button type="button" key={p.uid} className="btn btn-ghost" style={{ width: 'auto', padding: '6px 10px', borderRadius: 99 }} onClick={() => toggle(p)}>
              {p.displayName} ×
            </button>
          ))}
        </div>
      ) : null}
      <div className="list">
        {results.map((u) => (
          <button type="button" key={u.uid} className="list-row" onClick={() => toggle(u)}>
            <Avatar name={u.displayName} photoURL={u.photoURL} size={48} />
            <div className="meta">
              <div className="name">{u.displayName} {picked.some((p) => p.uid === u.uid) ? '✓' : ''}</div>
              <div className="preview"><p>@{u.username}</p></div>
            </div>
          </button>
        ))}
      </div>
      <div style={{ padding: '8px 16px calc(16px + var(--safe-bot))' }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void create()} data-testid="create-group">{t('group.create')}</button>
      </div>
    </div>
  )
}

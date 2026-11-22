import { adminConfirm, at } from './adminI18n'
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { db, fsCol } from '../../firebase/app'
import { UserChip, deletePost, ms, useAdmin, when } from './shared'

interface PostRow { id: string; authorId: string; text: string; photos: string[]; createdAt: number; likes: number; comments: number }

export function Posts() {
  const { focus, byUid, toast } = useAdmin()
  const [rows, setRows] = useState<PostRow[] | null>(null)
  const [reported, setReported] = useState<Map<string, number>>(new Map())
  const [q, setQ] = useState('')
  const [author, setAuthor] = useState(focus)
  const [only, setOnly] = useState<'all' | 'photos' | 'reported'>('all')
  const [sel, setSel] = useState('')
  const [n, setN] = useState(0)
  useEffect(() => { if (focus) setAuthor(focus) }, [focus])

  useEffect(() => {
    setRows(null)
    void Promise.all([
      getDocs(query(collection(db, ...fsCol('posts')), orderBy('createdAt', 'desc'), limit(500))),
      getDocs(query(collection(db, ...fsCol('reports')), where('targetType', '==', 'post'), limit(500))),
    ]).then(([p, r]) => {
      setRows(p.docs.map((d) => { const x = d.data(); return { id: d.id, authorId: x.authorId, text: x.text ?? '', photos: x.photoURLs ?? [], createdAt: ms(x.createdAt), likes: x.likeCount ?? 0, comments: x.commentCount ?? 0 } }))
      const m = new Map<string, number>()
      r.docs.forEach((d) => { const id = d.data().targetId; if (d.data().status === 'open' || d.data().status === 'reviewing') m.set(id, (m.get(id) ?? 0) + 1) })
      setReported(m)
    }).catch((e) => { toast(e.message); setRows([]) })
  }, [n, toast])

  const term = q.trim().toLowerCase()
  const list = (rows ?? []).filter((p) => (!author || p.authorId === author) && (!term || p.text.toLowerCase().includes(term) || (byUid.get(p.authorId)?.displayName ?? '').toLowerCase().includes(term))
    && (only === 'all' || (only === 'photos' ? p.photos.length > 0 : reported.has(p.id))))
  const p = list.find((x) => x.id === sel) ?? (rows ?? []).find((x) => x.id === sel)
  const del = async (id: string) => { if (!(await adminConfirm(at("Delete this post and its comments?")))) return; try { await deletePost(id); toast(at("Post deleted")); setSel(''); setN((x) => x + 1) } catch (e) { toast(e instanceof Error ? e.message : at("Failed")) } }

  return (
    <div className="a-split">
      <div className="a-list-col">
        <input className="input" placeholder={at("Search text or author")} value={q} onChange={(e) => setQ(e.target.value)} data-testid="post-search" />
        <div className="a-filters">
          {(['all', 'photos', 'reported'] as const).map((s) => <button key={s} type="button" className={`a-chip ${only === s ? 'on' : ''}`} onClick={() => setOnly(s)}>{s === 'all' ? at("All ({0})", [rows?.length ?? 0]) : s === 'photos' ? at("With photos") : at("Reported ({0})", [reported.size])}</button>)}
          {author ? <button type="button" className="a-chip on" onClick={() => setAuthor('')}>{at("By")}{' '}{byUid.get(author)?.displayName ?? at("user")} ✕</button> : null}
        </div>
        <div className="a-list" data-testid="admin-post-list">
          {rows === null ? <div className="a-loading">{at("Loading…")}</div> : list.length === 0 ? <div className="a-empty-sm">{at("No posts.")}</div> : list.map((x) => (
            <button key={x.id} type="button" className={`a-row post ${sel === x.id ? 'on' : ''}`} onClick={() => setSel(x.id)} data-testid="admin-post-row">
              {x.photos[0] ? <img src={x.photos[0]} alt="" /> : <span className="a-post-txt">Aa</span>}
              <span className="a-row-main"><b>{byUid.get(x.authorId)?.displayName ?? at("Unknown")}</b><small>{x.text.slice(0, 80) || at("[photo]")}</small><small>{when(x.createdAt)} · ♥ {x.likes} · 💬 {x.comments}{reported.has(x.id) ? ` · 🚩 ${reported.get(x.id)}` : ''}</small></span>
            </button>
          ))}
        </div>
      </div>
      <div className="a-detail" data-testid="admin-post-detail">
        {!p ? <div className="a-empty">{at("Select a post to review it.")}</div> : (
          <>
            <header className="a-detail-head"><div><h3>{at("Post")}</h3><small>{when(p.createdAt)} · ♥ {p.likes} · 💬 {p.comments}</small></div></header>
            <div className="a-kv"><span>{at("Author")}</span><UserChip uid={p.authorId} /></div>
            <div className="a-post"><p>{p.text}</p><div className="a-post-photos">{p.photos.map((u, i) => <img key={i} src={u} alt="" />)}</div></div>
            <div className="a-btns">
              <a className="btn btn-ghost" href={`/post/${p.id}`} target="_blank" rel="noreferrer">{at("Open in app ↗")}</a>
              <button type="button" className="btn btn-ghost danger" onClick={() => void del(p.id)} data-testid="admin-del-post">{at("🗑️ Delete post")}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

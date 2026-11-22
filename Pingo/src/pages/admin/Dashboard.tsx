import { at } from './adminI18n'
import { collection, doc, getCountFromServer, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, where, documentId } from 'firebase/firestore'
import { get, ref } from 'firebase/database'
import { useCallback, useEffect, useState } from 'react'
import { db, fsCol, rtdb } from '../../firebase/app'
import { dayKey } from '../../lib/activity'
import { gameInfo } from '../../games/catalog'
import type { GameType } from '../../types'
import { Bars, HBars, useAdmin } from './shared'

const DAYS = 14
function lastDays(n: number) {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i); out.push(dayKey(d)) }
  return out
}
const short = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`

export function Dashboard() {
  const { users, go, toast } = useAdmin()
  const [counts, setCounts] = useState<{ reports: number; flags: number; today: number; online: number; chats: number } | null>(null)
  const [stats, setStats] = useState<Record<string, { messages?: number; games?: Record<string, number> }>>({})
  const [recount, setRecount] = useState('')

  const load = useCallback(async () => {
    const days = lastDays(30)
    const [rep1, rep2, fl, chats, st, pres] = await Promise.all([
      getCountFromServer(query(collection(db, ...fsCol('reports')), where('status', '==', 'open'))),
      getCountFromServer(query(collection(db, ...fsCol('reports')), where('status', '==', 'reviewing'))),
      getCountFromServer(query(collection(db, ...fsCol('flags')), where('status', '==', 'open'))),
      getCountFromServer(collection(db, ...fsCol('chats'))),
      getDocs(query(collection(db, ...fsCol('stats')), where(documentId(), '>=', days[0]), orderBy(documentId()))),
      get(ref(rtdb, 'dmly/presence')).catch(() => null),
    ])
    const sm: typeof stats = {}
    st.docs.forEach((d) => { sm[d.id] = d.data() })
    setStats(sm)
    const online = pres?.exists() ? Object.values(pres.val() as Record<string, { state?: string }>).filter((p) => p?.state === 'online').length : 0
    setCounts({ reports: rep1.data().count + rep2.data().count, flags: fl.data().count, today: sm[dayKey()]?.messages ?? 0, online, chats: chats.data().count })
  }, [])
  useEffect(() => { void load().catch((e) => toast(e instanceof Error ? e.message : at("Could not load the dashboard"))) }, [load, toast])

  /** Rebuilds the last 14 days of message counts by reading every chat (admin only). */
  const doRecount = async () => {
    const days = lastDays(DAYS)
    const since = Timestamp.fromDate(new Date(`${days[0]}T00:00:00`))
    const per: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]))
    const chats = await getDocs(collection(db, ...fsCol('chats')))
    let i = 0
    for (const c of chats.docs) {
      i++
      setRecount(`Reading chat ${i} of ${chats.size}…`)
      const ms = await getDocs(query(collection(db, ...fsCol('chats', c.id, 'messages')), where('createdAt', '>=', since)))
      ms.docs.forEach((m) => { const t = m.data().createdAt?.toDate?.(); if (t) { const k = dayKey(t); if (k in per) per[k]++ } })
    }
    for (const [k, v] of Object.entries(per)) await setDoc(doc(db, ...fsCol('stats', k)), { messages: v, updatedAt: serverTimestamp() }, { merge: true })
    setRecount('')
    toast(at("Recounted messages in {0} chats", [chats.size]))
    await load()
  }

  const days = lastDays(DAYS)
  const signups = days.map((k) => ({ k: short(k), title: k, v: users.filter((u) => u.createdAt && dayKey(new Date(u.createdAt)) === k).length }))
  const msgs = days.map((k) => ({ k: short(k), title: k, v: stats[k]?.messages ?? 0 }))
  const games: Record<string, number> = {}
  Object.values(stats).forEach((s) => Object.entries(s.games ?? {}).forEach(([g, n]) => { games[g] = (games[g] ?? 0) + (Number(n) || 0) }))
  const gameRows = Object.entries(games).sort((a, b) => b[1] - a[1]).map(([g, v]) => { let name = g; try { const gi = gameInfo(g as GameType); name = `${gi.emoji} ${gi.name}` } catch { /* unknown */ } return { k: name, v } })
  const newWeek = users.filter((u) => u.createdAt > Date.now() - 7 * 86400000).length

  return (
    <div className="a-dash" data-testid="admin-dashboard">
      <div className="kpis">
        <button type="button" className="kpi" onClick={() => go('users')} data-testid="kpi-users"><span>👥</span><b>{users.length}</b><small>{at("Users · +{0} this week", [newWeek])}</small></button>
        <div className="kpi" data-testid="kpi-messages"><span>💬</span><b>{counts?.today ?? '…'}</b><small>{at("Messages today")}</small></div>
        <button type="button" className="kpi alert" onClick={() => go('reports')} data-testid="kpi-reports"><span>🚩</span><b>{counts?.reports ?? '…'}</b><small>{at("Open reports")}</small></button>
        <button type="button" className="kpi alert" onClick={() => go('flags')} data-testid="kpi-flags"><span>🤖</span><b>{counts?.flags ?? '…'}</b><small>{at("Auto-flagged")}</small></button>
        <div className="kpi"><span>🟢</span><b>{counts?.online ?? '…'}</b><small>{at("Online now")}</small></div>
        <button type="button" className="kpi" onClick={() => go('chats')}><span>🗂️</span><b>{counts?.chats ?? '…'}</b><small>{at("Conversations")}</small></button>
      </div>
      <div className="a-grid2">
        <section className="a-card"><header><h3>{at("Daily signups")}</h3><small>{at("last")}{' '}{DAYS}{' '}{at("days")}</small></header><Bars data={signups} label={at("Daily signups")} testId="chart-signups" /></section>
        <section className="a-card">
          <header><h3>{at("Daily messages")}</h3><button type="button" className="mini-btn" disabled={!!recount} onClick={() => void doRecount()} data-testid="recount">{recount || at("Recount from chats")}</button></header>
          <Bars data={msgs} label={at("Daily messages")} testId="chart-messages" />
          <p className="a-note">{at("Counted by the app as messages are sent. “Recount” rebuilds the last {0} days by reading every chat.", [DAYS])}</p>
        </section>
        <section className="a-card"><header><h3>{at("Most played games")}</h3><small>{at("last 30 days")}</small></header><HBars data={gameRows} testId="chart-games" /></section>
      </div>
    </div>
  )
}

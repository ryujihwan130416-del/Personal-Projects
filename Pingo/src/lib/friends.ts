import { tx } from '../i18n'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { db, fsCol } from '../firebase/app'
import type { UserProfile } from '../types'

export interface Suggestion { person: UserProfile; reason: string; score: number }

const DISMISS_KEY = 'pingo-sugg-dismissed'
export function dismissed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? '[]') as string[]) } catch { return new Set() }
}
export function dismiss(uid: string) {
  const s = dismissed(); s.add(uid)
  try { localStorage.setItem(DISMISS_KEY, JSON.stringify([...s].slice(-300))) } catch { /* ignore */ }
}

function mapUser(uid: string, d: Record<string, unknown>): UserProfile {
  return { uid, username: String(d.username ?? ''), displayName: String(d.displayName ?? ''), bio: String(d.bio ?? ''), link: String(d.link ?? ''), photoURL: String(d.photoURL ?? ''), createdAt: (d.createdAt as UserProfile['createdAt']) ?? null }
}

/**
 * People you may know: friends of the people you follow, people who follow you,
 * and members of group chats you are in. Everything runs client-side on readable data.
 */
export async function loadSuggestions(me: string, blocked: (uid: string) => boolean): Promise<Suggestion[]> {
  const ids = async (path: string[]) => (await getDocs(collection(db, ...fsCol(...path))).catch(() => null))?.docs.map((d) => d.id) ?? []
  const [following, followers, groups] = await Promise.all([
    ids(['users', me, 'following']),
    ids(['users', me, 'followers']),
    getDocs(query(collection(db, ...fsCol('chats')), where('memberIds', 'array-contains', me))).catch(() => null),
  ])
  const fset = new Set(following)
  const hidden = dismissed()
  const skip = (uid: string) => uid === me || fset.has(uid) || blocked(uid) || hidden.has(uid)
  const mutual = new Map<string, string[]>() // candidate -> via (uids I follow)
  await Promise.all(following.slice(0, 30).map(async (f) => {
    for (const c of await ids(['users', f, 'following'])) if (!skip(c)) mutual.set(c, [...(mutual.get(c) ?? []), f])
  }))
  const inGroups = new Map<string, string[]>() // candidate -> group titles
  for (const g of groups?.docs ?? []) {
    const d = g.data()
    if (d.type !== 'group') continue
    for (const m of (d.memberIds as string[]) ?? []) if (!skip(m)) inGroups.set(m, [...(inGroups.get(m) ?? []), String(d.title || 'a group')])
  }
  const fans = followers.filter((u) => !skip(u))
  const cands = new Set<string>([...mutual.keys(), ...inGroups.keys(), ...fans])
  const names = new Map<string, string>()
  const profiles = new Map<string, UserProfile>()
  await Promise.all([...cands, ...following.slice(0, 30)].map(async (uid) => {
    const s = await getDoc(doc(db, ...fsCol('users', uid))).catch(() => null)
    if (s?.exists()) { const p = mapUser(uid, s.data()); profiles.set(uid, p); names.set(uid, p.displayName) }
  }))
  const out: Suggestion[] = []
  for (const uid of cands) {
    const p = profiles.get(uid)
    if (!p || !p.username) continue
    const via = mutual.get(uid) ?? []
    const gs = inGroups.get(uid) ?? []
    const fan = fans.includes(uid)
    const parts: string[] = []
    if (fan) parts.push(tx('Follows you'))
    if (via.length) parts.push(via.length === 1 ? tx('Followed by {name}', { name: names.get(via[0]) ?? tx('a friend') }) : tx('{n} mutual friends', { n: via.length }))
    if (gs.length) parts.push(gs.length === 1 ? tx('In {group} with you', { group: gs[0] }) : tx('{n} groups in common', { n: gs.length }))
    out.push({ person: p, reason: parts.join(' · '), score: via.length * 2 + gs.length * 2 + (fan ? 3 : 0) })
  }
  out.sort((a, b) => b.score - a.score || a.person.displayName.localeCompare(b.person.displayName))
  if (out.length < 4) {
    const fresh = await getDocs(query(collection(db, ...fsCol('users')), orderBy('createdAt', 'desc'), limit(12))).catch(() => null)
    for (const d of fresh?.docs ?? []) {
      if (skip(d.id) || out.some((x) => x.person.uid === d.id)) continue
      const p = mapUser(d.id, d.data())
      if (p.username) out.push({ person: p, reason: tx('New on Pingo'), score: 0 })
    }
  }
  return out.slice(0, 20)
}

/** Reads the username from a scanned QR value: our /add/<name> or /u/<name> links, or a bare @name. */
export function usernameFromQr(raw: string): string | null {
  const v = raw.trim()
  const m = v.match(/\/(?:add|u)\/([a-z0-9._]{2,30})\/?(?:[?#].*)?$/i) ?? v.match(/^@?([a-z0-9._]{2,30})$/i)
  return m ? m[1].toLowerCase() : null
}

import { countGamePlay } from '../lib/activity'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db, fsCol } from '../firebase/app'
import type { GameMode, GameRoom, GameType, PlayerInfo, UserProfile } from '../types'
import { t } from '../i18n'
import { gameInfo } from './catalog'
import { randomChainStart } from './logic'

const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function randomCode(len = 5): string {
  let s = ''
  for (let i = 0; i < len; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]
  return s
}

export function asRoom(id: string, data: Record<string, unknown>): GameRoom {
  return {
    id,
    code: String(data.code ?? ''),
    type: data.type as GameType,
    mode: data.mode as GameMode,
    status: (data.status as GameRoom['status']) ?? 'lobby',
    hostId: String(data.hostId ?? ''),
    playerIds: (data.playerIds as string[]) ?? [],
    maxPlayers: Number(data.maxPlayers ?? 2),
    players: (data.players as Record<string, PlayerInfo>) ?? {},
    chatId: data.chatId as string | undefined,
    createdAt: (data.createdAt as GameRoom['createdAt']) ?? null,
    updatedAt: (data.updatedAt as GameRoom['updatedAt']) ?? null,
    winnerId: (data.winnerId as string | null) ?? null,
    resultText: data.resultText as string | undefined,
    state: (data.state as Record<string, unknown>) ?? {},
  }
}

export function playerStub(p: Pick<UserProfile, 'displayName' | 'photoURL'>): PlayerInfo {
  return { displayName: p.displayName, photoURL: p.photoURL, ready: false, score: 0 }
}

export async function createRoom(opts: {
  type: GameType
  mode: GameMode
  host: UserProfile
  inviteIds?: { uid: string; displayName: string; photoURL: string }[]
  chatId?: string
}): Promise<{ id: string; code: string }> {
  const info = gameInfo(opts.type)
  const mode = info.modes.includes(opts.mode) ? opts.mode : info.modes[0]
  countGamePlay(opts.type)
  const maxPlayers = mode === 'solo' ? 1 : mode === '1v1' ? 2 : info.max
  const players: Record<string, PlayerInfo> = { [opts.host.uid]: { ...playerStub(opts.host), ready: true } }
  const playerIds = [opts.host.uid]
  for (const inv of opts.inviteIds ?? []) {
    if (playerIds.length >= maxPlayers) break
    if (inv.uid === opts.host.uid) continue
    playerIds.push(inv.uid)
    players[inv.uid] = playerStub(inv)
  }
  const code = randomCode()
  const ref = await addDoc(collection(db, ...fsCol('gameRooms')), {
    code,
    type: opts.type,
    mode,
    status: 'lobby',
    hostId: opts.host.uid,
    playerIds,
    maxPlayers,
    players,
    chatId: opts.chatId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    winnerId: null,
    resultText: null,
    state: initialState(opts.type, mode),
  })
  return { id: ref.id, code }
}

export function initialState(type: GameType, _mode: GameMode): Record<string, unknown> {
  if (type === 'ttt') return { board: Array(9).fill(''), turn: 0, marks: {} }
  if (type === 'c4') return { grid: Array(42).fill(0), turn: 0, marks: {} }
  if (type === 'rps') return { round: 1, maxRounds: 3, choices: {}, revealed: false }
  if (type === 'react') return { round: 1, maxRounds: 3, phase: 'idle', goAt: 0, taps: {} }
  if (type === 'quiz') return { round: 0, maxRounds: 8, phase: 'idle', order: [], answers: {}, startedAt: 0 }
  if (type === 'g2048') return { startedAt: 0, endsAt: 0, boards: {}, done: {} }
  if (type === 'snake') return { startedAt: 0, tick: 0 }
  if (type === 'mines') return { seed: Math.floor(Math.random() * 1e9), startedAt: 0, done: {} }
  if (type === 'catchmind') return { round: 1, maxRounds: 0, drawerIndex: 0, word: '', phase: 'pick', guessed: {} }
  if (type === 'chain') {
    const start = randomChainStart()
    return { current: start, used: [start], turnIndex: 0, lives: {}, scores: {}, deadline: 0, lastMsg: '' }
  }
  return {}
}

export async function joinRoomByCode(code: string, user: UserProfile): Promise<string> {
  const snap = await getDocs(query(collection(db, ...fsCol('gameRooms')), where('code', '==', code.toUpperCase()), limit(5)))
  const docu = snap.docs.find((d) => d.data().status === 'lobby') ?? snap.docs[0]
  if (!docu) throw new Error(t('games.roomNotFound'))
  const data = docu.data()
  if (data.status !== 'lobby') throw new Error(t('games.alreadyStarted'))
  const ids = (data.playerIds as string[]) ?? []
  if (ids.includes(user.uid)) return docu.id
  if (ids.length >= (data.maxPlayers as number)) throw new Error(t('games.roomFull'))
  await updateDoc(doc(db, ...fsCol('gameRooms', docu.id)), {
    playerIds: [...ids, user.uid],
    [`players.${user.uid}`]: playerStub(user),
    updatedAt: serverTimestamp(),
  })
  return docu.id
}

// ---- Local (client-only) rooms: used for solo play, no network, no lobby ----
const localRooms = new Map<string, GameRoom>()
const localSubs = new Map<string, Set<(r: GameRoom | null) => void>>()

export function isLocalRoom(id: string | undefined | null): boolean {
  return !!id && id.startsWith('local-')
}

function emitLocal(id: string) {
  const r = localRooms.get(id) ?? null
  localSubs.get(id)?.forEach((cb) => cb(r))
}

export function createLocalRoom(opts: { type: GameType; host: UserProfile }): string {
  countGamePlay(opts.type)
  const id = `local-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
  localRooms.set(id, {
    id,
    code: '',
    type: opts.type,
    mode: 'solo',
    status: 'playing',
    hostId: opts.host.uid,
    playerIds: [opts.host.uid],
    maxPlayers: 1,
    players: { [opts.host.uid]: { ...playerStub(opts.host), ready: true } },
    createdAt: null,
    updatedAt: null,
    winnerId: null,
    state: { ...initialState(opts.type, 'solo') },
  })
  return id
}

export function subscribeLocalRoom(id: string, cb: (r: GameRoom | null) => void): () => void {
  let set = localSubs.get(id)
  if (!set) { set = new Set(); localSubs.set(id, set) }
  set.add(cb)
  cb(localRooms.get(id) ?? null)
  return () => { set.delete(cb) }
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const nxt = cur[keys[i]]
    cur[keys[i]] = nxt && typeof nxt === 'object' && !Array.isArray(nxt) ? { ...(nxt as Record<string, unknown>) } : {}
    cur = cur[keys[i]] as Record<string, unknown>
  }
  cur[keys[keys.length - 1]] = value
}

function patchLocal(id: string, patch: Record<string, unknown>) {
  const room = localRooms.get(id)
  if (!room) return
  const next = { ...room } as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) setPath(next, k, v)
  localRooms.set(id, next as unknown as GameRoom)
  emitLocal(id)
}

export async function patchRoom(id: string, patch: Record<string, unknown>) {
  if (isLocalRoom(id)) { patchLocal(id, patch); return }
  await updateDoc(doc(db, ...fsCol('gameRooms', id)), { ...patch, updatedAt: serverTimestamp() })
}

export async function recordStats(opts: {
  playerIds: string[]
  winnerId?: string | null
  profiles: Record<string, { displayName: string; username?: string; photoURL: string }>
  type: GameType
}) {
  const draw = !opts.winnerId
  await Promise.all(opts.playerIds.map(async (uid) => {
    const win = opts.winnerId === uid
    const loss = !draw && !win
    const ref = doc(db, ...fsCol('users', uid, 'gameStats', opts.type))
    try {
      await setDoc(ref, {
        wins: increment(win ? 1 : 0),
        losses: increment(loss ? 1 : 0),
        draws: increment(draw ? 1 : 0),
        plays: increment(1),
      }, { merge: true })
    } catch {
      /* ignore */
    }
    const p = opts.profiles[uid]
    const lb = doc(db, ...fsCol('leaderboard', uid))
    try {
      await setDoc(lb, {
        displayName: p?.displayName ?? '',
        username: p?.username ?? '',
        photoURL: p?.photoURL ?? '',
        wins: increment(win ? 1 : 0),
        losses: increment(loss ? 1 : 0),
        draws: increment(draw ? 1 : 0),
        plays: increment(1),
      }, { merge: true })
    } catch {
      /* ignore */
    }
  }))
}

export function finishText(type: GameType, players: Record<string, PlayerInfo>, winnerId?: string | null): string {
  const info = gameInfo(type)
  if (!winnerId) return t('games.drawResult', { game: info.name })
  const name = players[winnerId]?.displayName ?? t('common.someone')
  return t('games.winResult', { game: info.name, name })
}

export async function endGame(room: GameRoom, winnerId: string | null) {
  if (room.status === 'finished') return
  const resultText = finishText(room.type, room.players, winnerId)
  await patchRoom(room.id, { status: 'finished', winnerId, resultText })
  const profiles: Record<string, { displayName: string; photoURL: string }> = {}
  for (const [uid, p] of Object.entries(room.players)) {
    profiles[uid] = { displayName: p.displayName, photoURL: p.photoURL }
  }
  await recordStats({ playerIds: room.playerIds, winnerId, profiles, type: room.type })
  if (room.chatId) {
    try {
      await addDoc(collection(db, ...fsCol('chats', room.chatId, 'messages')), {
        senderId: room.hostId,
        text: resultText,
        type: 'game',
        gameId: room.id,
        gameType: room.type,
        createdAt: serverTimestamp(),
        unsent: false,
        reactions: {},
        readBy: { [room.hostId]: serverTimestamp() },
      })
      const unread: Record<string, unknown> = {
        lastMessage: { text: resultText, senderId: room.hostId, type: 'game', createdAt: serverTimestamp() },
        lastMessageAt: serverTimestamp(),
      }
      for (const id of room.playerIds) {
        if (id !== room.hostId) unread[`unread.${id}`] = increment(1)
      }
      await updateDoc(doc(db, ...fsCol('chats', room.chatId)), unread)
    } catch {
      /* chat post is best-effort */
    }
  }
}

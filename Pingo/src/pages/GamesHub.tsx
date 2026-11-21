import { tx } from '../i18n'
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { burst, confetti, pop, sfx, shake, useMuted } from '../lib/juice'
import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useFluidRef } from '../lib/fluid'
import { IconBack } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { GameBoard, GameTitle } from '../games/Boards'
import { GAMES, gameInfo, modeLabel } from '../games/catalog'
import { asRoom, createLocalRoom, createRoom, initialState, isLocalRoom, joinRoomByCode, patchRoom, subscribeLocalRoom } from '../games/rooms'
import type { GameMode, GameRoom, GameType, LeaderboardRow, UserProfile } from '../types'
import { useT } from '../i18n'

export function GamesHubPage() {
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState<'play' | 'board'>('play')
  const [code, setCode] = useState('')
  const [picked, setPicked] = useState<GameType | null>(null)
  const [mode, setMode] = useState<GameMode>('solo')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [mine, setMine] = useState<GameRoom[]>([])
  const t = useT()

  useEffect(() => {
    if (!user) return
    const qy = query(collection(db, ...fsCol('gameRooms')))
    return onSnapshot(qy, (snap) => {
      const list = snap.docs.map((d) => asRoom(d.id, d.data())).filter((r) => r.playerIds.includes(user.uid) && r.status !== 'finished')
      list.sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0))
      setMine(list)
    })
  }, [user])

  useEffect(() => {
    const qy = query(collection(db, ...fsCol('leaderboard')), orderBy('wins', 'desc'))
    return onSnapshot(qy, (snap) => {
      setRows(snap.docs.map((d) => {
        const x = d.data()
        return { uid: d.id, displayName: x.displayName ?? '', username: x.username ?? '', photoURL: x.photoURL ?? '', wins: x.wins ?? 0, losses: x.losses ?? 0, draws: x.draws ?? 0, plays: x.plays ?? 0 }
      }))
    }, () => setRows([]))
  }, [])

  const start = async () => {
    if (!profile || !picked) return
    sfx('whoosh')
    if (mode === 'solo') {
      // Solo is a pure client-side game: no room, no code, no lobby, no network sync.
      nav(`/games/${createLocalRoom({ type: picked, host: profile })}`)
      return
    }
    try {
      const { id } = await createRoom({ type: picked, mode, host: profile })
      nav(`/games/${id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : t('games.createFailed'))
    }
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || !code.trim()) return
    try {
      const id = await joinRoomByCode(code.trim(), profile)
      nav(`/games/${id}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : t('games.joinFailed'))
    }
  }

  const info = picked ? gameInfo(picked) : null

  return (
    <div className="screen" data-testid="games-screen">
      <div className="topbar">
        <h1>{t('games.title')}</h1>
        <MuteButton />
      </div>
      <div className="tabs">
        <button type="button" className={`tab ${tab === 'play' ? 'active' : ''}`} onClick={() => setTab('play')}>{t('games.lobby')}</button>
        <button type="button" className={`tab ${tab === 'board' ? 'active' : ''}`} data-testid="tab-leaderboard" onClick={() => setTab('board')}>🎈 {t('games.leaderboard')}</button>
      </div>
      {tab === 'play' ? (
        <div className="games-hub">
          <form className="join-row" onSubmit={(e) => void join(e)}>
            <input className="input" data-testid="join-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('games.roomCode')} maxLength={8} />
            <button className="btn btn-sky" type="submit" style={{ width: 'auto' }} data-testid="join-btn">{t('games.enter')}</button>
          </form>
          {mine.length ? (
            <>
              <h3 className="section">{t('games.activeRooms')}</h3>
              {mine.map((r) => (
                <button key={r.id} type="button" className="list-row" onClick={() => nav(`/games/${r.id}`)}>
                  <div className="meta">
                    <div className="name">{gameInfo(r.type).emoji} {gameInfo(r.type).name} · {modeLabel(r.mode)}</div>
                    <div className="preview"><p>{t('games.roomMeta', { code: r.code, n: r.playerIds.length, status: r.status === 'lobby' ? t('games.waiting') : t('games.playing') })}</p></div>
                  </div>
                </button>
              ))}
            </>
          ) : null}
          <h3 className="section">{t('games.pickGame')}</h3>
          <div className="game-grid">
            {GAMES().map((g) => (
              <button
                type="button"
                key={g.id}
                className={`game-tile ${picked === g.id ? 'picked' : ''}`}
                data-testid={`game-tile-${g.id}`}
                onClick={(e) => { setPicked(g.id); setMode(g.modes[0]); sfx('tap'); pop(e.currentTarget) }}
              >
                <span className="emo">{g.emoji}</span>
                <h3>{g.name}</h3>
                <p>{g.blurb}</p>
                <div className="mode-pills">{g.modes.map((m) => <span key={m}>{modeLabel(m)}</span>)}</div>
              </button>
            ))}
          </div>
          {info ? (
            <div className="post-card" style={{ marginTop: 16 }} data-testid="mode-picker">
              <h3 className="section">{info.emoji} {info.name}</h3>
              <p style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>{info.blurb}</p>
              <div className="tabs" style={{ paddingLeft: 0 }}>
                {info.modes.map((m) => (
                  <button key={m} type="button" className={`tab ${mode === m ? 'active' : ''}`} data-testid={`mode-${m}`} onClick={() => setMode(m)}>
                    {modeLabel(m)}
                    {m === 'solo' ? t('games.peopleSolo') : m === '1v1' ? t('games.people1v1') : t('games.peopleMax', { n: info.max })}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" type="button" data-testid="create-room" onClick={() => void start()}>{mode === 'solo' ? t('games.playNow') : t('games.createRoom')}</button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="games-hub fun-stats" data-testid="leaderboard">
          <p className="fun-note">{t('games.funNote')}</p>
          {rows.length === 0 ? <div className="empty"><h3>{t('games.emptyBoardTitle')}</h3><p>{t('games.emptyBoardBody')}</p></div> : null}
          {[...rows].sort((a, b) => b.plays - a.plays).map((r) => (
            <div key={r.uid} className="list-row">
              <Avatar name={r.displayName} photoURL={r.photoURL} size={44} />
              <div className="meta">
                <div className="name">{r.displayName}</div>
                <div className="preview"><p>{t('games.recordLine', { w: r.wins, l: r.losses, d: r.draws, n: r.plays })}</p></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function GameRoomPage() {
  const { roomId } = useParams()
  const { user, profile } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [room, setRoom] = useState<GameRoom | null>(null)
  const t = useT()
  const fluid = useFluidRef<HTMLDivElement>()
  const areaRef = useRef<HTMLDivElement | null>(null)
  const prev = useRef<GameRoom | null>(null)

  // Juice: sounds, bursts and confetti driven by room changes (works for solo and online rooms alike).
  useEffect(() => {
    const p = prev.current
    prev.current = room
    if (!room || !user || !p || p.id !== room.id) return
    if (p.status !== 'playing' && room.status === 'playing') sfx('start')
    if (p.status !== 'finished' && room.status === 'finished') {
      if (room.winnerId === user.uid) { sfx('win'); confetti() }
      else if (!room.winnerId) sfx('draw')
      else { sfx('lose'); window.setTimeout(() => shake(document.querySelector('[data-testid=game-result]')), 60) }
      return
    }
    if (room.status !== 'playing') return
    const mine = room.players[user.uid]?.score ?? 0
    const before = p.players[user.uid]?.score ?? 0
    if (mine > before) { sfx('score'); burst(document.querySelector('.score-chip.me') ?? areaRef.current, { count: 10, spread: 46 }) }
    else if (mine < before) { sfx('bump'); shake(areaRef.current) }
    else if (room.playerIds.some((id) => id !== user.uid && (room.players[id]?.score ?? 0) > (p.players[id]?.score ?? 0))) sfx('tick')
  }, [room, user])

  useEffect(() => {
    if (!roomId) return
    if (isLocalRoom(roomId)) {
      return subscribeLocalRoom(roomId, (r) => {
        if (!r) nav('/games', { replace: true })
        else setRoom(r)
      })
    }
    return onSnapshot(doc(db, ...fsCol('gameRooms', roomId)), (s) => {
      if (!s.exists()) { setRoom(null); return }
      setRoom(asRoom(s.id, s.data()))
    })
  }, [roomId, nav])

  if (!room || !user || !profile) return <div className="screen"><div className="topbar"><div className="skeleton" style={{ width: 140, height: 22 }} /></div><div className="skeleton" style={{ margin: 16, height: 280, borderRadius: 16 }} /></div>
  const inRoom = room.playerIds.includes(user.uid)
  const solo = room.mode === 'solo'

  const ready = async () => {
    await patchRoom(room.id, { [`players.${user.uid}.ready`]: !room.players[user.uid]?.ready })
  }
  const startPlay = async () => {
    const need = room.mode === 'solo' ? 1 : room.mode === '1v1' ? 2 : Math.max(2, gameInfo(room.type).min)
    if (room.playerIds.length < need) { toast(t('games.needPlayers', { n: need })); return }
    await patchRoom(room.id, { status: 'playing', state: { ...initialState(room.type, room.mode), ...(room.state || {}) } })
  }
  const join = async () => {
    if (!profile) return
    try {
      await updateDoc(doc(db, ...fsCol('gameRooms', room.id)), {
        playerIds: [...room.playerIds, user.uid],
        [`players.${user.uid}`]: { displayName: profile.displayName, photoURL: profile.photoURL, ready: false, score: 0 },
      })
    } catch (e) {
      toast(e instanceof Error ? e.message : t('games.joinFailed'))
    }
  }

  const outcome = room.status !== 'finished' ? '' : room.winnerId === user.uid ? 'win' : !room.winnerId ? (solo ? 'solo' : 'draw') : 'lose'
  const again = () => { sfx('whoosh'); nav(`/games/${createLocalRoom({ type: room.type, host: profile })}`, { replace: true }) }

  return (
    <div className="screen" data-testid="game-room-screen" data-status={room.status} data-type={room.type}>
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={t('common.back')} data-testid="game-back"><IconBack /></button>
        <h2><GameTitle room={room} /></h2>
        <MuteButton />
      </div>
      <div className="phase" key={`${room.id}-${room.status === 'lobby' || !inRoom ? 'lobby' : room.status}`}>
      {room.status === 'lobby' || !inRoom ? (
        <div className="lobby">
          <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
            <div className="room-code" data-testid="room-code">{room.code}</div>
            <p style={{ marginTop: 8, fontWeight: 700, color: 'var(--text-secondary)' }}>{t('games.shareCode', { mode: modeLabel(room.mode), n: room.playerIds.length, max: room.maxPlayers })}</p>
          </div>
          {room.playerIds.map((id) => (
            <div key={id} className="list-row">
              <Avatar name={room.players[id]?.displayName ?? ''} photoURL={room.players[id]?.photoURL} size={44} />
              <div className="meta">
                <div className="name">{room.players[id]?.displayName}{id === room.hostId ? ` · ${t('games.host')}` : ''}</div>
                <div className="preview"><p>{room.players[id]?.ready || id === room.hostId ? t('games.ready') : t('games.notReady')}</p></div>
              </div>
            </div>
          ))}
          {!inRoom ? <button className="btn btn-primary" type="button" onClick={() => void join()}>{t('common.join')}</button> : null}
          {inRoom && user.uid !== room.hostId ? (
            <button className="btn btn-ghost" type="button" data-testid="ready-btn" onClick={() => void ready()}>
              {room.players[user.uid]?.ready ? t('games.unready') : t('games.getReady')}
            </button>
          ) : null}
          {inRoom && user.uid === room.hostId ? (
            <button className="btn btn-lime" type="button" data-testid="start-game" onClick={() => void startPlay()}>{t('games.startGame')}</button>
          ) : null}
        </div>
      ) : room.status === 'finished' ? (
        <div className="lobby" data-testid="game-result" data-outcome={outcome}>
          <div className="result-card">
            <span className="big-emo">{outcome === 'win' ? '🎉' : outcome === 'lose' ? '😄' : outcome === 'draw' ? '🤝' : '✨'}</span>
            <h2>{t(`games.result_${outcome || 'solo'}`)}</h2>
            <p>{room.resultText || t('games.gameOver')}</p>
          </div>
          {room.playerIds.map((id) => (
            <div key={id} className="list-row">
              <Avatar name={room.players[id]?.displayName ?? ''} photoURL={room.players[id]?.photoURL} size={44} />
              <div className="meta">
                <div className="name">{room.players[id]?.displayName} {room.winnerId === id ? '🏆' : ''}</div>
                <div className="preview"><p>{t('games.score', { n: room.players[id]?.score ?? 0 })}</p></div>
              </div>
            </div>
          ))}
          <div className="result-actions">
            {solo ? <button className="btn btn-primary" type="button" data-testid="play-again" onClick={again}>{t('games.playAgain')}</button> : null}
            <button className={`btn ${solo ? 'btn-ghost' : 'btn-primary'}`} type="button" onClick={() => nav('/games')}>{t('games.backToLobby')}</button>
          </div>
        </div>
      ) : (
        <div className="game-area" ref={(el) => { fluid(el); areaRef.current = el }} onPointerDown={(e) => { if ((e.target as Element).closest('button')) sfx('tap') }}>
          <GameBoard room={room} uid={user.uid} solo={solo} />
        </div>
      )}
      </div>
    </div>
  )
}

export async function inviteFromChat(opts: {
  type: GameType
  mode: GameMode
  host: UserProfile
  peers: { uid: string; displayName: string; photoURL: string }[]
  chatId: string
}): Promise<string> {
  const { id } = await createRoom({ type: opts.type, mode: opts.mode, host: opts.host, inviteIds: opts.peers, chatId: opts.chatId })
  return id
}

function MuteButton() {
  const [muted, setMuted] = useMuted()
  return (
    <button type="button" className="icon-btn mute-btn" data-testid="mute-btn" aria-pressed={muted} aria-label={muted ? tx('Turn sound on') : tx('Mute sound')} title={muted ? tx('Sound off') : tx('Sound on')} onClick={() => { setMuted(!muted); if (muted) setTimeout(() => sfx('pop'), 0) }}>
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

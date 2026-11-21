import { tx } from '../i18n'
import { onValue, push, ref, remove, set } from 'firebase/database'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { rtdb } from '../firebase/app'
import type { GameRoom } from '../types'
import { PLAYER_COLORS, gameInfo } from './catalog'
import {
  aiChainWord,
  c4Ai,
  catchWords,
  checkChainWord,
  normalizeWord,
  quizBank,
  c4Drop,
  c4Winner,
  mineCount,
  mineLayout,
  rpsWinner,
  shuffle,
  tttAi,
  tttWinner,
} from './logic'
import { endGame, patchRoom } from './rooms'
import { SnakeSolo } from './SnakeSolo'
import { moveTiles, newBoard, spawnTile, tileColor, type Tile } from './tiles2048'
import { burst, nudge, shake, sfx } from '../lib/juice'
import { useT } from '../i18n'

export function GameBoard({ room, uid, solo }: { room: GameRoom; uid: string; solo: boolean }) {
  const t = useT()
  switch (room.type) {
    case 'ttt': return <Ttt room={room} uid={uid} solo={solo} />
    case 'c4': return <C4 room={room} uid={uid} solo={solo} />
    case 'rps': return <Rps room={room} uid={uid} />
    case 'react': return <ReactDuel room={room} uid={uid} />
    case 'quiz': return <Quiz room={room} uid={uid} />
    case 'g2048': return <Race2048 room={room} uid={uid} />
    case 'snake': return solo ? <SnakeSolo /> : <Snake room={room} uid={uid} />
    case 'mines': return <Mines room={room} uid={uid} />
    case 'catchmind': return <CatchMind room={room} uid={uid} />
    case 'chain': return <WordChain room={room} uid={uid} solo={solo} />
    default: return <p>{t('games.comingSoon')}</p>
  }
}

function ScoreRow({ room }: { room: GameRoom }) {
  return (
    <div className="scoreboard">
      {room.playerIds.map((id, i) => (
        <div key={`${id}-${room.players[id]?.score ?? 0}`} className={`score-chip ${(room.players[id]?.score ?? 0) > 0 ? 'bump' : ''}`} style={{ boxShadow: `3px 3px 0 ${PLAYER_COLORS[i % PLAYER_COLORS.length]}` }}>
          {room.players[id]?.displayName ?? id.slice(0, 4)} · {room.players[id]?.score ?? 0}
        </div>
      ))}
    </div>
  )
}

function Ttt({ room, uid, solo }: { room: GameRoom; uid: string; solo: boolean }) {
  const t = useT()
  const board = (room.state.board as string[]) ?? Array(9).fill('')
  const marks = (room.state.marks as Record<string, string>) ?? {}
  const turn = Number(room.state.turn ?? 0)
  const myMark = marks[uid] || (Object.keys(marks).length === 0 ? 'X' : 'O')
  const opp = solo ? 'O' : marks[room.playerIds.find((id) => id !== uid) ?? '']
  const currentMark = turn % 2 === 0 ? 'X' : 'O'
  const mineTurn = room.status === 'playing' && currentMark === myMark
  const result = tttWinner(board)

  useEffect(() => {
    if (room.status !== 'playing') return
    if (!marks[uid]) {
      const next = { ...marks, [uid]: room.playerIds[0] === uid ? 'X' : 'O' }
      if (solo) next.ai = 'O'
      void patchRoom(room.id, { 'state.marks': next })
    }
  }, [room.id, room.status, marks, uid, solo, room.playerIds])

  useEffect(() => {
    if (room.status !== 'playing' || !solo || currentMark !== 'O' || result) return
    const tid = window.setTimeout(() => {
      const i = tttAi(board)
      const next = board.slice()
      next[i] = 'O'
      const w = tttWinner(next)
      if (w === 'O') void endGame(room, null).then(() => patchRoom(room.id, { winnerId: 'ai', resultText: t('board.aiTttWin'), status: 'finished' }))
      else if (w === 'draw') void endGame(room, null)
      else void patchRoom(room.id, { 'state.board': next, 'state.turn': turn + 1 })
    }, 350)
    return () => window.clearTimeout(tid)
  }, [board, currentMark, result, room, solo, turn])

  const play = (i: number) => {
    if (!mineTurn || board[i] || result) return
    const next = board.slice()
    next[i] = myMark
    const w = tttWinner(next)
    if (w === myMark) void endGame(room, uid)
    else if (w === 'draw') void endGame(room, null)
    else void patchRoom(room.id, { 'state.board': next, 'state.turn': turn + 1 })
  }

  useEffect(() => {
    if (room.status !== 'playing' || !result || solo) return
    // online result handled in play()
  }, [result, room.status, solo])

  return (
    <div className="board-wrap ttt-wrap" data-testid="board-ttt">
      <p style={{ fontWeight: 800 }}>{result ? (result === 'draw' ? t('board.draw') : t('board.winsMark', { mark: result })) : mineTurn ? t('board.yourTurn') : t('board.theirTurn')}</p>
      <div className="ttt">
        {board.map((c, i) => (
          <button key={i} type="button" data-testid={`ttt-${i}`} onClick={() => play(i)} disabled={!mineTurn || !!c || !!result}>{c ? <span className="mark" key={c}>{c}</span> : null}</button>
        ))}
      </div>
      {opp ? <p style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('board.youAre', { mark: myMark })}{solo ? t('board.vsAi') : ''}</p> : null}
    </div>
  )
}

function C4({ room, uid, solo }: { room: GameRoom; uid: string; solo: boolean }) {
  const t = useT()
  const grid = (room.state.grid as number[]) ?? Array(42).fill(0)
  const turn = Number(room.state.turn ?? 0)
  const me = room.playerIds[0] === uid ? 1 : 2
  const mineTurn = room.status === 'playing' && (solo ? turn % 2 === 0 : (turn % 2 === 0 ? 1 : 2) === me)
  const result = c4Winner(grid)
  // Which discs are new since the last render -> they get the eased drop animation.
  const seen = useRef<number[]>(grid)
  const fresh = grid.map((v, i) => v !== 0 && seen.current[i] === 0)
  useEffect(() => { seen.current = grid }, [grid])

  useEffect(() => {
    if (!solo || room.status !== 'playing' || turn % 2 === 0 || result) return
    const tid = window.setTimeout(() => {
      const col = c4Ai(grid)
      const next = c4Drop(grid, col, 2)
      if (!next) return
      const w = c4Winner(next)
      if (w === 2) void patchRoom(room.id, { status: 'finished', winnerId: 'ai', resultText: t('board.aiC4Win'), 'state.grid': next })
      else if (w === 'draw') void endGame(room, null)
      else void patchRoom(room.id, { 'state.grid': next, 'state.turn': turn + 1 })
    }, 350)
    return () => window.clearTimeout(tid)
  }, [solo, room, turn, result, grid])

  const drop = (col: number) => {
    if (!mineTurn || result) return
    const next = c4Drop(grid, col, me as 1 | 2)
    if (!next) return
    const w = c4Winner(next)
    if (w === me) void endGame(room, uid)
    else if (w === 'draw') void endGame(room, null)
    else void patchRoom(room.id, { 'state.grid': next, 'state.turn': turn + 1 })
  }

  return (
    <div className="board-wrap c4-wrap" data-testid="board-c4">
      <p style={{ fontWeight: 800 }}>{result ? (result === 'draw' ? t('board.draw') : t('board.gameOver')) : mineTurn ? t('board.yourTurn') : t('board.theirTurn')}</p>
      <div className="c4">
        {grid.map((c, i) => (
          <button key={`${i}-${c}`} type="button" className={`${c === 1 ? 'p1' : c === 2 ? 'p2' : ''} ${fresh[i] ? 'drop' : ''}`} style={fresh[i] ? { ['--r' as string]: Math.floor(i / 7) + 1 } : undefined} data-testid={`c4-${i}`} onClick={() => drop(i % 7)} />
        ))}
      </div>
    </div>
  )
}

const RPS_OPTS = [
  { id: 'rock', label: '✊' },
  { id: 'paper', label: '✋' },
  { id: 'scissors', label: '✌️' },
] as const

function Rps({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const choices = (room.state.choices as Record<string, string>) ?? {}
  const revealed = Boolean(room.state.revealed)
  const round = Number(room.state.round ?? 1)
  const maxRounds = Number(room.state.maxRounds ?? 3)
  const mine = choices[uid]
  const allIn = room.playerIds.every((id) => choices[id])

  useEffect(() => {
    if (!allIn || revealed || room.status !== 'playing') return
    const scores: Record<string, number> = {}
    for (const id of room.playerIds) scores[id] = room.players[id]?.score ?? 0
    for (let i = 0; i < room.playerIds.length; i++) {
      for (let j = i + 1; j < room.playerIds.length; j++) {
        const a = room.playerIds[i], b = room.playerIds[j]
        const w = rpsWinner(choices[a], choices[b])
        if (w === 1) scores[a] += 1
        if (w === -1) scores[b] += 1
      }
    }
    const patch: Record<string, unknown> = { 'state.revealed': true }
    for (const id of room.playerIds) patch[`players.${id}.score`] = scores[id]
    void patchRoom(room.id, patch)
  }, [allIn, revealed, room, choices])

  const next = () => {
    if (round >= maxRounds) {
      const entries = room.playerIds.map((id) => [id, room.players[id]?.score ?? 0] as const)
      entries.sort((a, b) => b[1] - a[1])
      const top = entries[0]
      const tie = entries.length > 1 && entries[1][1] === top[1]
      void endGame(room, tie ? null : top[0])
    } else {
      void patchRoom(room.id, { 'state.round': round + 1, 'state.choices': {}, 'state.revealed': false })
    }
  }

  return (
    <div className="board-wrap" data-testid="board-rps">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>{t('board.round', { round, max: maxRounds })} {revealed ? t('board.results') : t('board.pickOne')}</p>
      <div className="rps-picks">
        {RPS_OPTS.map((o) => (
          <button
            key={o.id}
            type="button"
            className={mine === o.id ? 'on' : ''}
            data-testid={`rps-${o.id}`}
            disabled={!!mine && !revealed}
            onClick={() => void patchRoom(room.id, { [`state.choices.${uid}`]: o.id })}
          >
            {o.label}
          </button>
        ))}
      </div>
      {revealed ? (
        <>
          <div style={{ fontWeight: 700, textAlign: 'center' }}>
            {room.playerIds.map((id) => (
              <div key={id}>{room.players[id]?.displayName}: {RPS_OPTS.find((o) => o.id === choices[id])?.label ?? '-'}</div>
            ))}
          </div>
          <button className="btn btn-lime" type="button" style={{ width: 'auto' }} data-testid="rps-next" onClick={next}>
            {round >= maxRounds ? t('board.seeResults') : t('board.nextRound')}
          </button>
        </>
      ) : mine ? <p>{t('board.waitingForOthers')}</p> : null}
    </div>
  )
}

function ReactDuel({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const phase = String(room.state.phase ?? 'idle')
  const goAt = Number(room.state.goAt ?? 0)
  const taps = (room.state.taps as Record<string, number>) ?? {}
  const round = Number(room.state.round ?? 1)
  const maxRounds = Number(room.state.maxRounds ?? 3)
  const [now, setNow] = useState(Date.now())
  const isGo = phase === 'wait' && goAt > 0 && now >= goAt
  const showGo = phase === 'go' || isGo

  useEffect(() => {
    // One precise timer for the GO moment instead of re-rendering every 50 ms.
    if (phase !== 'wait' || !goAt) return
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, goAt - Date.now()))
    return () => window.clearTimeout(id)
  }, [phase, goAt])

  useEffect(() => {
    if (phase === 'wait' && isGo) void patchRoom(room.id, { 'state.phase': 'go' })
  }, [phase, isGo, room.id])

  const allIn = room.playerIds.every((id) => taps[id] !== undefined)
  useEffect(() => {
    if (phase !== 'go' || !allIn) return
    const scored = [...room.playerIds].sort((a, b) => (taps[a] ?? 99999) - (taps[b] ?? 99999))
    const winner = scored.find((id) => (taps[id] ?? 0) >= 0)
    const patch: Record<string, unknown> = { 'state.phase': 'result' }
    if (winner) patch[`players.${winner}.score`] = (room.players[winner]?.score ?? 0) + 1
    void patchRoom(room.id, patch)
  }, [phase, allIn, taps, room])

  const startRound = () => {
    const delay = 1200 + Math.floor(Math.random() * 2200)
    void patchRoom(room.id, { 'state.phase': 'wait', 'state.goAt': Date.now() + delay, 'state.taps': {} })
  }

  const tap = () => {
    if (taps[uid] !== undefined) return
    if (phase === 'wait' && !showGo) {
      void patchRoom(room.id, { [`state.taps.${uid}`]: -1 })
      return
    }
    if (!showGo) return
    void patchRoom(room.id, { [`state.taps.${uid}`]: Date.now() - goAt })
  }

  const next = () => {
    if (round >= maxRounds) {
      const entries = room.playerIds.map((id) => [id, room.players[id]?.score ?? 0] as const)
      entries.sort((a, b) => b[1] - a[1])
      const tie = entries.length > 1 && entries[1][1] === entries[0][1]
      void endGame(room, tie || entries[0][1] === 0 ? null : entries[0][0])
    } else {
      void patchRoom(room.id, { 'state.round': round + 1, 'state.phase': 'idle', 'state.taps': {}, 'state.goAt': 0 })
    }
  }

  const cls = showGo ? 'go' : phase === 'wait' ? 'wait' : phase
  return (
    <div className="board-wrap" data-testid="board-react">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>{t('board.round', { round, max: maxRounds })}</p>
      <button
        type="button"
        className={`react-arena ${cls}`}
        data-testid={showGo ? 'react-go' : 'react-tap'}
        onPointerDown={(e) => { e.preventDefault(); if (phase === 'idle' && uid === room.hostId) startRound(); else tap() }}
        onKeyDown={(e) => { if (e.key !== 'Enter' && e.key !== ' ') return; e.preventDefault(); if (phase === 'idle' && uid === room.hostId) startRound(); else tap() }}
      >
        {phase === 'idle' && uid === room.hostId ? t('board.startRound') :
          phase === 'idle' ? t('board.waitForHost') :
          showGo ? t('board.now') :
          phase === 'wait' ? t('board.wait') :
          t('board.roundOver')}
      </button>
      {phase === 'result' ? (
        <>
          <div style={{ fontWeight: 700 }}>
            {room.playerIds.map((id) => {
              const ms = taps[id]
              return <div key={id}>{room.players[id]?.displayName}: {ms === undefined ? '-' : ms < 0 ? t('board.falseStart') : `${ms}ms`}</div>
            })}
          </div>
          <button className="btn btn-lime" type="button" style={{ width: 'auto' }} data-testid="react-next" onClick={next}>
            {round >= maxRounds ? t('board.seeResults') : t('board.nextRound')}
          </button>
        </>
      ) : null}
    </div>
  )
}

function Quiz({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const order = (room.state.order as number[]) ?? []
  const round = Number(room.state.round ?? 0)
  const maxRounds = Math.min(Number(room.state.maxRounds ?? 8), quizBank().length)
  const phase = String(room.state.phase ?? 'idle')
  const answers = (room.state.answers as Record<string, number>) ?? {}
  const q = order.length ? quizBank()[order[round] % quizBank().length] : null

  const start = () => {
    const ord = shuffle(quizBank().map((_, i) => i), Date.now() % 99991)
    void patchRoom(room.id, { 'state.order': ord, 'state.round': 0, 'state.phase': 'ask', 'state.answers': {}, 'state.startedAt': Date.now() })
  }

  useEffect(() => {
    // Solo quiz starts immediately, no "start" button.
    if (room.mode === 'solo' && room.status === 'playing' && phase === 'idle') start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.mode, room.status, phase])

  const allIn = q && room.playerIds.every((id) => answers[id] !== undefined)
  useEffect(() => {
    if (phase !== 'ask' || !allIn) return
    void patchRoom(room.id, { 'state.phase': 'reveal' })
  }, [phase, allIn, room.id])

  const answer = (i: number) => {
    if (!q || answers[uid] !== undefined || phase !== 'ask') return
    const patch: Record<string, unknown> = { [`state.answers.${uid}`]: i }
    if (i === q.i) patch[`players.${uid}.score`] = (room.players[uid]?.score ?? 0) + 1
    void patchRoom(room.id, patch)
  }

  const next = () => {
    if (round + 1 >= maxRounds) {
      const entries = room.playerIds.map((id) => [id, room.players[id]?.score ?? 0] as const)
      entries.sort((a, b) => b[1] - a[1])
      const tie = entries.length > 1 && entries[1][1] === entries[0][1]
      void endGame(room, tie || entries[0][1] === 0 ? null : entries[0][0])
    } else {
      void patchRoom(room.id, { 'state.round': round + 1, 'state.phase': 'ask', 'state.answers': {}, 'state.startedAt': Date.now() })
    }
  }

  return (
    <div className="board-wrap" data-testid="board-quiz">
      <ScoreRow room={room} />
      {phase === 'idle' && uid === room.hostId ? (
        <button className="btn btn-lime" type="button" style={{ width: 'auto' }} data-testid="quiz-start" onClick={start}>{t('board.quizStart')}</button>
      ) : null}
      {q && (phase === 'ask' || phase === 'reveal') ? (
        <>
          <p style={{ fontWeight: 800, textAlign: 'center' }}>{round + 1}/{maxRounds}. {q.q}</p>
          <div className="quiz-opts">
            {q.a.map((opt, i) => {
              let cls = 'btn btn-ghost'
              if (phase === 'reveal') cls = i === q.i ? 'btn btn-lime' : answers[uid] === i ? 'btn btn-danger' : 'btn btn-ghost'
              return (
                <button key={i} className={cls} type="button" data-testid={`quiz-answer-${i}`} disabled={phase !== 'ask' || answers[uid] !== undefined} onClick={() => answer(i)}>
                  {opt}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
      {phase === 'reveal' && (uid === room.hostId || room.playerIds.length === 1) ? (
        <button className="btn btn-primary" type="button" style={{ width: 'auto', marginTop: 8 }} data-testid="quiz-next" onClick={next}>
          {round + 1 >= maxRounds ? t('board.seeResults') : t('board.nextQuestion')}
        </button>
      ) : null}
    </div>
  )
}

function Race2048({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const endsAt = Number(room.state.endsAt ?? 0)
  const [tiles, setTiles] = useState<Tile[]>(() => newBoard())
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(0)
  const done = Boolean((room.state.done as Record<string, boolean> | undefined)?.[uid])

  useEffect(() => {
    if (room.status !== 'playing') return
    if (!endsAt && uid === room.hostId) {
      void patchRoom(room.id, { 'state.startedAt': Date.now(), 'state.endsAt': Date.now() + 60000 })
    }
  }, [endsAt, room, uid])

  useEffect(() => {
    const id = window.setInterval(() => {
      const l = Math.max(0, endsAt - Date.now())
      setLeft(l)
      if (endsAt && l <= 0 && !done) {
        void patchRoom(room.id, { [`state.done.${uid}`]: true, [`players.${uid}.score`]: score })
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [endsAt, done, uid, room.id, score])

  const allDone = endsAt > 0 && Date.now() >= endsAt && room.playerIds.every((id) => (room.state.done as Record<string, boolean> | undefined)?.[id] || id === uid)
  useEffect(() => {
    if (!allDone || room.status !== 'playing') return
    const entries = room.playerIds.map((id) => [id, id === uid ? score : (room.players[id]?.score ?? 0)] as const)
    entries.sort((a, b) => b[1] - a[1])
    const tie = entries.length > 1 && entries[1][1] === entries[0][1]
    void endGame(room, tie ? null : entries[0][0])
  }, [allDone, room, score, uid])

  const move = (dir: 'L' | 'R' | 'U' | 'D') => {
    if (done || (endsAt && Date.now() >= endsAt)) return
    const r = moveTiles(tiles, dir)
    if (!r.moved) { bumpGrid(); return }
    const next = spawnTile(r.tiles)
    setTiles(next)
    if (r.score) {
      const sc = score + r.score
      setScore(sc)
      if (r.score >= 128) { sfx('score'); burst(gridRef.current, { count: 12, spread: 90 }) } else if (r.score >= 32) sfx('score'); else sfx('tick')
      // throttle network writes: at most one in flight; the latest score wins
      pendingScore.current = sc
      if (!writing.current) {
        writing.current = true
        const flush = () => {
          const v = pendingScore.current
          void patchRoom(room.id, { [`players.${uid}.score`]: v }).finally(() => {
            if (pendingScore.current !== v) flush(); else writing.current = false
          })
        }
        flush()
      }
    } else sfx('tap')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, 'L' | 'R' | 'U' | 'D'> = { ArrowLeft: 'L', ArrowRight: 'R', ArrowUp: 'U', ArrowDown: 'D' }
      if (map[e.key]) { e.preventDefault(); move(map[e.key]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const swipe = useRef<[number, number] | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingScore = useRef(0)
  const writing = useRef(false)
  const bumpGrid = () => { if (gridRef.current) nudge(gridRef.current) }

  return (
    <div className="board-wrap side g2048" data-testid="board-2048">
      <div className="board-side">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>{t('board.myScoreTime', { score, sec: Math.ceil(left / 1000) })}</p>
      </div>
      <div className="grid-2048" ref={gridRef} style={{ touchAction: 'none' }} data-testid="grid-2048"
        onPointerDown={(e) => { swipe.current = [e.clientX, e.clientY] }}
        onPointerMove={(e) => {
          // fire as soon as the swipe is clear, not on release: feels instant on phones
          const s0 = swipe.current
          if (!s0) return
          const dx = e.clientX - s0[0]; const dy = e.clientY - s0[1]
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
          swipe.current = null
          move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'))
        }}
        onPointerUp={() => { swipe.current = null }}
        onPointerCancel={() => { swipe.current = null }}>
        {Array.from({ length: 16 }, (_, i) => <div key={`c${i}`} className="cell" />)}
        <div className="tiles-2048">
          {tiles.map((tl) => (
            <div key={tl.id} className={`tile ${tl.isNew ? 'new' : ''} ${tl.merged ? 'merged' : ''} ${tl.gone ? 'gone' : ''}`}
              style={{ ['--x' as string]: tl.x, ['--y' as string]: tl.y }} data-v={tl.gone ? undefined : tl.v}>
              <div className="face" style={{ background: tileColor(tl.v), color: tl.v > 4 ? '#fff' : '#3c3a32', fontSize: tl.v >= 1024 ? '0.62em' : tl.v >= 128 ? '0.8em' : undefined }}>{tl.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="pad-row">
        {(['U', 'L', 'D', 'R'] as const).map((d) => (
          <button key={d} className="btn btn-ghost" type="button" onPointerDown={(e) => { e.preventDefault(); move(d) }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') move(d) }}>{d === 'U' ? '↑' : d === 'D' ? '↓' : d === 'L' ? '←' : '→'}</button>
        ))}
      </div>
    </div>
  )
}

function Mines({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const seed = Number(room.state.seed ?? 1)
  const mines = useMemo(() => mineLayout(seed), [seed])
  const [open, setOpen] = useState<boolean[]>(() => Array(81).fill(false))
  const [flag, setFlag] = useState<boolean[]>(() => Array(81).fill(false))
  const [dead, setDead] = useState(false)
  const [won, setWon] = useState(false)
  const start = Number(room.state.startedAt ?? 0)

  useEffect(() => {
    if (room.status === 'playing' && !start && uid === room.hostId) void patchRoom(room.id, { 'state.startedAt': Date.now() })
  }, [room, start, uid])

  const flood = (src: boolean[], i: number) => {
    const next = src.slice()
    const stack = [i]
    while (stack.length) {
      const cur = stack.pop()!
      if (next[cur] || mines[cur]) continue
      next[cur] = true
      if (mineCount(mines, cur) === 0) {
        const x = cur % 9, y = Math.floor(cur / 9)
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy
          if (xx >= 0 && xx < 9 && yy >= 0 && yy < 9) stack.push(yy * 9 + xx)
        }
      }
    }
    return next
  }

  const click = (i: number) => {
    if (dead || won || flag[i] || open[i]) return
    if (mines[i]) { setDead(true); void patchRoom(room.id, { [`state.done.${uid}`]: 'dead' }); return }
    const next = flood(open, i)
    setOpen(next)
    const safe = next.filter(Boolean).length
    if (safe === 81 - 10) {
      setWon(true)
      const time = Date.now() - (start || Date.now())
      void patchRoom(room.id, { [`state.done.${uid}`]: time, [`players.${uid}.score`]: Math.max(1, 100000 - time) })
    }
  }

  const done = (room.state.done as Record<string, number | string> | undefined) ?? {}
  const finished = room.playerIds.every((id) => done[id] !== undefined || (id === uid && (won || dead)))
  useEffect(() => {
    if (!finished || room.status !== 'playing') return
    const times = room.playerIds
      .map((id) => ({ id, v: id === uid && won ? (Date.now() - start) : done[id] }))
      .filter((x) => typeof x.v === 'number') as { id: string; v: number }[]
    times.sort((a, b) => a.v - b.v)
    void endGame(room, times[0]?.id ?? null)
  }, [finished, room, uid, won, start, done])

  const toggle = (e: React.MouseEvent, i: number) => {
    e.preventDefault()
    if (open[i] || dead || won) return
    const next = flag.slice(); next[i] = !next[i]; setFlag(next)
  }

  return (
    <div className="board-wrap mines" data-testid="board-mines">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>{dead ? t('board.boom') : won ? t('board.cleared') : t('board.minesHint')}</p>
      <div className="mine-grid">
        {open.map((o, i) => (
          <button
            key={i}
            type="button"
            className={o ? 'open' : dead && mines[i] ? 'boom' : ''}
            onClick={() => click(i)}
            onContextMenu={(e) => toggle(e, i)}
          >
            {dead && mines[i] ? '💣' : flag[i] && !o ? '⚑' : o ? (mineCount(mines, i) || '') : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

type SnakeState = { snakes: Record<string, { body: number[][]; dir: number[]; alive: boolean }>; food: number[]; tick: number }

const SNAKE_TICK = 140

function Snake({ room, uid }: { room: GameRoom; uid: string }) {
  const [over, setOver] = useState(false)
  const isHost = uid === room.hostId
  const size = 20
  // Latest room in a ref so the host loop doesn't restart (and reset the board) on every room snapshot.
  const roomRef = useRef(room)
  roomRef.current = room
  // Render state lives in refs: the canvas is drawn from requestAnimationFrame, React never re-renders per tick.
  const cur = useRef<SnakeState | null>(null)
  const prev = useRef<SnakeState | null>(null)
  const arrived = useRef(0)
  const myDir = useRef<number[]>([1, 0])
  const dirs = useRef<Record<string, number[]>>({})

  const accept = useCallback((next: SnakeState) => {
    if (cur.current && next.tick === cur.current.tick) { cur.current = next; return }
    prev.current = cur.current
    cur.current = next
    arrived.current = performance.now()
  }, [])

  useEffect(() => {
    return onValue(ref(rtdb, `dmly/snake/${room.id}`), (snap) => {
      const v = snap.val() as SnakeState | null
      if (!v || !v.snakes) return
      if (!isHost) accept(v)
      else if (!cur.current) accept(v)
    })
  }, [room.id, isHost, accept])

  // Host: one fixed-step loop for the whole match.
  const playing = room.status === 'playing'
  useEffect(() => {
    if (!isHost || !playing) return
    const r0 = roomRef.current
    const start: SnakeState = { snakes: {}, food: [10, 10], tick: 0 }
    r0.playerIds.forEach((id, i) => {
      const y = 2 + i * 3
      start.snakes[id] = { body: [[3, y], [2, y]], dir: [1, 0], alive: true }
    })
    accept(start)
    void set(ref(rtdb, `dmly/snake/${room.id}`), start)
    let ended = false
    const t = window.setInterval(() => {
      const c = cur.current
      if (!c || ended) return
      const rm = roomRef.current
      const next: SnakeState = { snakes: {}, food: c.food.slice(), tick: c.tick + 1 }
      const occupied = new Set<string>()
      for (const [, s] of Object.entries(c.snakes)) s.body.forEach(([x, y]) => occupied.add(`${x},${y}`))
      for (const [id, s] of Object.entries(c.snakes)) {
        if (!s.alive) { next.snakes[id] = s; continue }
        const want = id === uid ? myDir.current : dirs.current[id] ?? s.dir
        const dir = want[0] === -s.dir[0] && want[1] === -s.dir[1] ? s.dir : want
        const head = [s.body[0][0] + dir[0], s.body[0][1] + dir[1]]
        const hitWall = head[0] < 0 || head[0] >= size || head[1] < 0 || head[1] >= size
        const tail = s.body[s.body.length - 1]
        const hitBody = occupied.has(`${head[0]},${head[1]}`) && !(tail[0] === head[0] && tail[1] === head[1])
        if (hitWall || hitBody) { next.snakes[id] = { ...s, dir, alive: false }; continue }
        const grow = head[0] === c.food[0] && head[1] === c.food[1]
        const body = [head, ...s.body.slice(0, grow ? undefined : s.body.length - 1)]
        next.snakes[id] = { body, dir, alive: true }
        if (grow) {
          let f: number[]
          do { f = [Math.floor(Math.random() * size), Math.floor(Math.random() * size)] } while (occupied.has(`${f[0]},${f[1]}`))
          next.food = f
          void patchRoom(rm.id, { [`players.${id}.score`]: body.length })
        }
      }
      accept(next)
      void set(ref(rtdb, `dmly/snake/${rm.id}`), next)
      const alive = Object.entries(next.snakes).filter(([, s]) => s.alive)
      if ((rm.playerIds.length > 1 && alive.length <= 1) || alive.length === 0) {
        ended = true
        void endGame(rm, alive[0]?.[0] ?? null)
      }
    }, SNAKE_TICK)
    return () => window.clearInterval(t)
  }, [isHost, playing, room.id, uid, accept])

  // Host merges everyone's requested direction.
  useEffect(() => {
    if (!isHost) return
    return onValue(ref(rtdb, `dmly/snake/${room.id}/dirs`), (snap) => {
      dirs.current = (snap.val() as Record<string, number[]> | null) ?? {}
    })
  }, [isHost, room.id])

  const lastSent = useRef('')
  const steer = useCallback((d: number[]) => {
    const mine = cur.current?.snakes[uid]
    const base = mine?.dir ?? myDir.current
    if (d[0] === -base[0] && d[1] === -base[1]) return
    myDir.current = d
    const key = d.join(',')
    if (key === lastSent.current) return
    lastSent.current = key
    if (!isHost) void set(ref(rtdb, `dmly/snake/${room.id}/dirs/${uid}`), d)
  }, [uid, isHost, room.id])

  useEffect(() => {
    const map: Record<string, number[]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      const d = map[e.key] ?? map[e.key.toLowerCase()]
      if (d) { e.preventDefault(); steer(d) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [steer])

  // rAF renderer with interpolation between the last two ticks; crisp at any DPR.
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: false })
    if (!canvas || !ctx) return
    const PXS = 560, cell = PXS / size
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const fit = () => {
      const px = Math.max(280, Math.round(canvas.clientWidth * dpr))
      if (canvas.width !== px) { canvas.width = px; canvas.height = px }
      const k = px / PXS
      ctx.setTransform(k, 0, 0, k, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)
    // checkerboard pre-rendered once
    const bg = document.createElement('canvas')
    bg.width = PXS; bg.height = PXS
    const bctx = bg.getContext('2d')!
    bctx.fillStyle = '#0e1a12'; bctx.fillRect(0, 0, PXS, PXS)
    bctx.fillStyle = 'rgba(255,255,255,0.04)'
    for (let x = 0; x < size; x++) for (let y = 0; y < size; y++) if ((x + y) % 2 === 0) bctx.fillRect(x * cell, y * cell, cell, cell)
    let raf = 0
    let wasOver = false
    const frame = (now: number) => {
      ctx.drawImage(bg, 0, 0, PXS, PXS)
      const c = cur.current
      if (c) {
        const p = prev.current
        const k = p ? Math.min(1, (now - arrived.current) / SNAKE_TICK) : 1
        const e = k * (2 - k) // ease-out so motion settles instead of stopping hard
        const pulse = 1 + Math.sin(now / 180) * 0.08
        const fs = (cell - 3) * pulse
        ctx.fillStyle = '#c8f542'
        ctx.fillRect(c.food[0] * cell + (cell - fs) / 2, c.food[1] * cell + (cell - fs) / 2, fs, fs)
        const ids = Object.keys(c.snakes)
        ids.forEach((id, si) => {
          const s = c.snakes[id]
          const ps = p?.snakes?.[id]
          ctx.fillStyle = s.alive ? PLAYER_COLORS[room.playerIds.indexOf(id) >= 0 ? room.playerIds.indexOf(id) % PLAYER_COLORS.length : si] : '#555'
          for (let i = s.body.length - 1; i >= 0; i--) {
            const b = s.body[i]
            const a = s.alive && ps?.body?.[i] ? ps.body[i] : b
            const x = (a[0] + (b[0] - a[0]) * e) * cell
            const y = (a[1] + (b[1] - a[1]) * e) * cell
            ctx.globalAlpha = i === 0 ? 1 : 0.82
            ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1)
          }
          ctx.globalAlpha = 1
        })
        const meDead = c.snakes[uid] && !c.snakes[uid].alive
        if (meDead !== wasOver) { wasOver = !!meDead; setOver(wasOver); if (meDead) { sfx('lose'); shake(canvas) } }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [uid, room.playerIds])

  const swipe = useRef<[number, number] | null>(null)
  return (
    <div className="board-wrap side snake-wrap" data-testid="board-snake" data-over={over ? '1' : '0'}>
      <div className="board-side"><ScoreRow room={room} /></div>
      <canvas className="snake-board" ref={canvasRef} width={560} height={560} style={{ touchAction: 'none' }}
        onPointerDown={(e) => { swipe.current = [e.clientX, e.clientY] }}
        onPointerMove={(e) => {
          const s0 = swipe.current
          if (!s0) return
          const dx = e.clientX - s0[0], dy = e.clientY - s0[1]
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
          swipe.current = [e.clientX, e.clientY]
          steer(Math.abs(dx) > Math.abs(dy) ? [dx > 0 ? 1 : -1, 0] : [0, dy > 0 ? 1 : -1])
        }}
        onPointerUp={() => { swipe.current = null }} onPointerCancel={() => { swipe.current = null }} />
      <div className="pad-row">
        <button className="btn btn-ghost" type="button" aria-label={tx("Up")} onPointerDown={(e) => { e.preventDefault(); steer([0, -1]) }}>↑</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Left")} onPointerDown={(e) => { e.preventDefault(); steer([-1, 0]) }}>←</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Down")} onPointerDown={(e) => { e.preventDefault(); steer([0, 1]) }}>↓</button>
        <button className="btn btn-ghost" type="button" aria-label={tx("Right")} onPointerDown={(e) => { e.preventDefault(); steer([1, 0]) }}>→</button>
      </div>
    </div>
  )
}

function CatchMind({ room, uid }: { room: GameRoom; uid: string }) {
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const word = String(room.state.word ?? '')
  const phase = String(room.state.phase ?? 'pick')
  const drawerIndex = Number(room.state.drawerIndex ?? 0)
  const drawerId = room.playerIds[drawerIndex % room.playerIds.length]
  const amDrawer = drawerId === uid
  const [guess, setGuess] = useState('')

  useEffect(() => {
    const r = ref(rtdb, `dmly/draw/${room.id}/strokes`)
    const ctx = () => canvasRef.current?.getContext('2d')
    const unsub = onValue(r, (snap) => {
      const c = ctx()
      if (!c || !canvasRef.current) return
      c.fillStyle = '#fffdf6'
      c.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      const val = snap.val() as Record<string, { x0: number; y0: number; x1: number; y1: number; color: string }> | null
      if (!val) return
      c.strokeStyle = '#1a1530'
      c.lineWidth = 6
      c.lineCap = 'round'
      Object.values(val).forEach((s) => {
        c.beginPath(); c.moveTo(s.x0, s.y0); c.lineTo(s.x1, s.y1); c.stroke()
      })
    })
    return unsub
  }, [room.id])

  const pickWord = (w: string) => {
    void patchRoom(room.id, { 'state.word': w, 'state.phase': 'draw', 'state.guessed': {} })
    void remove(ref(rtdb, `dmly/draw/${room.id}/strokes`))
  }

  const pos = (e: PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * e.currentTarget.width, ((e.clientY - r.top) / r.height) * e.currentTarget.height]
  }
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!amDrawer || phase !== 'draw') return
    drawing.current = true
    last.current = pos(e)
  }
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const p = pos(e)
    void push(ref(rtdb, `dmly/draw/${room.id}/strokes`), { x0: last.current[0], y0: last.current[1], x1: p[0], y1: p[1], color: '#1a1530' })
    last.current = p
  }

  const submit = () => {
    const g = guess.trim()
    if (!g || amDrawer) return
    if (g === word) {
      void patchRoom(room.id, {
        [`players.${uid}.score`]: (room.players[uid]?.score ?? 0) + 2,
        [`players.${drawerId}.score`]: (room.players[drawerId]?.score ?? 0) + 1,
        'state.phase': 'reveal',
      })
    }
    setGuess('')
  }

  const next = () => {
    const nextIdx = drawerIndex + 1
    if (nextIdx >= room.playerIds.length * 2) {
      const entries = room.playerIds.map((id) => [id, room.players[id]?.score ?? 0] as const)
      entries.sort((a, b) => b[1] - a[1])
      const tie = entries.length > 1 && entries[1][1] === entries[0][1]
      void endGame(room, tie ? null : entries[0][0])
    } else {
      void patchRoom(room.id, { 'state.drawerIndex': nextIdx, 'state.phase': 'pick', 'state.word': '' })
      void remove(ref(rtdb, `dmly/draw/${room.id}/strokes`))
    }
  }

  const choices = useMemo(() => shuffle(catchWords(), drawerIndex + 11).slice(0, 3), [drawerIndex])

  return (
    <div className="board-wrap" data-testid="board-catchmind">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>
        {phase === 'pick' && amDrawer ? t('board.pickWord') :
          phase === 'pick' ? t('board.pickingWord', { name: room.players[drawerId]?.displayName ?? '' }) :
          phase === 'draw' && amDrawer ? t('board.drawingWord', { word }) :
          phase === 'draw' ? t('board.guessDrawing', { name: room.players[drawerId]?.displayName ?? '' }) :
          t('board.theWordWas', { word })}
      </p>
      {phase === 'pick' && amDrawer ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {choices.map((w) => <button key={w} className="btn btn-lime" type="button" style={{ width: 'auto' }} onClick={() => pickWord(w)}>{w}</button>)}
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        className="catch-canvas"
        width={640}
        height={480}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false }}
        onPointerLeave={() => { drawing.current = false }}
      />
      {phase === 'draw' && !amDrawer ? (
        <form onSubmit={(e) => { e.preventDefault(); submit() }} className="catch-guess">
          <input className="input" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={t('board.guessPlaceholder')} data-testid="catch-guess" />
          <button className="btn btn-primary" type="submit" style={{ width: 'auto' }}>{t('common.submit')}</button>
        </form>
      ) : null}
      {phase === 'reveal' && uid === room.hostId ? (
        <button className="btn btn-lime" type="button" style={{ width: 'auto' }} onClick={next}>{t('common.next')}</button>
      ) : null}
    </div>
  )
}

export function GameTitle({ room }: { room: GameRoom }) {
  const info = gameInfo(room.type)
  return <span>{info.emoji} {info.name}</span>
}

const CHAIN_TURN_MS = 20000

function WordChain({ room, uid, solo }: { room: GameRoom; uid: string; solo: boolean }) {
  const t = useT()
  const [guess, setGuess] = useState('')
  const current = String(room.state.current ?? '')
  const used = (room.state.used as string[]) ?? (current ? [current] : [])
  const turnIndex = Number(room.state.turnIndex ?? 0)
  const lives = (room.state.lives as Record<string, number>) ?? {}
  const lastMsg = String(room.state.lastMsg ?? '')
  const deadline = Number(room.state.deadline ?? 0)
  const aiLives = Number(room.state.aiLives ?? 3)
  const [left, setLeft] = useState(0)
  const handledDeadline = useRef(0)

  const ids = room.playerIds
  const alive = ids.filter((id) => (lives[id] ?? 3) > 0)
  const turnId = solo || !alive.length ? uid : alive[turnIndex % Math.max(alive.length, 1)]
  const myTurn = room.status === 'playing' && (solo || turnId === uid)
  const letter = current.slice(-1).toLowerCase()

  useEffect(() => {
    if (room.status !== 'playing' || uid !== room.hostId) return
    if (Object.keys(lives).length) return
    const init: Record<string, number> = {}
    for (const id of ids) init[id] = 3
    void patchRoom(room.id, {
      'state.lives': init,
      'state.aiLives': 3,
      'state.deadline': Date.now() + CHAIN_TURN_MS,
      'state.turnIndex': 0,
    })
  }, [room.status, room.hostId, room.id, uid, lives, ids])

  const finishIfNeeded = (nextLives: Record<string, number>, nextAi: number) => {
    if (solo) {
      if (nextAi <= 0) { void endGame(room, uid); return true }
      if ((nextLives[uid] ?? 0) <= 0) { void endGame(room, null); return true }
      return false
    }
    const still = ids.filter((id) => (nextLives[id] ?? 0) > 0)
    if (still.length <= 1) {
      void endGame(room, still[0] ?? null)
      return true
    }
    return false
  }

  const nextTurnIndex = (fromId: string, nextLives: Record<string, number>) => {
    const still = ids.filter((id) => (nextLives[id] ?? 0) > 0)
    if (!still.length) return 0
    const start = ids.indexOf(fromId)
    for (let i = 1; i <= ids.length; i++) {
      const cand = ids[(start + i) % ids.length]
      if ((nextLives[cand] ?? 0) > 0) return still.indexOf(cand)
    }
    return 0
  }

  const loseLife = (playerId: string, msg: string) => {
    if (!playerId || room.status !== 'playing') return
    const nextLives = { ...lives, [playerId]: Math.max(0, (lives[playerId] ?? 3) - 1) }
    const name = room.players[playerId]?.displayName ?? t('common.someone')
    const out = (nextLives[playerId] ?? 0) <= 0
    if (finishIfNeeded(nextLives, aiLives)) {
      void patchRoom(room.id, { 'state.lives': nextLives, 'state.lastMsg': out ? t('board.chainOut', { name }) : msg, 'state.deadline': 0 })
      return
    }
    void patchRoom(room.id, {
      'state.lives': nextLives,
      'state.lastMsg': out ? t('board.chainOut', { name }) : msg,
      'state.turnIndex': nextTurnIndex(playerId, nextLives),
      'state.deadline': Date.now() + CHAIN_TURN_MS,
    })
  }

  useEffect(() => {
    if (room.status !== 'playing' || !deadline) return
    const tick = () => {
      const ms = deadline - Date.now()
      setLeft(Math.max(0, ms))
      if (ms <= 0 && uid === room.hostId && handledDeadline.current !== deadline) {
        handledDeadline.current = deadline
        const who = solo ? uid : turnId
        const name = solo ? t('common.you') : (room.players[who]?.displayName ?? t('common.someone'))
        loseLife(who, t('board.chainTimeout', { name }))
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, room.status, uid, room.hostId, turnId, solo])

  const playHuman = async (raw: string) => {
    if (!myTurn || room.status !== 'playing') return
    const w = normalizeWord(raw)
    const err = checkChainWord(w, current, used)
    if (err) {
      const msg = err === 'short' ? t('board.chainShort')
        : err === 'unknown' ? t('board.chainInvalid')
          : err === 'used' ? t('board.chainUsed')
            : t('board.chainLetter', { letter })
      void patchRoom(room.id, { 'state.lastMsg': msg })
      setGuess('')
      return
    }
    const newUsed = [...used, w]
    const score = (room.players[uid]?.score ?? 0) + w.length
    setGuess('')
    if (solo) {
      const ai = aiChainWord(w, newUsed)
      if (!ai) {
        await patchRoom(room.id, {
          'state.current': w,
          'state.used': newUsed,
          [`players.${uid}.score`]: score,
          'state.lastMsg': t('board.chainPlayed', { name: room.players[uid]?.displayName ?? t('common.you'), word: w }),
          'state.deadline': 0,
        })
        void endGame(room, uid)
        return
      }
      await patchRoom(room.id, {
        'state.current': ai,
        'state.used': [...newUsed, ai],
        [`players.${uid}.score`]: score,
        'state.lastMsg': t('board.chainPlayed', { name: t('board.chainAi'), word: ai }),
        'state.deadline': Date.now() + CHAIN_TURN_MS,
        'state.turnIndex': 0,
      })
      return
    }
    const still = ids.filter((id) => (lives[id] ?? 3) > 0)
    void patchRoom(room.id, {
      'state.current': w,
      'state.used': newUsed,
      [`players.${uid}.score`]: score,
      'state.lastMsg': t('board.chainPlayed', { name: room.players[uid]?.displayName ?? t('common.you'), word: w }),
      'state.turnIndex': nextTurnIndex(uid, Object.fromEntries(still.map((id) => [id, lives[id] ?? 3]))),
      'state.deadline': Date.now() + CHAIN_TURN_MS,
    })
  }

  return (
    <div className="board-wrap" data-testid="board-chain">
      <ScoreRow room={room} />
      <p style={{ fontWeight: 800 }}>{t('board.chainCurrent', { word: current || '—' })}</p>
      <p style={{ fontWeight: 800 }}>{t('board.chainStartsWith', { letter: (letter || '?').toUpperCase() })}</p>
      <p style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{t('board.chainHint', { letter: (letter || '?').toUpperCase() })}</p>
      <p style={{ fontWeight: 800 }}>{Math.ceil(left / 1000)}s</p>
      <div style={{ fontWeight: 700 }}>
        {ids.map((id) => (
          <div key={id} style={{ opacity: (lives[id] ?? 3) <= 0 ? 0.45 : 1 }}>
            {room.players[id]?.displayName}{id === turnId && !solo ? ' ←' : ''} · {t('board.lives', { n: lives[id] ?? 3 })}
          </div>
        ))}
        {solo ? <div>{t('board.chainAi')} · {t('board.lives', { n: aiLives })}</div> : null}
      </div>
      <p style={{ fontWeight: 700, color: 'var(--accent, var(--coral))' }}>{lastMsg}</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
        {myTurn ? t('board.chainYourTurn') : t('board.chainWait', { name: room.players[turnId]?.displayName ?? t('board.chainAi') })}
      </p>
      {myTurn ? (
        <form
          style={{ display: 'flex', gap: 8, marginTop: 8 }}
          onSubmit={(e) => { e.preventDefault(); void playHuman(guess) }}
        >
          <input
            className="input"
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder={t('board.wordPlaceholder')}
            data-testid="chain-input"
            autoCapitalize="none"
            autoCorrect="off"
          />
          <button className="btn btn-primary" type="submit" style={{ width: 'auto' }} data-testid="chain-submit">{t('common.submit')}</button>
        </form>
      ) : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, fontWeight: 700, fontSize: 13 }}>
        {used.slice(-24).map((w, i) => <span key={`${w}-${i}`} className="chip">{w}</span>)}
      </div>
    </div>
  )
}

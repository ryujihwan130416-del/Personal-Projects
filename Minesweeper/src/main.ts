import './styles.css'
import { LEVELS, getLevel, type LevelId } from './levels'
import {
  checkWin,
  countFlags,
  createEmptyBoard,
  placeMines,
  revealAllMines,
  revealCell,
  toggleFlag,
  type CellState,
  type GameStatus,
} from './game'

type TouchMode = 'reveal' | 'flag'

type AppState = {
  view: 'home' | 'game'
  levelId: LevelId | null
  board: CellState[][] | null
  status: GameStatus
  seconds: number
  touchMode: TouchMode
  minesPlaced: boolean
}

const root = document.querySelector<HTMLDivElement>('#app')!
const APK_HREF = './Minesweeper.apk'

let state: AppState = {
  view: 'home',
  levelId: null,
  board: null,
  status: 'ready',
  seconds: 0,
  touchMode: 'reveal',
  minesPlaced: false,
}

let timerId: number | null = null
let longPressTimer: number | null = null
let longPressTriggered = false

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId)
    timerId = null
  }
}

function startTimer() {
  stopTimer()
  timerId = window.setInterval(() => {
    if (state.status !== 'playing') return
    state = { ...state, seconds: state.seconds + 1 }
    updateHudOnly()
  }, 1000)
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function remainingMines(): number {
  if (!state.levelId || !state.board) return 0
  const level = getLevel(state.levelId)
  return Math.max(0, level.mines - countFlags(state.board))
}

function cellSize(cols: number): number {
  const maxWidth = Math.min(window.innerWidth - 32, 920)
  const size = Math.floor((maxWidth - 14) / cols) - 2
  return Math.max(18, Math.min(36, size))
}

function renderHome() {
  root.innerHTML = `
    <main class="screen hero">
      <h1 class="brand">FIELD<span>지뢰찾기</span></h1>
      <p class="hero-copy">지형을 읽고, 지뢰를 피하고, 판을 열어라.</p>
      <p class="hero-sub">레벨을 고르면 바로 시작합니다.</p>
      <div class="level-grid" role="list">
        ${LEVELS.map(
          (level) => `
          <button class="level-btn" type="button" data-level="${level.id}" role="listitem">
            <strong>${level.name}</strong>
            <em>${level.subtitle}</em>
          </button>`,
        ).join('')}
      </div>
      <div class="cta-row">
        <a class="apk-btn" href="${APK_HREF}" download="Minesweeper.apk">
          APK 다운로드
          <small>Android</small>
        </a>
      </div>
      <p class="hint">데스크톱: 좌클릭 열기 · 우클릭 깃발 · 모바일: 길게 눌러 깃발</p>
    </main>
  `

  root.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.level as LevelId
      startGame(id)
    })
  })
}

function startGame(levelId: LevelId) {
  const level = getLevel(levelId)
  stopTimer()
  state = {
    view: 'game',
    levelId,
    board: createEmptyBoard(level.rows, level.cols),
    status: 'ready',
    seconds: 0,
    touchMode: 'reveal',
    minesPlaced: false,
  }
  render()
}

function restartGame() {
  if (!state.levelId) return
  startGame(state.levelId)
}

function goHome() {
  stopTimer()
  state = {
    view: 'home',
    levelId: null,
    board: null,
    status: 'ready',
    seconds: 0,
    touchMode: 'reveal',
    minesPlaced: false,
  }
  render()
}

function onReveal(r: number, c: number) {
  if (!state.board || !state.levelId) return
  if (state.status === 'won' || state.status === 'lost') return

  let board = state.board
  const cell = board[r][c]
  if (cell.flagged || cell.revealed) return

  let minesPlaced = state.minesPlaced
  let status: GameStatus = state.status

  if (!minesPlaced) {
    const level = getLevel(state.levelId)
    board = placeMines(board, level.mines, r, c)
    minesPlaced = true
    status = 'playing'
    startTimer()
  }

  board = revealCell(board, r, c)

  if (board[r][c].mine) {
    board = revealAllMines(board)
    status = 'lost'
    stopTimer()
  } else if (checkWin(board)) {
    status = 'won'
    stopTimer()
  }

  state = { ...state, board, status, minesPlaced }
  renderBoardOnly()
}

function onFlag(r: number, c: number) {
  if (!state.board) return
  if (state.status === 'won' || state.status === 'lost') return
  const cell = state.board[r][c]
  if (cell.revealed) return
  state = { ...state, board: toggleFlag(state.board, r, c) }
  if (state.status === 'ready') {
    state = { ...state, status: 'playing' }
    startTimer()
  }
  renderBoardOnly()
}

function statusText(): string {
  switch (state.status) {
    case 'won':
      return '클리어! 모든 지뢰를 피했습니다.'
    case 'lost':
      return '지뢰를 밟았습니다. 다시 도전해 보세요.'
    case 'playing':
      return ''
    default:
      return '아무 칸이나 열어 시작하세요.'
  }
}

function render() {
  if (state.view === 'home') {
    renderHome()
    return
  }
  if (!state.board || !state.levelId) return

  const level = getLevel(state.levelId)
  const size = cellSize(level.cols)

  root.innerHTML = `
    <main class="game">
      <div class="topbar">
        <button class="back-btn" type="button" data-action="home">← 레벨</button>
        <div class="hud">
          <div class="hud-chip" data-hud="mines"><span>지뢰</span>${String(remainingMines()).padStart(3, '0')}</div>
          <div class="hud-chip" data-hud="time"><span>시간</span>${formatTime(state.seconds)}</div>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <div class="mode-toggle" aria-label="터치 모드">
            <button type="button" data-mode="reveal" class="${state.touchMode === 'reveal' ? 'active' : ''}">열기</button>
            <button type="button" data-mode="flag" class="${state.touchMode === 'flag' ? 'active' : ''}">깃발</button>
          </div>
          <button class="action-btn" type="button" data-action="restart">다시</button>
        </div>
      </div>
      <p class="status-banner ${state.status === 'won' || state.status === 'lost' ? state.status : ''}" data-status>${statusText()}</p>
      <div class="board-wrap">
        <div class="board" style="--cell:${size}px;grid-template-columns:repeat(${level.cols}, var(--cell));" data-board></div>
      </div>
      <p class="footer-note">${level.name} · ${level.subtitle} · <a href="${APK_HREF}" download="Minesweeper.apk" style="color:var(--accent)">APK 받기</a></p>
    </main>
  `

  bindGameChrome()
  paintCells()
}

function bindGameChrome() {
  root.querySelector('[data-action="home"]')?.addEventListener('click', goHome)
  root.querySelector('[data-action="restart"]')?.addEventListener('click', restartGame)
  root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state = { ...state, touchMode: btn.dataset.mode as TouchMode }
      render()
    })
  })
}

function paintCells() {
  const boardEl = root.querySelector<HTMLDivElement>('[data-board]')
  if (!boardEl || !state.board) return
  boardEl.innerHTML = ''

  state.board.forEach((row, r) => {
    row.forEach((cell, c) => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'cell'
      btn.setAttribute('aria-label', `행 ${r + 1} 열 ${c + 1}`)

      if (cell.revealed) {
        btn.classList.add('revealed')
        if (cell.mine) {
          btn.classList.add('mine')
          btn.textContent = '●'
        } else if (cell.adjacent > 0) {
          btn.classList.add(`n${cell.adjacent}`)
          btn.textContent = String(cell.adjacent)
        }
      } else if (cell.flagged) {
        btn.classList.add('flagged')
        btn.textContent = '▲'
      }

      btn.addEventListener('click', (e) => {
        e.preventDefault()
        if (longPressTriggered) {
          longPressTriggered = false
          return
        }
        if (state.touchMode === 'flag') onFlag(r, c)
        else onReveal(r, c)
      })

      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        onFlag(r, c)
      })

      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        longPressTriggered = false
        if (longPressTimer !== null) window.clearTimeout(longPressTimer)
        longPressTimer = window.setTimeout(() => {
          longPressTriggered = true
          onFlag(r, c)
          if (navigator.vibrate) navigator.vibrate(18)
        }, 420)
      })

      const clearLongPress = () => {
        if (longPressTimer !== null) {
          window.clearTimeout(longPressTimer)
          longPressTimer = null
        }
      }

      btn.addEventListener('pointerup', clearLongPress)
      btn.addEventListener('pointerleave', clearLongPress)
      btn.addEventListener('pointercancel', clearLongPress)

      boardEl.appendChild(btn)
    })
  })
}

function updateHudOnly() {
  const mines = root.querySelector('[data-hud="mines"]')
  const time = root.querySelector('[data-hud="time"]')
  if (mines) mines.innerHTML = `<span>지뢰</span>${String(remainingMines()).padStart(3, '0')}`
  if (time) time.innerHTML = `<span>시간</span>${formatTime(state.seconds)}`
}

function renderBoardOnly() {
  const status = root.querySelector('[data-status]')
  if (status) {
    status.textContent = statusText()
    status.className = `status-banner ${state.status === 'won' || state.status === 'lost' ? state.status : ''}`
  }
  updateHudOnly()
  paintCells()
}

window.addEventListener('resize', () => {
  if (state.view === 'game') render()
})

render()

import { t } from '../i18n'
import type { GameMode, GameType } from '../types'

export interface GameInfo {
  id: GameType
  name: string
  blurb: string
  emoji: string
  modes: GameMode[]
  min: number
  max: number
  accent: string
}

const BASE: Omit<GameInfo, 'name' | 'blurb'>[] = [
  { id: 'ttt', emoji: '⭕', modes: ['solo', '1v1'], min: 1, max: 2, accent: '#FF4D3A' },
  { id: 'c4', emoji: '🔴', modes: ['solo', '1v1'], min: 1, max: 2, accent: '#3D9CFF' },
  { id: 'rps', emoji: '✌️', modes: ['1v1', 'party'], min: 2, max: 8, accent: '#7B5CFF' },
  { id: 'react', emoji: '⚡', modes: ['1v1', 'party'], min: 2, max: 8, accent: '#C8F542' },
  { id: 'quiz', emoji: '🧠', modes: ['solo', '1v1', 'party'], min: 1, max: 8, accent: '#FF8A00' },
  { id: 'g2048', emoji: '🧩', modes: ['solo', '1v1', 'party'], min: 1, max: 8, accent: '#F4C430' },
  { id: 'snake', emoji: '🐍', modes: ['solo', 'party'], min: 1, max: 6, accent: '#2BB673' },
  { id: 'mines', emoji: '💣', modes: ['solo', '1v1', 'party'], min: 1, max: 8, accent: '#5B3A29' },
  { id: 'catchmind', emoji: '🎨', modes: ['1v1', 'party'], min: 2, max: 8, accent: '#FF5FA8' },
  { id: 'chain', emoji: '🔗', modes: ['solo', '1v1', 'party'], min: 1, max: 8, accent: '#1A1530' },
]

export function GAMES(): GameInfo[] {
  return BASE.map((g) => ({
    ...g,
    name: t(`game.${g.id}.name`),
    blurb: t(`game.${g.id}.blurb`),
  }))
}

export function gameInfo(id: GameType): GameInfo {
  return GAMES().find((g) => g.id === id) ?? GAMES()[0]
}

export function modeLabel(m: GameMode): string {
  return t(`mode.${m}`)
}

export function defaultMode(g: GameInfo): GameMode {
  return g.modes[0]
}

export const PLAYER_COLORS = ['#FF4D3A', '#3D9CFF', '#C8F542', '#FF8A00', '#7B5CFF', '#FF5FA8', '#2BB673', '#F4C430']

import type { Timestamp } from 'firebase/firestore'

export type ChatType = 'dm' | 'group'
export type RequestStatus = 'pending' | 'accepted' | 'declined'
export type MessageType = 'text' | 'photo' | 'system' | 'game' | 'event' | 'file' | 'voice' | 'sticker'
export type GameType = 'ttt' | 'rps' | 'react' | 'c4' | 'quiz' | 'g2048' | 'snake' | 'mines' | 'catchmind' | 'chain'
export type GameMode = 'solo' | '1v1' | 'party'
export type RoomStatus = 'lobby' | 'playing' | 'finished'
export type CallType = 'audio' | 'video'
export type CallStatus = 'ringing' | 'active' | 'ended'
export type ColorScheme = 'dark' | 'light'

export interface UserProfile {
  uid: string
  username: string
  displayName: string
  bio: string
  link: string
  photoURL: string
  createdAt: Timestamp | null
  prefs?: { theme?: 'light' | 'dark'; accent?: string; notify?: boolean; filter?: unknown; lang?: string }
}

export interface ChatMemberInfo {
  displayName: string
  username: string
  photoURL: string
}

export interface LastMessage {
  text: string
  senderId: string
  type: MessageType
  createdAt: Timestamp | null
}

export interface ChatDoc {
  id: string
  type: ChatType
  memberIds: string[]
  memberInfo: Record<string, ChatMemberInfo>
  createdBy: string
  createdAt: Timestamp | null
  lastMessage: LastMessage | null
  lastMessageAt: Timestamp | null
  unread: Record<string, number>
  requestStatus: RequestStatus
  requestFrom?: string
  themeColor?: string
  title?: string
  blockedUids?: string[]
  /** Disappearing messages timer in seconds (0 = off). */
  disappearAfter?: number
}

export interface ReplyPreview {
  id: string
  text: string
  senderId: string
}

export interface MessageDoc {
  id: string
  senderId: string
  text: string
  type: MessageType
  photoURL?: string
  createdAt: Timestamp | null
  unsent?: boolean
  replyTo?: ReplyPreview
  reactions?: Record<string, string>
  edited?: boolean
  fileURL?: string
  fileName?: string
  fileSize?: number
  fileType?: string
  audioURL?: string
  duration?: number
  readBy?: Record<string, Timestamp | null>
  gameId?: string
  gameType?: GameType
  eventId?: string
  stickerId?: string
  expiresAt?: Timestamp | null
}

export interface Presence {
  state: 'online' | 'offline'
  lastActive: number
}

export interface CallDoc {
  id: string
  chatId: string
  callerId: string
  calleeId: string
  participantIds: string[]
  type: CallType
  status: CallStatus
  offer?: { type: string; sdp: string }
  answer?: { type: string; sdp: string }
  createdAt: Timestamp | null
}

export interface PlayerInfo {
  displayName: string
  photoURL: string
  ready: boolean
  score: number
  alive?: boolean
}

export interface GameRoom {
  id: string
  code: string
  type: GameType
  mode: GameMode
  status: RoomStatus
  hostId: string
  playerIds: string[]
  maxPlayers: number
  players: Record<string, PlayerInfo>
  chatId?: string
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
  winnerId?: string | null
  resultText?: string
  state: Record<string, unknown>
}

export interface PostDoc {
  id: string
  authorId: string
  authorName: string
  authorUsername: string
  authorPhoto: string
  text: string
  photoURLs: string[]
  createdAt: Timestamp | null
  likeCount: number
  commentCount: number
}

export interface CommentDoc {
  id: string
  authorId: string
  authorName: string
  authorPhoto: string
  text: string
  createdAt: Timestamp | null
}

export interface LeaderboardRow {
  uid: string
  displayName: string
  username: string
  photoURL: string
  wins: number
  losses: number
  draws: number
  plays: number
}

export type RsvpStatus = 'going' | 'maybe' | 'no'

export interface EventDoc {
  id: string
  title: string
  note: string
  color: string
  allDay: boolean
  startAt: Timestamp | null
  endAt: Timestamp | null
  ownerId: string
  chatId: string | null
  memberIds: string[]
  category: string
  location: string
  repeat: 'none' | 'daily' | 'weekly' | 'monthly'
  /** minutes before start; -1 = no reminder */
  reminder: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface RsvpDoc {
  uid: string
  status: RsvpStatus
  updatedAt: Timestamp | null
}

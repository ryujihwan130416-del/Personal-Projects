import { isImeEnter } from '../lib/ime'
import { dateLocale, tx } from '../i18n'
import { useEffect, useMemo, useRef, useState, type JSX, type MouseEvent } from 'react'
import { Sticker } from '../lib/stickers'
import { useNavigate } from 'react-router-dom'
import type { MessageDoc } from '../types'
import { formatTime } from '../lib/format'
import { formatBytes } from '../lib/media'
import { useT } from '../i18n'
import { useAuth } from '../contexts/AuthContext'
import { useChatFilter } from '../lib/chatFilter'
import { RsvpBar } from './EventBits'
import { IconCheck, IconChecks, IconFile, IconPause, IconPencil, IconPlay, IconReply, IconSmile, IconTrash, IconFlag } from './Icons'

export const QUICK_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const
export const emojiOf = (v: string) => (v === 'heart' ? '❤️' : v)

export type ReadState = 'pending' | 'sent' | 'read'

function fmtDur(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function VoicePlayer({ src, duration }: { src: string; duration: number }) {
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  useEffect(() => {
    const a = audio.current
    if (!a) return
    const onTime = () => setPos(a.currentTime * 1000)
    const onEnd = () => { setPlaying(false); setPos(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd) }
  }, [])
  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    const a = audio.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { void a.play(); setPlaying(true) }
  }
  const pct = duration ? Math.min(100, (pos / duration) * 100) : 0
  return (
    <div className="voice" data-testid="voice-msg">
      <button type="button" className="voice-btn" onClick={toggle} aria-label={playing ? tx('Pause') : tx('Play')}>{playing ? <IconPause /> : <IconPlay />}</button>
      <div className="voice-track" aria-hidden="true">
        {Array.from({ length: 22 }, (_, i) => <i key={i} style={{ height: `${30 + ((i * 37) % 60)}%`, opacity: (i / 22) * 100 < pct ? 1 : 0.4 }} />)}
      </div>
      <span className="voice-time">{fmtDur(playing || pos ? pos : duration)}</span>
      <audio ref={audio} src={src} preload="metadata" />
    </div>
  )
}

export function MessageBubble({
  msg,
  mine,
  myUid,
  showTime,
  readState,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onReport,
  onOpenPhoto,
  onJump,
  senderName,
  nameOf,
  highlight = '',
}: {
  msg: MessageDoc
  mine: boolean
  myUid: string
  showTime?: boolean
  readState?: ReadState
  onReply: (m: MessageDoc) => void
  onReact: (m: MessageDoc, emoji: string) => void
  onEdit: (m: MessageDoc, text: string) => Promise<void>
  onDelete: (m: MessageDoc) => void
  onReport?: (m: MessageDoc) => void
  onOpenPhoto?: (url: string) => void
  onJump?: (id: string) => void
  /** In-chat search term to <mark> inside the text. */
  highlight?: string
  senderName?: string
  nameOf?: (uid: string) => string
}) {
  const nav = useNavigate()
  const t = useT()
  const { user } = useAuth()
  const lastTap = useRef(0)
  const [pop, setPop] = useState(false)
  const [menu, setMenu] = useState(false)
  const [picker, setPicker] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(msg.text)
  const filter = useChatFilter()
  const [revealed, setRevealed] = useState(false)
  // Senders always see their own words; received text goes through the viewer's chat filter.
  const shown = useMemo(() => (mine || msg.type !== 'text' ? { text: msg.text, hit: [], blur: false } : filter.view(msg.text)), [mine, msg.type, msg.text, filter.view])
  const [confirmDel, setConfirmDel] = useState(false)
  const startX = useRef(0)
  const press = useRef(0)

  // Group reactions: emoji -> uids
  const groups = new Map<string, string[]>()
  for (const [u, v] of Object.entries(msg.reactions ?? {})) {
    const e = emojiOf(v)
    groups.set(e, [...(groups.get(e) ?? []), u])
  }
  const myReaction = msg.reactions?.[myUid] ? emojiOf(msg.reactions[myUid]) : ''
  const canEdit = mine && !msg.unsent && msg.type === 'text'
  const plain = !msg.unsent && (msg.type === 'text' || msg.type === 'photo' || msg.type === 'file' || msg.type === 'voice' || msg.type === 'sticker')

  const react = (e: string) => {
    onReact(msg, e)
    setPicker(false)
    setMenu(false)
    if (e === '❤️' && myReaction !== '❤️') { setPop(true); window.setTimeout(() => setPop(false), 700) }
  }

  const onDouble = () => {
    if (msg.unsent || editing) return
    const now = Date.now()
    if (now - lastTap.current < 280) { react('❤️'); lastTap.current = 0 } else lastTap.current = now
  }

  const saveEdit = async () => {
    const v = draft.trim()
    if (!v || v === msg.text) { setEditing(false); return }
    await onEdit(msg, v)
    setEditing(false)
  }

  const del = () => {
    if (!confirmDel) { setConfirmDel(true); window.setTimeout(() => setConfirmDel(false), 3000); return }
    onDelete(msg)
    setMenu(false)
    setConfirmDel(false)
  }

  return (
    <>
      <div
        id={`msg-${msg.id}`}
        className={`msg-row ${mine ? 'mine' : 'theirs'} ${picker ? 'picking' : ''}`}
        data-testid={mine ? 'msg-mine' : 'msg-theirs'}
        data-msg-id={msg.id}
        onClick={onDouble}
        onContextMenu={(e) => { e.preventDefault(); if (!msg.unsent) setMenu(true) }}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX
          window.clearTimeout(press.current)
          press.current = window.setTimeout(() => { if (!msg.unsent) setMenu(true) }, 480)
        }}
        onTouchMove={() => window.clearTimeout(press.current)}
        onTouchEnd={(e) => {
          window.clearTimeout(press.current)
          const dx = e.changedTouches[0].clientX - startX.current
          if (dx > 72 && !msg.unsent) onReply(msg)
        }}
      >
        <div className="bubble-wrap">
          {!mine && senderName ? <div className="sender-name">{senderName}</div> : null}
          <div className="bubble-line">
            <div className={`bubble ${msg.unsent ? 'unsent' : ''} ${msg.type === 'photo' && !msg.text ? 'media' : ''} ${msg.type === 'sticker' && !msg.unsent ? 'sticker-bubble' : ''} ${editing ? 'editing' : ''}`}>
              {msg.unsent ? (
                <span className="unsent-text">{t('chat.unsent')}</span>
              ) : (
                <>
                  {msg.replyTo ? (
                    <button type="button" className="reply-quote" onClick={(e) => { e.stopPropagation(); onJump?.(msg.replyTo!.id) }}>
                      <b>{nameOf?.(msg.replyTo.senderId) ?? ''}</b>
                      <span>{msg.replyTo.text || t('common.photo')}</span>
                    </button>
                  ) : null}
                  {msg.type === 'photo' && msg.photoURL ? (
                    <img className="photo" src={msg.photoURL} alt="" loading="lazy" onClick={(e) => { e.stopPropagation(); onOpenPhoto?.(msg.photoURL!) }} />
                  ) : null}
                  {msg.type === 'file' && msg.fileURL ? (
                    <a className="file-card" href={msg.fileURL} download={msg.fileName || 'file'} onClick={(e) => e.stopPropagation()} data-testid="file-msg">
                      <span className="file-ico"><IconFile /></span>
                      <span className="file-meta"><b>{msg.fileName || tx('File')}</b><small>{formatBytes(msg.fileSize ?? 0)} · {tx('Download')}</small></span>
                    </a>
                  ) : null}
                  {msg.type === 'sticker' ? <Sticker id={msg.stickerId} size={128} /> : null}
                  {msg.type === 'voice' && msg.audioURL ? <VoicePlayer src={msg.audioURL} duration={msg.duration ?? 0} /> : null}
                  {msg.type === 'game' && msg.gameId ? (
                    <div className="game-card-inner">
                      <div className="g-title">{msg.text}</div>
                      <button type="button" className="btn btn-lime" style={{ width: 'auto', marginTop: 8, padding: '6px 12px' }} data-testid={`open-game-${msg.gameId}`} onClick={(e) => { e.stopPropagation(); nav(`/games/${msg.gameId}`) }}>
                        {t('chat.joinGame')}
                      </button>
                    </div>
                  ) : msg.type === 'event' && msg.eventId ? (
                    <div className="event-card-inner" data-testid={`event-card-${msg.eventId}`}>
                      <div className="g-title">{msg.text}</div>
                      <button type="button" className="btn btn-lime" style={{ width: 'auto', marginTop: 8, padding: '6px 12px' }} data-testid={`open-event-${msg.eventId}`} onClick={(e) => { e.stopPropagation(); nav(`/event/${msg.eventId}`) }}>
                        {t('cal.open')}
                      </button>
                      {user ? <div onClick={(e) => e.stopPropagation()}><RsvpBar eventId={msg.eventId} uid={user.uid} /></div> : null}
                    </div>
                  ) : editing ? (
                    <div className="edit-box" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        className="input"
                        data-testid="edit-input"
                        autoFocus
                        value={draft}
                        maxLength={4000}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !isImeEnter(e)) { e.preventDefault(); void saveEdit() }
                          if (e.key === 'Escape') { setEditing(false); setDraft(msg.text) }
                        }}
                      />
                      <div className="edit-actions">
                        <button type="button" className="mini-btn" onClick={() => { setEditing(false); setDraft(msg.text) }}>{tx("Cancel")}</button>
                        <button type="button" className="mini-btn accent" data-testid="edit-save" onClick={() => void saveEdit()}>{tx("Save")}</button>
                      </div>
                    </div>
                  ) : msg.text && msg.type !== 'game' && msg.type !== 'event' && msg.type !== 'sticker' ? (
                    shown.blur && !revealed
                      ? <button type="button" className="msg-hidden" data-testid="msg-hidden" onClick={(e) => { e.stopPropagation(); setRevealed(true) }}><span className="blurred" aria-hidden="true">{shown.text}</span><b>{t('filter.hiddenTap')}</b></button>
                      : <span className="msg-text" data-filtered={shown.hit.length ? '1' : undefined}>{highlight ? markText(shown.text, highlight) : shown.text}</span>
                  ) : null}
                </>
              )}
              {pop ? <span className="heart-pop">❤️</span> : null}
            </div>
            {plain && !editing ? (
              <div className="msg-tools" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="tool" aria-label={tx("React")} data-testid="react-btn" onClick={() => setPicker((v) => !v)}><IconSmile /></button>
                <button type="button" className="tool" aria-label={t('chat.reply')} data-testid="reply-btn" onClick={() => onReply(msg)}><IconReply /></button>
                {canEdit ? <button type="button" className="tool" aria-label={tx("Edit")} data-testid="edit-btn" onClick={() => { setDraft(msg.text); setEditing(true) }}><IconPencil /></button> : null}
                {!mine && onReport ? <button type="button" className="tool" aria-label={tx("Report")} title={tx("Report")} data-testid="report-msg-btn" onClick={() => onReport(msg)}><IconFlag /></button> : null}
                {mine ? <button type="button" className={`tool ${confirmDel ? 'danger' : ''}`} aria-label={tx("Delete")} data-testid="delete-btn" onClick={del}>{confirmDel ? '?' : <IconTrash />}</button> : null}
                {picker ? (
                  <div className="emoji-pop" data-testid="emoji-picker">
                    {QUICK_EMOJIS.map((e) => <button key={e} type="button" className={myReaction === e ? 'on' : ''} onClick={() => react(e)}>{e}</button>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {groups.size && !msg.unsent ? (
            <div className="rxns" onClick={(e) => e.stopPropagation()}>
              {[...groups.entries()].map(([e, us]) => (
                <button key={e} type="button" className={`rxn ${us.includes(myUid) ? 'on' : ''}`} data-testid="reaction-chip" title={us.map((u) => nameOf?.(u) ?? '').join(', ')} onClick={() => react(e)}>
                  {e}{us.length > 1 ? <b>{us.length}</b> : null}
                </button>
              ))}
            </div>
          ) : null}
          {showTime || (msg.edited && !msg.unsent) || (mine && readState) || (msg.expiresAt && !msg.unsent) ? (
            <div className="msg-meta">
              {msg.expiresAt && !msg.unsent ? <span className="edited" title={`Disappears ${new Date(msg.expiresAt.toMillis()).toLocaleString(dateLocale())}`} data-testid="msg-expiring">⏳</span> : null}
              {msg.edited && !msg.unsent ? <span className="edited">{tx("edited")}</span> : null}
              {showTime && msg.createdAt ? <span>{formatTime(msg.createdAt.toMillis())}</span> : null}
              {mine && readState && !msg.unsent ? (
                <span className={`tick ${readState}`} data-testid={`tick-${readState}`} title={readState === 'read' ? tx('Read') : readState === 'sent' ? tx('Sent') : tx('Sending')}>
                  {readState === 'read' ? <IconChecks /> : <IconCheck />}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {menu ? (
        <div className="backdrop" onClick={() => setMenu(false)}>
          <div className="sheet msg-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="emoji-row">
              {QUICK_EMOJIS.map((e) => <button key={e} type="button" className={myReaction === e ? 'on' : ''} onClick={() => react(e)}>{e}</button>)}
            </div>
            <button type="button" className="sheet-item" onClick={() => { onReply(msg); setMenu(false) }}><IconReply /> {t('chat.reply')}</button>
            {msg.text && msg.type === 'text' ? <button type="button" className="sheet-item" onClick={() => { void navigator.clipboard?.writeText(msg.text); setMenu(false) }}>{tx("Copy text")}</button> : null}
            {canEdit ? <button type="button" className="sheet-item" onClick={() => { setDraft(msg.text); setEditing(true); setMenu(false) }}><IconPencil /> {tx("Edit")}</button> : null}
            {mine ? <button type="button" className="sheet-item danger" onClick={del}><IconTrash /> {confirmDel ? tx('Tap again to delete') : tx('Delete for everyone')}</button> : null}
            {!mine && onReport ? <button type="button" className="sheet-item danger" data-testid="report-msg-item" onClick={() => { onReport(msg); setMenu(false) }}><IconFlag /> {tx("Report message")}</button> : null}
            <button type="button" className="sheet-item" onClick={() => setMenu(false)}>{t('common.close')}</button>
          </div>
        </div>
      ) : null}
    </>
  )
}

/** Wraps every case-insensitive occurrence of `q` in <mark>. */
export function markText(text: string, q: string): (string | JSX.Element)[] {
  const lo = text.toLowerCase(), ql = q.toLowerCase()
  const out: (string | JSX.Element)[] = []
  let i = 0, k = 0
  for (;;) {
    const j = lo.indexOf(ql, i)
    if (j < 0 || !ql) { out.push(text.slice(i)); break }
    out.push(text.slice(i, j), <mark key={k++}>{text.slice(j, j + ql.length)}</mark>)
    i = j + ql.length
  }
  return out
}

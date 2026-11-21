import { useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { IconBack, IconEdit, IconLogo, IconMore, IconPhone, IconSearch, IconSend } from '../components/Icons'
import { MessageBubble } from '../components/MessageBubble'
import { useT } from '../i18n'
import type { MessageDoc } from '../types'
import { LoginPage } from './AuthPages'

/** Fake timestamps so bubbles show times without touching Firestore. */
const ts = (minsAgo: number) => ({ toMillis: () => Date.now() - minsAgo * 60000, toDate: () => new Date(Date.now() - minsAgo * 60000) }) as unknown as MessageDoc['createdAt']
const msg = (id: string, senderId: string, text: string, minsAgo: number, extra: Partial<MessageDoc> = {}): MessageDoc => ({ id, senderId, text, type: 'text', createdAt: ts(minsAgo), ...extra })

const CHATS = [
  { name: 'Mina', last: 'See you at 7 🎉', time: '7:12 PM', unread: 2, online: true },
  { name: 'Weekend hangout', last: 'Jun: who brings snacks?', time: '6:40 PM', unread: 0, online: false },
  { name: 'Soyeon', last: 'That game was so fun', time: 'Tue', unread: 0, online: true },
  { name: 'Haru', last: 'Photo', time: 'Mon', unread: 0, online: false },
]

/**
 * Static showcase of the real app's components and CSS, used by the admin UI editor's live preview iframe.
 * It needs no account or data, so it works for an admin who has no Pingo profile.
 */
export function UiPreviewPage() {
  const t = useT()
  const screen = new URLSearchParams(location.search).get('screen') ?? 'chat'
  const [text, setText] = useState('')
  const msgs = useMemo(() => [
    msg('1', 'them', 'Hey! Are we still on for tonight?', 42),
    msg('2', 'me', 'Yes!! Can’t wait 😄', 40),
    msg('3', 'them', 'Should we play a round of 2048 first?', 12, { reactions: { me: '❤️' } }),
    msg('4', 'me', 'Deal. Loser buys bubble tea 🧋', 10),
    msg('5', 'them', 'See you at 7 🎉', 2),
  ], [])
  if (screen === 'login') return <div className="preview-inert"><LoginPage preview /></div>
  if (screen === 'components') {
    return (
      <div className="shell page-fill" data-testid="ui-preview">
        <div className="shell-body"><main className="main"><div className="screen preview-kit">
          <div className="topbar"><h1>{t('app.name')}</h1></div>
          <div className="preview-grid">
            <section className="set-card"><h3 className="section">Buttons</h3>
              <button type="button" className="btn btn-primary">Primary</button>
              <button type="button" className="btn btn-ghost">Ghost</button>
              <button type="button" className="btn btn-lime">Lime</button>
            </section>
            <section className="set-card"><h3 className="section">Inputs</h3>
              <input className="input" placeholder="Type something…" />
              <textarea className="textarea input" placeholder="Longer text" rows={2} />
            </section>
            <section className="post-card" style={{ padding: 14 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><Avatar name="Soyeon" size={40} /><div><b>Soyeon</b><div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>@soyeon · 2h</div></div></div>
              <p style={{ margin: '10px 0' }}>Anyone up for a study session later? 📚</p>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>♥ 4 · Comments 2</span>
            </section>
            <section className="game-tile" style={{ padding: 16 }}><div style={{ fontSize: 34 }}>🐍</div><b>Snake</b><p style={{ color: 'var(--text-secondary)' }}>Quick solo round</p></section>
          </div>
        </div></main></div>
      </div>
    )
  }
  return (
    <div className="shell detail" data-testid="ui-preview" data-ui-id="appshell.div.shell">
      <nav className="nav-rail" data-ui-id="appshell.nav.nav-rail">
        <div className="brand-mini" data-ui-id="appshell.div.brand-mini"><IconLogo size={30} /><b className="brand-name" data-ui-id="appshell.b.brand-name.name">{t('app.name')}</b></div>
        {['chats', 'feed', 'calendar', 'games', 'profile'].map((id, i) => <a key={id} data-ui-id={`appshell.tab-${id}`} className={i === 0 ? 'active' : ''}><span className="tab-label" data-ui-id="appshell.span.tab-label">{t(`nav.${id}`)}</span></a>)}
      </nav>
      <div className="shell-body" data-ui-id="appshell.div.shell-body-2">
        <aside className="sidebar" data-ui-id="appshell.aside.sidebar">
          <div className="screen" data-ui-id="inbox.inbox-screen">
            <div className="topbar" data-ui-id="inbox.div.topbar">
              <h1 data-ui-id="inbox.h1">{t('app.name')}</h1>
              <span className="icon-btn" data-ui-id="inbox.search-btn"><IconSearch /></span>
              <span className="icon-btn" data-ui-id="inbox.new-group-btn"><IconEdit /></span>
            </div>
            <div className="tabs" data-ui-id="inbox.div.tabs"><span className="tab active" data-ui-id="inbox.tab-inbox">{t('inbox.messages')}</span><span className="tab" data-ui-id="inbox.tab-requests">{t('inbox.requests')}<span className="badge" data-ui-id="inbox.span.badge">1</span></span></div>
            <div className="list" data-ui-id="inbox.div.list">
              {CHATS.map((c, i) => (
                <div key={c.name} data-ui-id="inbox.chat-row-*" className={`list-row ${c.unread ? 'unread' : ''} ${i === 0 ? 'active' : ''}`}>
                  <Avatar name={c.name} size={56} online={c.online} />
                  <div className="meta" data-ui-id="inbox.div.meta-2">
                    <div className="name-row" data-ui-id="inbox.div.name-row"><div className="name" data-ui-id="inbox.div.name">{c.name}</div><div className="time" data-ui-id="inbox.div.time">{c.time}</div></div>
                    <div className="preview" data-ui-id="inbox.div.preview"><p>{c.last}</p>{c.unread ? <span className="unread-pill" data-ui-id="inbox.span.unread-pill-2">{c.unread}</span> : null}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
        <main className="main" data-ui-id="appshell.main.main-2">
          <div className="chat" data-ui-id="chat.chat-screen">
            <div className="topbar chat-top" data-ui-id="chat.div.topbar">
              <span className="icon-btn" data-ui-id="chat.chat-back"><IconBack /></span>
              <div className="chat-peer" data-ui-id="chat.button.chat-peer"><Avatar name="Mina" size={36} online /><div className="who" data-ui-id="chat.div.who"><b>Mina</b><small data-ui-id="chat.presence-label">{t('time.activeMinutes', { n: 5 })}</small></div></div>
              <span className="icon-btn" data-ui-id="chat.audio-call"><IconPhone /></span>
              <span className="icon-btn" data-ui-id="chat.chat-menu"><IconMore /></span>
            </div>
            <div className="messages" data-ui-id="chat.messages">
              <div className="day-div" data-ui-id="chat.div.day-div">Today</div>
              {msgs.map((m, i) => (
                <div key={m.id} className={msgs[i - 1]?.senderId === m.senderId ? 'same' : 'gap'}>
                  <MessageBubble msg={m} mine={m.senderId === 'me'} myUid="me" showTime={msgs[i + 1]?.senderId !== m.senderId} readState={m.senderId === 'me' ? 'read' : undefined} nameOf={(id) => (id === 'me' ? 'You' : 'Mina')} onReply={() => {}} onReact={() => {}} onEdit={async () => {}} onDelete={() => {}} onOpenPhoto={() => {}} onJump={() => {}} />
                </div>
              ))}
              <div className="typing-row" data-ui-id="chat.typing-indicator"><span className="dots"><i /><i /><i /></span>{t('chat.typingOne', { name: 'Mina' })}</div>
            </div>
            <div className="composer" data-ui-id="chat.div.composer">
              <textarea data-ui-id="chat.message-input" className="input" rows={1} placeholder={t('chat.placeholder')} value={text} onChange={(e) => setText(e.target.value)} />
              <button type="button" className="send" aria-label="Send" data-ui-id="chat.send-btn"><IconSend /></button>
            </div>
          </div>
        </main>
      </div>
      <nav className="tabbar" data-ui-id="appshell.nav.tabbar">{['chats', 'feed', 'calendar', 'games', 'profile'].map((id, i) => <a key={id} data-ui-id={`appshell.tab-${id}`} className={i === 0 ? 'active' : ''}><span className="tab-label" data-ui-id="appshell.span.tab-label">{t(`nav.${id}`)}</span></a>)}</nav>
    </div>
  )
}

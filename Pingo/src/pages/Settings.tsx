import { isNative } from '../lib/native'
import { nativeNotifyPermission, nativeTestNotification, requestNativeNotify } from '../lib/eventNotify'
import { tx } from '../i18n'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBack, IconBell, IconMoon, IconSun } from '../components/Icons'
import { useToast } from '../components/Toast'
import { useAuth } from '../contexts/AuthContext'
import { ACCENTS } from '../contexts/ThemeContext'
import { notifyEnabled, usePrefs } from '../lib/prefs'
import { isAdminUid } from '../lib/admin'
import { ChatFilterSettings } from '../components/ChatFilterSettings'
import { AlertSettings, AppPasswordSettings } from '../components/AppAlertsSettings'
import { LanguagePicker } from '../components/LanguagePicker'
import { useT } from '../i18n'

function permission(): NotificationPermission | 'unsupported' {
  if (isNative) return 'default'
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export function SettingsPage() {
  const nav = useNavigate()
  const toast = useToast()
  const { logout, user } = useAuth()
  const { theme, accent, setTheme, setAccent, setNotify } = usePrefs()
  const t = useT()
  const [perm, setPerm] = useState(permission())
  const [notifyOn, setNotifyOn] = useState(notifyEnabled())

  // Android app: native notifications (the WebView has no Notification API).
  useEffect(() => { if (isNative) void nativeNotifyPermission().then(setPerm) }, [])
  const changed = () => window.dispatchEvent(new Event('pingo-notify-pref'))
  const enable = async () => {
    if (perm === 'unsupported') { toast(tx("This browser does not support notifications")); return }
    const p = perm === 'granted' ? 'granted' : isNative ? await requestNativeNotify() : await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') { setNotify(true); setNotifyOn(true); changed(); toast(tx("Event notifications are on")) }
    else toast(isNative ? tx("Notifications are turned off for Pingo in Android settings") : tx("Notifications were blocked in the browser"))
  }
  const disable = () => { setNotify(false); setNotifyOn(false); changed(); toast(tx("Event notifications are off")) }
  const test = () => {
    if (perm !== 'granted') return
    if (isNative) { void nativeTestNotification('Pingo', tx('Notifications work! You will be reminded before events.')).catch(() => toast(tx("Could not show a notification"))); return }
    try { new Notification('Pingo', { body: tx('Notifications work! You will be reminded before events.'), icon: '/favicon.svg' }) } catch { toast(tx("Could not show a notification")) }
  }

  return (
    <div className="screen" data-testid="settings-screen">
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={() => nav(-1)} aria-label={tx("Back")}><IconBack /></button>
        <h2>{tx("Settings")}</h2>
      </div>
      <div className="settings">
        <section className="set-card" id="language" data-testid="set-language">
          <h3>{t('settings.language')}</h3>
          <p className="set-sub">{t('settings.languageSub')}</p>
          <LanguagePicker />
        </section>
        <section className="set-card">
          <h3>{tx("Appearance")}</h3>
          <p className="set-sub">{tx("Saved to your account, so it follows you to every device.")}</p>
          <div className="set-row">
            <span>{tx("Mode")}</span>
            <div className="seg big" role="radiogroup" aria-label={tx("Color mode")}>
              <button type="button" className={theme === 'light' ? 'on' : ''} data-testid="mode-light" onClick={() => setTheme('light')}><IconSun size={16} /> {tx("Light")}</button>
              <button type="button" className={theme === 'dark' ? 'on' : ''} data-testid="mode-dark" onClick={() => setTheme('dark')}><IconMoon size={16} /> {tx("Dark")}</button>
            </div>
          </div>
          <div className="set-row col">
            <span>{tx("Accent color")}</span>
            <div className="accent-grid" role="radiogroup" aria-label={tx("Accent color")}>
              <button type="button" className={`accent-swatch ${accent === 'default' ? 'on' : ''}`} data-testid="accent-default" aria-pressed={accent === 'default'} onClick={() => setAccent('default')}>
                <i style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }} /><span>{tx("App default")}</span>
              </button>
              {ACCENTS.map((a) => (
                <button key={a.id} type="button" className={`accent-swatch ${accent === a.id ? 'on' : ''}`} data-testid={`accent-${a.id}`} aria-pressed={accent === a.id} onClick={() => setAccent(a.id)}>
                  <i style={{ background: `linear-gradient(135deg, ${a.c}, ${a.c2})` }} />
                  <span>{tx(a.name)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="set-preview" aria-hidden="true">
            <div className="bubble-demo in">{tx("Want to grab lunch?")}</div>
            <div className="bubble-demo out">{tx("Yes! 12:30 works 🍜")}</div>
          </div>
        </section>

        <ChatFilterSettings />

        <AlertSettings />

        <section className="set-card">
          <h3><IconBell /> {tx("Event notifications")}</h3>
          <p className="set-sub">{isNative ? tx("Phone notifications arrive at each event's reminder time, even when Pingo is closed or the phone is asleep.") : tx("Browser notifications pop up at each event's reminder time while Pingo is open in a tab. You also get an in-app toast.")}</p>
          <div className="set-row">
            <span>{tx("Status")}</span>
            <b data-testid="notify-status" className={`status-pill ${notifyOn ? 'on' : ''}`}>
              {perm === 'unsupported' ? tx('Not supported') : perm === 'denied' ? (isNative ? tx('Off in Android settings') : tx('Blocked in browser')) : notifyOn ? tx('On') : tx('Off')}
            </b>
          </div>
          <div className="set-actions">
            {notifyOn ? (
              <>
                <button type="button" className="btn btn-ghost" onClick={test} data-testid="notify-test">{tx("Send a test")}</button>
                <button type="button" className="btn btn-ghost" onClick={disable} data-testid="notify-off">{tx("Turn off")}</button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => void enable()} data-testid="notify-on" disabled={perm === 'unsupported'}>{tx("Enable notifications")}</button>
            )}
          </div>
          {perm === 'denied' ? <p className="set-sub">{tx("Notifications are blocked. Allow them from the address bar's site settings, then try again.")}</p> : null}
        </section>

        {isAdminUid(user?.uid) ? (
          <section className="set-card admin-entry">
            <h3>{tx("🛡️ Admin console")}</h3>
            <p className="set-sub">{tx("Reports, auto-flagged messages, users, chats, posts, announcements and the word filter.")}</p>
            <button type="button" className="btn btn-primary" onClick={() => nav('/admin')} data-testid="open-admin">{tx("Open admin console")}</button>
          </section>
        ) : null}

        <AppPasswordSettings />

        <section className="set-card">
          <h3>{tx("Account")}</h3>
          <div className="set-actions">
            <button type="button" className="btn btn-ghost" onClick={() => nav('/profile/edit')} data-testid="set-edit-profile">✏️ {tx("Edit profile")}</button>
            <button type="button" className="btn btn-ghost" onClick={() => nav('/profile/customize')} data-testid="set-customize-profile">🎨 {tx("Customize profile")}</button>
            <button type="button" className="btn btn-ghost" onClick={() => nav('/friends')} data-testid="set-open-friends">👥 {tx("Friends & QR")}</button>
            <button type="button" className="btn btn-ghost danger" data-testid="logout-btn" onClick={() => void logout().then(() => nav('/login'))}>{tx("Log out")}</button>
          </div>
        </section>
      </div>
    </div>
  )
}

import { EmailAuthProvider, linkWithCredential } from 'firebase/auth'
import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { tx } from '../i18n'
import { messageDing, startRingback, startRingtone, stopRingback, stopRingtone, useAlertPrefs } from '../lib/alertSounds'
import { isNative, PingoNative, safe, type NativeStatus } from '../lib/native'
import { useToast } from './Toast'

/** Settings → Sounds & alerts (web + Android app). */
export function AlertSettings() {
  const [p, set] = useAlertPrefs()
  const toast = useToast()
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)
  const preview = (k: 'ring' | 'back') => {
    if (k === 'ring') { startRingtone(); setTimeout(stopRingtone, 3000) } else { startRingback(); setTimeout(stopRingback, 3200) }
  }
  const allowWeb = async () => {
    if (typeof Notification === 'undefined') return
    const r = await Notification.requestPermission(); setPerm(r)
    if (r !== 'granted') toast(tx('Notifications were blocked in the browser'))
  }
  const row = (k: keyof typeof p, label: string, hint: string, id: string) => (
    <div className="set-row">
      <span>{label}<small className="set-hint">{hint}</small></span>
      <input type="checkbox" className="switch" checked={p[k]} onChange={(e) => set({ [k]: e.target.checked })} data-testid={id} />
    </div>
  )
  return (
    <section className="set-card" data-testid="set-alerts">
      <h3>🔔 {tx('Sounds & alerts')}</h3>
      <p className="set-sub">{tx('Ringtone for incoming calls, a ringback tone while you call someone, and a sound + notification for new messages.')}</p>
      {row('ring', tx('Call ringtone'), tx('Rings until you answer or decline'), 'alert-ring')}
      {row('msgSound', tx('Message sound'), tx('A short ding when a message arrives'), 'alert-msg-sound')}
      {row('msgNotify', tx('Message notifications'), tx('When Pingo is in the background or you are in another chat'), 'alert-msg-notify')}
      {row('vibrate', tx('Vibrate'), tx('On phones that support it'), 'alert-vibrate')}
      {isNative ? row('background', tx('Run in background'), tx('Keeps Pingo connected with the screen off (shows a small “Pingo is running” notification)'), 'alert-background') : null}
      <div className="set-actions">
        <button type="button" className="btn btn-ghost" onClick={() => preview('ring')} data-testid="alert-test-ring">▶ {tx('Ringtone')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => preview('back')} data-testid="alert-test-ringback">▶ {tx('Ringback')}</button>
        <button type="button" className="btn btn-ghost" onClick={() => messageDing()} data-testid="alert-test-ding">▶ {tx('Message')}</button>
        {!isNative && perm !== 'granted' && perm !== 'unsupported' ? <button type="button" className="btn btn-primary" onClick={() => void allowWeb()} data-testid="alert-allow-web">{tx('Allow notifications')}</button> : null}
      </div>
      {!isNative && perm === 'denied' ? <p className="set-sub">{tx("Notifications are blocked. Allow them from the address bar's site settings, then try again.")}</p> : null}
      {!isNative ? <p className="set-sub">{tx('In a browser, alerts only arrive while a Pingo tab is open. For background calls and messages on Android, install the app:')} <a href="/download" data-testid="get-android-app">{tx('Get the Android app')}</a></p> : null}
      {isNative ? <AndroidPermissions /> : null}
    </section>
  )
}

function AndroidPermissions() {
  const [s, setS] = useState<NativeStatus | null>(null)
  const refresh = () => void safe(() => PingoNative.status()).then((x) => x && setS(x))
  useEffect(() => { refresh(); const i = window.setInterval(refresh, 2500); return () => clearInterval(i) }, [])
  if (!s) return null
  const item = (ok: boolean, label: string, act: () => Promise<unknown>, id: string) => (
    <div className="set-row">
      <span>{label}</span>
      {ok ? <b className="status-pill on">{tx('On')}</b> : <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={() => void act().finally(refresh)} data-testid={id}>{tx('Allow')}</button>}
    </div>
  )
  return (
    <div className="android-perms" data-testid="android-perms">
      <h4>{tx('Android permissions')}</h4>
      {item(s.notifications, tx('Notifications'), () => PingoNative.requestNotifications(), 'perm-notify')}
      {item(s.batteryExempt, tx('Ignore battery optimization (works while asleep)'), () => PingoNative.requestBatteryExemption(), 'perm-battery')}
      {s.sdk >= 34 ? item(s.fullScreen, tx('Full-screen incoming calls'), () => PingoNative.requestFullScreen(), 'perm-fullscreen') : null}
    </div>
  )
}

/** For Google accounts: add a password so you can sign in to the Android app (Google sign-in is blocked inside apps). */
export function AppPasswordSettings() {
  const { user } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  if (!user?.email || user.providerData.some((p) => p.providerId === 'password')) return null
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 6) { toast(tx('Use at least 6 characters')); return }
    setBusy(true)
    try { await linkWithCredential(user, EmailAuthProvider.credential(user.email!, pw)); setPw(''); toast(tx('Password set — you can now sign in to the app with {email}', { email: user.email! })) }
    catch (err) { toast(err instanceof Error && /requires-recent-login/.test(err.message) ? tx('Please log out and sign in with Google again, then retry') : tx('Could not set the password')) }
    finally { setBusy(false) }
  }
  return (
    <section className="set-card" data-testid="set-app-password">
      <h3>📱 {tx('Password for the Android app')}</h3>
      <p className="set-sub">{tx('Google blocks its sign-in inside apps. Add a password to your account, then sign in to the Pingo app with {email} and this password.', { email: user.email })}</p>
      <form className="set-actions" onSubmit={(e) => void submit(e)}>
        <input className="input" type="password" autoComplete="new-password" placeholder={tx('New password')} value={pw} onChange={(e) => setPw(e.target.value)} data-testid="app-password" style={{ flex: 1, minWidth: 180 }} />
        <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={busy} data-testid="app-password-save">{tx('Set password')}</button>
      </form>
    </section>
  )
}

/** First launch of the Android app: explain and request the permissions background calls need. */
export function AppSetupSheet() {
  const [open, setOpen] = useState(() => { try { return isNative && localStorage.getItem('pingo-app-setup-v1') !== '1' } catch { return false } })
  const [busy, setBusy] = useState(false)
  if (!open) return null
  const finish = () => { try { localStorage.setItem('pingo-app-setup-v1', '1') } catch { /* ignore */ } setOpen(false) }
  const allow = async () => {
    setBusy(true)
    await safe(() => PingoNative.requestNotifications())
    const s = await safe(() => PingoNative.status())
    if (s && !s.batteryExempt) await safe(() => PingoNative.requestBatteryExemption())
    if (s && s.sdk >= 34 && !s.fullScreen) await safe(() => PingoNative.requestFullScreen())
    setBusy(false); finish()
  }
  return (
    <div className="confirm-backdrop" role="presentation" data-testid="app-setup">
      <div className="confirm-card app-setup-card" role="dialog" aria-modal="true">
        <div className="app-setup-ico">🔔</div>
        <h3>{tx('Get calls and messages anytime')}</h3>
        <ul>
          <li>🔔 <b>{tx('Notifications')}</b> — {tx('so new messages and incoming calls can alert you')}</li>
          <li>🔋 <b>{tx('Battery')}</b> — {tx('allow Pingo to keep running while the phone is asleep')}</li>
          <li>📞 <b>{tx('Full-screen calls')}</b> — {tx('so an incoming call can light up the lock screen')}</li>
        </ul>
        <p className="set-sub">{tx('Microphone and camera are asked the first time you make a call or record a voice message.')}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={finish}>{tx('Later')}</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void allow()} data-testid="app-setup-allow">{tx('Allow')}</button>
        </div>
      </div>
    </div>
  )
}

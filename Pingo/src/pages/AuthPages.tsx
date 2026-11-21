import { tx } from '../i18n'
import { useUiConfig } from '../lib/uiConfig'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { isInAppBrowser, useAuth } from '../contexts/AuthContext'
import { isNative } from '../lib/native'
import { IconGoogle, IconLogo } from '../components/Icons'
import { t, useT } from '../i18n'
import { LanguageSelect } from '../components/LanguagePicker'

function AuthDecor() {
  return (
    <div className="auth-decor" aria-hidden="true">
      <span className="auth-blob auth-blob-a" />
      <span className="auth-blob auth-blob-b" />
      <span className="auth-blob auth-blob-c" />
      <span className="auth-blob auth-blob-d" />
      <svg className="auth-float auth-float-1" viewBox="0 0 64 56">
        <path d="M8 8h36a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H28l-12 10v-10H8a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="currentColor" />
      </svg>
      <svg className="auth-float auth-float-2" viewBox="0 0 64 56">
        <path d="M20 8h36a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8h-8v10L36 40H20a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8z" fill="currentColor" />
      </svg>
      <svg className="auth-float auth-float-3" viewBox="0 0 48 48">
        <text x="24" y="34" textAnchor="middle" fontSize="32" fontWeight="800" fill="currentColor">X</text>
      </svg>
      <svg className="auth-float auth-float-4" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="6" />
      </svg>
      <svg className="auth-float auth-float-5" viewBox="0 0 48 48">
        <rect x="10" y="10" width="28" height="28" rx="4" fill="none" stroke="currentColor" strokeWidth="4" />
        <circle cx="18" cy="18" r="3" fill="currentColor" />
        <circle cx="30" cy="18" r="3" fill="currentColor" />
        <circle cx="24" cy="30" r="3" fill="currentColor" />
      </svg>
      <svg className="auth-float auth-float-6" viewBox="0 0 48 48">
        <polygon points="24,4 29,16 42,17 32,26 35,39 24,32 13,39 16,26 6,17 19,16" fill="currentColor" />
      </svg>
      <svg className="auth-float auth-float-7" viewBox="0 0 48 48">
        <polygon points="24,6 28,18 41,18 31,26 35,39 24,31 13,39 17,26 7,18 20,18" fill="currentColor" />
      </svg>
      <svg className="auth-float auth-float-8" viewBox="0 0 64 56">
        <path d="M10 10h32a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H30l-10 8v-8H10a8 8 0 0 1-8-8V18a8 8 0 0 1 8-8z" fill="currentColor" />
      </svg>
      <span className="auth-dot auth-dot-1" />
      <span className="auth-dot auth-dot-2" />
      <span className="auth-dot auth-dot-3" />
      <span className="auth-dot auth-dot-4" />
      <span className="auth-confetti c1" />
      <span className="auth-confetti c2" />
      <span className="auth-confetti c3" />
      <span className="auth-confetti c4" />
      <span className="auth-confetti c5" />
      <span className="auth-confetti c6" />
    </div>
  )
}

function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useT()
  return (
    <button
      className="btn btn-google"
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid="google-btn"
    >
      <IconGoogle />
      <span>{t('auth.google')}</span>
    </button>
  )
}

export const DEMO_ACCOUNTS = [
  { name: 'Mina', email: 'mina@demo.local', password: 'demo1234', username: 'mina' },
  { name: 'Jun', email: 'jun@demo.local', password: 'demo1234', username: 'jun' },
  { name: 'Soyeon', email: 'soyeon@demo.local', password: 'demo1234', username: 'soyeon' },
  { name: 'Haru', email: 'haru@demo.local', password: 'demo1234', username: 'haru' },
]

/** `preview` renders the screen for the admin UI editor's iframe: no redirects and no sign-in actions. */
export function LoginPage({ preview = false }: { preview?: boolean } = {}) {
  const { user, profile, loading, authError, signIn, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  if (!preview && !loading && user && profile) return <Navigate to="/" replace />
  if (!preview && !loading && user && !profile) return <Navigate to="/signup" replace />
  // Signed in, profile still loading (slow mobile networks): don't show the login form again.
  if (!preview && user && loading) return <SigningIn />
  const shownError = error || (!preview && authError ? friendlyAuthError(authError) || t('auth.googleFailed') : '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (preview) return
    setError('')
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyAuthError(err) || t('auth.googleFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <AuthDecor />
      <div className="auth-card">
        <LanguageSelect />
        {preview ? null : <InAppNotice />}
        <div className="brand">
          <IconLogo />
          <h1>{t('app.name')}</h1>
          <p>{t('auth.tagline')}</p>
        </div>
        <form onSubmit={(e) => void submit(e)} data-testid="login-form">
          <div className="field">
            <label htmlFor="email">{t('auth.email')}</label>
            <input id="email" data-testid="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">{t('auth.password')}</label>
            <input id="password" data-testid="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="error" data-testid="auth-error">{shownError}</div>
          <button className="btn btn-primary" type="submit" disabled={busy} data-testid="login-btn">{t('auth.login')}</button>
          <GoogleButton disabled={busy} onClick={() => void google()} />
        </form>
        <div className="auth-foot">
          {t('auth.noAccount')} <Link to="/signup">{t('auth.signup')}</Link>
        </div>
        {import.meta.env.VITE_USE_EMULATORS !== 'false' ? <div className="demo-box">
          <h3>{t('auth.demoAccounts')}</h3>
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              className="demo-row"
              data-testid={`demo-${a.username}`}
              onClick={() => { setEmail(a.email); setPassword(a.password); void signIn(a.email, a.password) }}
            >
              <b>{a.name}</b>
              <span>@{a.username} · {a.email}</span>
            </button>
          ))}
        </div> : null}
      </div>
    </div>
  )
}

function suggestUsername(raw: string) {
  const base = raw.replace(/[^a-z0-9._]/gi, '').toLowerCase().slice(0, 20)
  return base.length >= 3 ? base : ''
}

export function SignupPage() {
  const ui = useUiConfig()
  const { user, profile, loading, signUp, completeProfile, signInWithGoogle } = useAuth()
  const nav = useNavigate()
  const needsSetup = Boolean(user && !profile)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!needsSetup || !user) return
    setDisplayName((prev) => prev || (user.displayName ?? '').slice(0, 40))
    const fromEmail = (user.email ?? '').split('@')[0] ?? ''
    setUsername((prev) => prev || suggestUsername(fromEmail) || suggestUsername(user.displayName ?? ''))
  }, [needsSetup, user])

  if (!loading && user && profile) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (needsSetup) {
        await completeProfile({ displayName, username })
      } else {
        await signUp({ email, password, displayName, username })
      }
      nav('/', { replace: true })
    } catch (err) {
      setError(friendlyAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    setBusy(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(friendlyAuthError(err) || t('auth.googleFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <AuthDecor />
      <div className="auth-card">
        <LanguageSelect />
        <div className="brand">
          <IconLogo />
          <h1>{t('app.name')}</h1>
          <p>{needsSetup ? t('auth.setupTagline') : ui.signupTagline || t('auth.signupTagline')}</p>
        </div>
        <form onSubmit={(e) => void submit(e)} data-testid="signup-form">
          <div className="field">
            <label htmlFor="s-name">{t('auth.name')}</label>
            <input id="s-name" data-testid="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="s-user">{t('auth.username')}</label>
            <input id="s-user" data-testid="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={tx("@username")} required />
          </div>
          {!needsSetup ? (
            <>
              <div className="field">
                <label htmlFor="s-email">{t('auth.email')}</label>
                <input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="s-pass">{t('auth.password')}</label>
                <input id="s-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
              </div>
            </>
          ) : null}
          <div className="error">{error}</div>
          <button className="btn btn-primary" type="submit" disabled={busy} data-testid="signup-btn">
            {needsSetup ? t('auth.finishSetup') : t('auth.signup')}
          </button>
          {!needsSetup ? <GoogleButton disabled={busy} onClick={() => void google()} /> : null}
        </form>
        {!needsSetup ? (
          <div className="auth-foot">
            {t('auth.hasAccount')} <Link to="/login">{t('auth.login')}</Link>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Shown in KakaoTalk / Instagram / LINE… webviews: Google blocks sign-in there. */
function InAppNotice() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (isNative || !isInAppBrowser(ua)) return null // the Android app explains Google sign-in on the button itself
  const url = location.href
  const open = () => {
    if (/KAKAOTALK/i.test(ua)) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url)
    else if (/Android/i.test(ua)) location.href = 'intent://' + url.replace(/^https?:\/\//, '') + '#Intent;scheme=https;package=com.android.chrome;end'
    else void navigator.clipboard?.writeText(url).catch(() => undefined)
  }
  return (
    <div className="inapp-notice" data-testid="inapp-notice">
      <span>{tx('You’re in an in-app browser. For Google sign-in, open Pingo in Safari or Chrome.')}</span>
      <button type="button" className="btn btn-ghost" onClick={open}>{/Android|KAKAOTALK/i.test(ua) ? tx('Open in browser') : tx('Copy link')}</button>
    </div>
  )
}

function SigningIn() {
  const { logout } = useAuth()
  const [slow, setSlow] = useState(false)
  useEffect(() => { const id = window.setTimeout(() => setSlow(true), 12000); return () => clearTimeout(id) }, [])
  return (
    <div className="auth-wrap">
      <AuthDecor />
      <div className="auth-card auth-signing" data-testid="auth-signing-in">
        <div className="brand"><IconLogo /><h1>{t('app.name')}</h1></div>
        <div className="auth-spinner" aria-hidden="true" />
        <p>{tx('Signing you in…')}</p>
        {slow ? <><p className="muted">{tx('This is taking longer than usual. Check your connection.')}</p>
          <div className="auth-signing-actions"><button type="button" className="btn btn-primary" onClick={() => location.reload()}>{tx('Retry')}</button>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>{tx('Log out')}</button></div></> : null}
      </div>
    </div>
  )
}

function friendlyAuthError(err: unknown): string {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
  const msg = err instanceof Error ? err.message : t('auth.errorGeneric')
  if (code.includes('email-already-in-use') || code.includes('account-exists-with-different-credential')) return t('auth.emailInUse')
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return t('auth.badCredentials')
  if (code.includes('weak-password')) return t('auth.weakPassword')
  if (code === 'pingo/native-google') return tx('Google sign-in doesn’t work inside the app. Sign in with email — Google users can add a password in the browser: Settings → Password for the Android app.')
  if (code === 'pingo/in-app-browser') return tx('Google sign-in doesn’t work inside this app’s browser. Open Pingo in Safari or Chrome.')
  if (code.includes('network-request-failed')) return tx('Network problem — check your connection and try again.')
  if (code.includes('web-storage-unsupported')) return tx('This browser is blocking storage. Turn off private mode or open Pingo in Safari or Chrome.')
  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return ''
  if (code.includes('operation-not-allowed')) return t('auth.googleFailed')
  if (code.includes('unauthorized-domain')) return t('auth.googleFailed')
  return msg
}

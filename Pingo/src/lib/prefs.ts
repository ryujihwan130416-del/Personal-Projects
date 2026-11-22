import { isNative } from './native'
import { doc, updateDoc } from 'firebase/firestore'
import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ACCENTS, useTheme, type AccentId } from '../contexts/ThemeContext'
import { db, fsCol } from '../firebase/app'
import { useUiConfig } from './uiConfig'
import { getLocale, setLocale, LOCALES, type Locale } from '../i18n'
import type { ColorScheme } from '../types'

const NOTIFY_KEY = 'pingo-notify'

export function notifyEnabled(): boolean {
  // Android app: no Notification API in the WebView; reminders go through native local notifications instead.
  try { return localStorage.getItem(NOTIFY_KEY) === '1' && (isNative || ('Notification' in window && Notification.permission === 'granted')) } catch { return false }
}
export function setNotifyLocal(on: boolean) {
  try { localStorage.setItem(NOTIFY_KEY, on ? '1' : '0') } catch { /* ignore */ }
}

/** Applies the signed-in user's saved theme/accent once their profile loads. */
export function PrefsSync() {
  const { profile } = useAuth()
  const { setTheme, setAccent } = useTheme()
  const ui = useUiConfig()
  const applied = useRef('')
  // App-wide defaults from the admin UI editor apply only when this person never picked their own.
  useEffect(() => {
    if (!profile) return
    if (!profile.prefs?.theme && (ui.defaultTheme === 'light' || ui.defaultTheme === 'dark')) setTheme(ui.defaultTheme)
  }, [profile, ui.defaultTheme, setTheme])
  useEffect(() => {
    if (!profile || applied.current === profile.uid) return
    applied.current = profile.uid
    const p = profile.prefs
    if (p?.theme === 'light' || p?.theme === 'dark') setTheme(p.theme)
    // Language follows the account; with none saved, the device choice (or browser language) stays.
    if (p?.lang && LOCALES.some((l) => l.id === p.lang) && p.lang !== getLocale()) setLocale(p.lang as Locale)
    if (p?.accent === 'default' || (p?.accent && ACCENTS.some((a) => a.id === p.accent))) setAccent(p.accent as AccentId)
    // Notifications follow the account too; the browser's own permission still has to be granted on each device.
    try { if (typeof p?.notify === 'boolean' && localStorage.getItem(NOTIFY_KEY) === null) setNotifyLocal(p.notify) } catch { /* ignore */ }
  }, [profile, setTheme, setAccent])
  return null
}

/** Setters that change the look right away and persist it to the user's profile. */
export function usePrefs() {
  const { user } = useAuth()
  const theme = useTheme()
  const save = useCallback((patch: Record<string, unknown>) => {
    if (!user) return
    void updateDoc(doc(db, ...fsCol('users', user.uid)), patch).catch(() => { /* offline: local copy still applies */ })
  }, [user])
  const setTheme = useCallback((t: ColorScheme) => { theme.setTheme(t); save({ 'prefs.theme': t }) }, [theme, save])
  const setAccent = useCallback((a: AccentId) => { theme.setAccent(a); save({ 'prefs.accent': a }) }, [theme, save])
  const toggle = useCallback(() => setTheme(theme.theme === 'dark' ? 'light' : 'dark'), [setTheme, theme.theme])
  const setNotify = useCallback((on: boolean) => { setNotifyLocal(on); save({ 'prefs.notify': on }) }, [save])
  const setLang = useCallback((l: Locale) => { setLocale(l); save({ 'prefs.lang': l }) }, [save])
  return { theme: theme.theme, accent: theme.accent, setTheme, setAccent, toggle, setNotify, setLang }
}

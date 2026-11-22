/**
 * Admin console language (English / Korean). Follows the app language (Korean → Korean, anything else →
 * English) unless the admin picks EN/KO with the header toggle, which is remembered on this device.
 * Strings are written in English in the code and looked up in the Korean table; unknown strings stay English.
 */
import { useEffect, useState } from 'react'
import { getLocale, onLocaleChange } from '../../i18n'
import { KO } from './adminKo'
import { askConfirm } from '../../components/ConfirmDialog'

export type AdminLang = 'en' | 'ko'
const KEY = 'pingo-admin-lang'
const listeners = new Set<() => void>()

function stored(): AdminLang | null {
  try { const v = localStorage.getItem(KEY); return v === 'en' || v === 'ko' ? v : null } catch { return null }
}
function auto(): AdminLang { return getLocale() === 'ko' ? 'ko' : 'en' }
let lang: AdminLang = typeof window === 'undefined' ? 'en' : stored() ?? auto()

if (typeof window !== 'undefined') onLocaleChange(() => { if (!stored()) setLangInternal(auto()) })
function setLangInternal(next: AdminLang) { if (next === lang) return; lang = next; listeners.forEach((f) => f()) }

export function getAdminLang(): AdminLang { return lang }
/** Header toggle: remember the admin's choice on this device. */
export function setAdminLang(next: AdminLang) {
  try { localStorage.setItem(KEY, next) } catch { /* ignore */ }
  setLangInternal(next)
}
/** Re-render on language change; returns the current admin language. */
export function useAdminLang(): AdminLang {
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((n) => n + 1); listeners.add(f); return () => { listeners.delete(f) } }, [])
  return lang
}
/** Translate an English admin string; {0}/{name} placeholders are filled from vars. */
export function at(s: string, vars?: readonly unknown[] | Record<string, unknown>): string {
  const base = lang === 'ko' ? (KO[s] ?? s) : s
  if (import.meta.env.DEV && lang === 'ko' && !(s in KO) && /[A-Za-z]{2}/.test(s)) {
    const w = window as unknown as { __atMissing?: Set<string> }
    ;(w.__atMissing ??= new Set()).add(s)
  }
  if (!vars) return base
  return base.replace(/\{(\w+)\}/g, (m: string, k: string) => { const v = (vars as Record<string, unknown>)[k]; return v === undefined || v === null ? m : String(v) })
}

/** Centred in-app confirm with buttons in the admin console's language. */
export function adminConfirm(message: string): Promise<boolean> {
  const danger = /delete|remove|ban|clear|reset|삭제|차단|초기화/i.test(message)
  return askConfirm(message, { danger, ok: at(danger ? 'Delete' : 'OK'), cancel: at('Cancel') })
}

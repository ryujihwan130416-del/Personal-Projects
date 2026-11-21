import { doc, updateDoc } from 'firebase/firestore'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import {
  ALL_CATEGORIES, activeCategories, cleanUserFilter, detect, filterText, getModerationConfig, levelRank, useModerationConfig,
  type FlagCategory, type ModerationConfig, type UserFilter,
} from './moderation'

const LS = 'pingo-chat-filter'
function local(): unknown { try { return JSON.parse(localStorage.getItem(LS) ?? 'null') } catch { return null } }

/** The viewer's chat-filter settings (account first, then this device, then the admin defaults). */
export function useChatFilter() {
  const { user, profile } = useAuth()
  const cfg = useModerationConfig()
  const raw = (profile?.prefs as { filter?: unknown } | undefined)?.filter ?? local()
  // Optimistic copy so toggles flip instantly; dropped once the account snapshot catches up.
  const [pending, setPending] = useState<UserFilter | null>(null)
  const rawKey = JSON.stringify(raw)
  useEffect(() => { setPending((p) => (p && JSON.stringify(p) === rawKey ? null : p)) }, [rawKey])
  const stored = useMemo(() => cleanUserFilter(JSON.parse(rawKey ?? 'null'), cfg.userDefaults), [rawKey, cfg.userDefaults])
  const settings = pending ?? stored
  const effectiveLevel = levelRank(settings.level) < levelRank(cfg.minLevel) ? cfg.minLevel : settings.level
  const cats = useMemo(() => activeCategories(settings, cfg), [settings, cfg])
  const forced = useMemo(() => new Set(ALL_CATEGORIES.filter((c) => cfg.modes[c] === 'mask')), [cfg])
  const save = useCallback((next: UserFilter) => {
    setPending(next)
    try { localStorage.setItem(LS, JSON.stringify(next)) } catch { /* ignore */ }
    if (user) void updateDoc(doc(db, ...fsCol('users', user.uid)), { 'prefs.filter': next }).catch(() => {})
  }, [user])
  /** What a received message should look like for this viewer. */
  const view = useCallback((text: string) => viewText(text, settings, cats, forced, cfg), [settings, cats, forced, cfg])
  return { settings, cfg, cats, effectiveLevel, save, view }
}

export function viewText(text: string, settings: UserFilter, cats: Set<FlagCategory>, forced: Set<FlagCategory>, cfg: ModerationConfig) {
  if (!text) return { text, hit: [] as FlagCategory[], blur: false }
  const maskSet = settings.mask ? cats : forced
  const masked = filterText(text, maskSet, cfg)
  let blur = false
  if (settings.blur) blur = filterText(text, cats, cfg).hit.length > 0
  return { text: masked.text, hit: masked.hit, blur }
}

/** Categories set to "block sending" that this text trips (empty = OK to send). */
export function blockedBy(text: string): FlagCategory[] {
  const cfg = getModerationConfig()
  const d = detect(text, cfg)
  if (!d) return []
  return d.categories.filter((c) => cfg.modes[c] === 'block')
}

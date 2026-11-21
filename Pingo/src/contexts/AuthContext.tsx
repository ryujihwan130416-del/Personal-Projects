import { registerDevice } from '../lib/pushPing'
import { logActivity } from '../lib/activity'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { onDisconnect, onValue, ref, set } from 'firebase/database'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, db, rtdb, fsCol } from '../firebase/app'
import { isNative, PingoNative, safe } from '../lib/native'
import { isValidUsername, normalizeUsername } from '../lib/ids'
import type { UserProfile } from '../types'
import { t } from '../i18n'

type AuthCtx = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  /** Error from a Google redirect sign-in that came back to the app (shown on the login page). */
  authError: unknown
  blockedIds: Set<string>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (params: { email: string; password: string; displayName: string; username: string }) => Promise<void>
  completeProfile: (params: { displayName: string; username: string }) => Promise<void>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
  isBlocked: (uid: string) => boolean
}

const Ctx = createContext<AuthCtx | null>(null)

function mapProfile(uid: string, data: Record<string, unknown> | undefined): UserProfile | null {
  if (!data?.username || !data?.displayName) return null
  return {
    uid,
    username: String(data.username),
    displayName: String(data.displayName),
    bio: String(data.bio ?? ''),
    link: String(data.link ?? ''),
    photoURL: String(data.photoURL ?? ''),
    createdAt: (data.createdAt as UserProfile['createdAt']) ?? null,
    prefs: (data.prefs as UserProfile['prefs']) ?? undefined,
  }
}

/** Embedded app browsers where Google blocks OAuth ("disallowed_useragent"). */
export function isInAppBrowser(ua: string) {
  return /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|everytimeApp|; wv\)/i.test(ua)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [authError, setAuthError] = useState<unknown>(null)

  useEffect(() => {
    void getRedirectResult(auth).catch((e) => {
      console.warn('Google redirect sign-in failed', e)
      setAuthError(e)
    })
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setBlockedIds(new Set())
        setLoading(false)
      } else {
        // Stay in a loading state until the profile snapshot arrives.
        // Otherwise a slow Firestore read can send a signed-in user to /signup.
        setLoading(true)
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    if (!user) return
    let got = false
    const ref0 = doc(db, ...fsCol('users', user.uid))
    const unsub = onSnapshot(ref0, (snap) => {
      got = true
      setProfile(mapProfile(user.uid, snap.data()))
      setLoading(false)
    }, () => { got = true; setLoading(false) })
    // Slow / flaky mobile networks: if the realtime listener hasn't delivered the profile yet, read it once
    // directly so a signed-in user isn't left looking at the login form.
    const timer = window.setTimeout(() => {
      if (got) return
      void getDoc(ref0).then((snap) => {
        if (got) return
        got = true
        setProfile(mapProfile(user.uid, snap.data()))
        setLoading(false)
      }).catch(() => { /* the listener will retry */ })
    }, 6000)
    return () => { clearTimeout(timer); unsub() }
  }, [user])

  // Admin activity log: one 'signup' or 'login' entry per browser session.
  useEffect(() => {
    if (!user || !profile) return
    const key = `pingo-act-${user.uid}`
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1') } catch { return }
    const created = profile.createdAt?.toMillis?.() ?? 0
    void logActivity(user.uid, created && Date.now() - created < 10 * 60000 ? 'signup' : 'login', { via: user.providerData[0]?.providerId ?? 'password' })
  }, [user, profile])

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(collection(db, ...fsCol('users', user.uid, 'blocked')), (snap) => {
      setBlockedIds(new Set(snap.docs.map((d) => d.id)))
    })
    return unsub
  }, [user])

  useEffect(() => {
    if (!user) return
    const connectedRef = ref(rtdb, '.info/connected')
    const myRef = ref(rtdb, `dmly/presence/${user.uid}`)
    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() !== true) return
      void onDisconnect(myRef)
        .set({ state: 'offline', lastActive: Date.now() })
        .then(() => set(myRef, { state: 'online', lastActive: Date.now() }))
    })
    return () => {
      unsub()
      void set(myRef, { state: 'offline', lastActive: Date.now() })
    }
  }, [user])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (params: { email: string; password: string; displayName: string; username: string }) => {
    const username = normalizeUsername(params.username)
    const displayName = params.displayName.trim()
    if (!displayName || displayName.length > 40) throw new Error(t('auth.nameLength'))
    if (!isValidUsername(username)) throw new Error(t('auth.usernameRules'))

    // Create the account first: username lookups need a signed-in user under the rules.
    const cred = await createUserWithEmailAndPassword(auth, params.email, params.password)
    try {
      const taken = await getDoc(doc(db, ...fsCol('usernames', username)))
      if (taken.exists()) throw new Error(t('auth.usernameTaken'))
      const batch = writeBatch(db)
      batch.set(doc(db, ...fsCol('usernames', username)), { uid: cred.user.uid })
      batch.set(doc(db, ...fsCol('users', cred.user.uid)), {
        username,
        displayName,
        bio: '',
        link: '',
        photoURL: '',
        createdAt: serverTimestamp(),
      })
      await batch.commit()
    } catch (err) {
      try {
        await cred.user.delete()
      } catch {
        /* ignore */
      }
      throw err
    }
  }


  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    setAuthError(null)
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    // Google refuses sign-in inside app webviews (KakaoTalk, Instagram, LINE, NAVER…): say so instead of failing silently.
    if (isNative) throw Object.assign(new Error('native app'), { code: 'pingo/native-google' })
    if (isInAppBrowser(ua)) throw Object.assign(new Error('in-app browser'), { code: 'pingo/in-app-browser' })
    const mobile = /Mobi|Android|iPhone|iPad/i.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
    // Mobile: full-page redirect. It is reliable now because authDomain is this same site (see firebase/config).
    // Auth emulator has a fake Google popup — prefer popup there and on desktop.
    if (mobile && !auth.emulatorConfig) {
      await signInWithRedirect(auth, provider)
      return
    }
    try {
      await signInWithPopup(auth, provider)
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: string }).code) : ''
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
        return
      }
      throw err
    }
  }

  const completeProfile = async (params: { displayName: string; username: string }) => {
    const current = auth.currentUser
    if (!current) throw new Error(t('auth.errorGeneric'))
    const username = normalizeUsername(params.username)
    const displayName = params.displayName.trim()
    if (!displayName || displayName.length > 40) throw new Error(t('auth.nameLength'))
    if (!isValidUsername(username)) throw new Error(t('auth.usernameRules'))
    const taken = await getDoc(doc(db, ...fsCol('usernames', username)))
    if (taken.exists() && taken.data()?.uid !== current.uid) throw new Error(t('auth.usernameTaken'))
    const existing = await getDoc(doc(db, ...fsCol('users', current.uid)))
    const existingProfile = mapProfile(current.uid, existing.data())
    if (existingProfile) { setProfile(existingProfile); return }
    const batch = writeBatch(db)
    // Usernames can't be updated by rules, so only create the claim if it isn't ours already.
    if (!taken.exists()) batch.set(doc(db, ...fsCol('usernames', username)), { uid: current.uid })
    batch.set(doc(db, ...fsCol('users', current.uid)), {
      username,
      displayName,
      bio: '',
      link: '',
      photoURL: current.photoURL ?? '',
      createdAt: serverTimestamp(),
    })
    await batch.commit()
    const snap = await getDoc(doc(db, ...fsCol('users', current.uid)))
    setProfile(mapProfile(current.uid, snap.data()))
  }

  const logout = async () => {
    if (user && isNative) {
      // Stop the Android app's instant-notification stream for this account.
      await safe(() => PingoNative.setPushAuth({ uid: '', refreshToken: '', apiKey: '', dbUrl: '', blocked: [] }))
      await registerDevice(user.uid, false)
    }
    if (user) {
      try {
        await set(ref(rtdb, `dmly/presence/${user.uid}`), { state: 'offline', lastActive: Date.now() })
      } catch {
        /* ignore */
      }
    }
    await signOut(auth)
  }

  const refreshProfile = async () => {
    if (!user) return
    const snap = await getDoc(doc(db, ...fsCol('users', user.uid)))
    setProfile(mapProfile(user.uid, snap.data()))
  }

  const isBlocked = (uid: string) => blockedIds.has(uid)

  const value = useMemo(
    () => ({ user, profile, loading, authError, blockedIds, signIn, signInWithGoogle, signUp, completeProfile, logout, refreshProfile, isBlocked }),
    [user, profile, loading, authError, blockedIds],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth')
  return ctx
}

export async function updateOwnProfile(uid: string, patch: Partial<Pick<UserProfile, 'displayName' | 'bio' | 'link' | 'photoURL'>>) {
  await updateDoc(doc(db, ...fsCol('users', uid)), patch)
}

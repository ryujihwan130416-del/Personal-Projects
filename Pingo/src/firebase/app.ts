import { Capacitor } from '@capacitor/core'
import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  initializeAuth,
} from 'firebase/auth'
import { connectDatabaseEmulator, getDatabase } from 'firebase/database'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { connectStorageEmulator, getStorage } from 'firebase/storage'
import {
  emulatorHosts,
  firebaseConfig,
  firestoreDatabaseId,
  storageConfigured,
  useEmulators,
} from './config'

export { fsCol, rtdbPath } from './paths'

export const app = initializeApp(firebaseConfig)
// Explicit persistence chain: IndexedDB → localStorage → sessionStorage → memory. Private tabs and
// in-app browsers that block IndexedDB/localStorage still keep the session for this tab instead of
// silently dropping the user back to the login screen.
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
})
function isAppWebView() {
  if (typeof window === 'undefined') return false
  try {
    if (Capacitor.isNativePlatform()) return true
  } catch { /* the native bridge is not installed on the web */ }
  const ua = navigator.userAgent || ''
  return /; wv\)/.test(ua) || /Capacitor/i.test(ua)
}

// The Android WebView has one page. The multi-tab disk cache waits for a "primary tab" lease that
// WebView never grants, so writes (sending a message) sit forever. The website keeps the shared cache.
function openFirestore() {
  const id = firestoreDatabaseId || undefined
  const localCache = isAppWebView()
    ? memoryLocalCache()
    : persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  try {
    return initializeFirestore(app, { localCache }, id)
  } catch {
    return initializeFirestore(app, { localCache: memoryLocalCache() }, id)
  }
}
export const db = openFirestore()
export const storage = getStorage(app)
export const rtdb = getDatabase(app)

if (useEmulators) {
  connectAuthEmulator(auth, `http://${emulatorHosts.auth.host}:${emulatorHosts.auth.port}`, {
    disableWarnings: true,
  })
  connectFirestoreEmulator(db, emulatorHosts.firestore.host, emulatorHosts.firestore.port)
  connectDatabaseEmulator(rtdb, emulatorHosts.database.host, emulatorHosts.database.port)
  if (storageConfigured) {
    connectStorageEmulator(storage, emulatorHosts.storage.host, emulatorHosts.storage.port)
  }
}

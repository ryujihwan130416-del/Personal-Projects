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
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
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
export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app)
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

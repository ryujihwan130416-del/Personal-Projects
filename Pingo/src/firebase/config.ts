/**
 * Single place to configure the app name and Firebase project.
 *
 * Demo / emulator (default, `npm run demo`):
 *   - useEmulators = true
 *   - projectId = "demo-dmapp"
 *   - Firestore database id `turboracer` (same id as production, in the emulator)
 *
 * Production (`VITE_USE_EMULATORS=false`):
 *   - Project lumen-fcf2f, Hosting site pingo-messenger
 *   - Firestore: existing `turboracer` database, data under dmly/app/...
 *   - RTDB: default instance, data under /dmly/...
 *   - No Cloud Storage; photos are compressed data URLs in Firestore.
 */
export const APP_NAME = 'Pingo'

export const emulatorConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-dmapp.firebaseapp.com',
  projectId: 'demo-dmapp',
  storageBucket: 'demo-dmapp.appspot.com',
  messagingSenderId: '0',
  appId: '1:0:web:demo',
  databaseURL: 'http://127.0.0.1:9000?ns=demo-dmapp',
}

/**
 * Google sign-in must use the *same* domain the app is served from. Mobile Safari / Chrome partition
 * third-party storage, so a redirect through lumen-fcf2f.firebaseapp.com can never hand the signed-in
 * user back to pingo-messenger.web.app (you end up on the login screen again). Firebase Hosting serves
 * /__/auth/* on every site, so on our own hosting domains we use the current host as authDomain.
 */
const PINGO_HOSTS = ['pingo-messenger.web.app', 'pingo-messenger.firebaseapp.com']
const host = typeof location !== 'undefined' ? location.hostname : ''
export const productionConfig = {
  apiKey: 'AIzaSyB0sSNRHTBG3rzgTSj8-AAaMHZn6OgnFwE',
  authDomain: PINGO_HOSTS.includes(host) ? host : 'pingo-messenger.web.app',
  projectId: 'lumen-fcf2f',
  storageBucket: '',
  messagingSenderId: '560311125701',
  appId: '1:560311125701:web:3501a129ea8177f28852ac',
  databaseURL: 'https://lumen-fcf2f-default-rtdb.asia-southeast1.firebasedatabase.app',
}

export const useEmulators =
  import.meta.env.VITE_USE_EMULATORS !== 'false'

export const firebaseConfig = useEmulators ? emulatorConfig : productionConfig

/** The only existing Firestore database on lumen-fcf2f. Also used in the emulator. */
export const firestoreDatabaseId = 'turboracer'

/** Production has no Pingo Storage bucket; emulator keeps Storage for local media. */
export const storageConfigured = useEmulators && Boolean(firebaseConfig.storageBucket)

const emuPort = (v: string | undefined, d: number) => Number(v) || d
export const emulatorHosts = {
  auth: { host: '127.0.0.1', port: emuPort(import.meta.env.VITE_EMU_AUTH_PORT, 9099) },
  firestore: { host: '127.0.0.1', port: emuPort(import.meta.env.VITE_EMU_FS_PORT, 8080) },
  database: { host: '127.0.0.1', port: emuPort(import.meta.env.VITE_EMU_DB_PORT, 9000) },
  storage: { host: '127.0.0.1', port: emuPort(import.meta.env.VITE_EMU_STORAGE_PORT, 9199) },
}

/** Public Google STUN. Add a TURN server for LTE / strict NAT. */
export const iceServers: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
]

if (useEmulators && import.meta.env.VITE_LOCAL_TURN !== 'false') {
  iceServers.push({
    urls: [
      'stun:127.0.0.1:3478',
      'turn:127.0.0.1:3478?transport=udp',
      'turn:127.0.0.1:3478?transport=tcp',
    ],
    username: 'demo',
    credential: 'demo',
  })
}

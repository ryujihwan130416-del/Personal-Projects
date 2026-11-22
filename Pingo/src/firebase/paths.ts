/** All DMly Firestore documents live under the dmly/app path. */
export const FS_ROOT = ['dmly', 'app'] as const

/** Firestore path segments: collection(db, ...fsCol('users', uid)) */
export function fsCol(...parts: string[]): [string, string, ...string[]] {
  return ['dmly', 'app', ...parts]
}

/** Realtime Database path under /dmly/... (.info/* is not prefixed). */
export function rtdbPath(path: string) {
  return path.startsWith('.info/') ? path : `dmly/${path.replace(/^\/+/, '')}`
}

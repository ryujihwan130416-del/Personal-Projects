const STORAGE_KEY = 'lumen.apiKey'

export function readApiKey(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim()
    if (stored) return stored
  } catch {
    /* Storage can be blocked. Fall through to the env key. */
  }
  const env = import.meta.env.VITE_YOUTUBE_API_KEY
  return typeof env === 'string' ? env.trim() : ''
}

export function writeApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* Ignore private-mode storage failures. The in-memory key still works. */
  }
}

export function hasStoredApiKey(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY)?.trim())
  } catch {
    return false
  }
}

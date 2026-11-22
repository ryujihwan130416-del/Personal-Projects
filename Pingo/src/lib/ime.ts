/**
 * Korean / Japanese / Chinese IME safety for Enter-to-submit.
 *
 * While an IME is composing (e.g. typing 안녕 the last syllable 녕 is still "in progress"), browsers fire a
 * keydown for Enter with `isComposing` (keyCode 229). Treating that as "send" sends 안녕 and then the IME
 * commits 녕 again into the now-empty box, so a second message 녕 goes out. Ignore those Enters.
 */
type KeyLike = { key?: string; keyCode?: number; isComposing?: boolean; nativeEvent?: { isComposing?: boolean; keyCode?: number } }

let composing = false

export function isImeEnter(e: KeyLike): boolean {
  if (e.nativeEvent?.isComposing || e.isComposing) return true
  if ((e.nativeEvent?.keyCode ?? e.keyCode) === 229) return true
  // (Safari fires compositionend before that keydown, but still reports keyCode 229 — caught above.)
  return composing
}

/** True while any text field is composing with an IME. */
export const isComposingNow = () => composing

/**
 * Global guard: stop composing Enters before React (or any app handler) sees them, so every Enter-submit
 * input in the app — composer, search, comments, story text, admin fields, forms — is protected.
 * The browser's own default (committing the syllable) still happens.
 */
export function installImeGuard() {
  if (typeof document === 'undefined' || (window as unknown as { __imeGuard?: boolean }).__imeGuard) return
  ;(window as unknown as { __imeGuard?: boolean }).__imeGuard = true
  document.addEventListener('compositionstart', () => { composing = true }, true)
  document.addEventListener('compositionend', () => { composing = false }, true)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.keyCode !== 229) return
    if (e.key === 'Enter' && isImeEnter(e)) {
      e.stopPropagation()
      // Forms: don't let a composing Enter trigger implicit submission either.
      const t = e.target as HTMLElement | null
      if (t instanceof HTMLInputElement && t.form) e.preventDefault()
    }
  }, true)
  // Form submit fired by the same composing Enter (some WebKit builds): drop it.
  document.addEventListener('submit', (e) => { if (composing) { e.preventDefault(); e.stopPropagation() } }, true)
}

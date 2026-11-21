export const embeddedLumen = () => typeof window !== 'undefined' && window.parent !== window

export function leaveLumen() {
  if (window.parent === window) return
  window.parent.postMessage({ type: 'lumen-exit' }, window.location.origin)
}

import { useCallback, useRef } from 'react'

/**
 * Publishes the element's content size as CSS variables (--aw / --ah, in px) and an orientation flag
 * (data-orient="landscape" | "portrait"), recalculated on resize and orientation change.
 * CSS then sizes boards / calendar cells from the space that is actually available.
 */
export function useFluidRef<T extends HTMLElement>() {
  const cleanup = useRef<(() => void) | null>(null)
  return useCallback((el: T | null) => {
    cleanup.current?.()
    cleanup.current = null
    if (!el) return
    const apply = () => {
      const cs = getComputedStyle(el)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      el.style.setProperty('--aw', `${Math.max(0, Math.round(w))}px`)
      el.style.setProperty('--ah', `${Math.max(0, Math.round(h))}px`)
      el.dataset.orient = w > h * 1.15 ? 'landscape' : 'portrait'
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    window.addEventListener('orientationchange', apply)
    cleanup.current = () => { ro.disconnect(); window.removeEventListener('orientationchange', apply) }
  }, [])
}

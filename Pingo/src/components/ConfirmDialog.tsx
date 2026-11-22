import { useEffect, useRef, useState } from 'react'
import { tx } from '../i18n'

/**
 * In-app confirm dialog (replaces window.confirm): always centred on screen on every device, keeps the
 * message's own casing, and follows the app language. `askConfirm` resolves true (OK) or false.
 */
interface Req { message: string; ok?: string; cancel?: string; danger?: boolean; resolve: (v: boolean) => void }
let push: ((r: Req) => void) | null = null
const queue: Req[] = []

export function askConfirm(message: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const r = { message, ...opts, resolve }
    if (push) push(r); else queue.push(r)
  })
}

export function ConfirmHost() {
  const [reqs, setReqs] = useState<Req[]>([])
  const okRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    push = (r) => setReqs((q) => [...q, r])
    if (queue.length) setReqs((q) => [...q, ...queue.splice(0)])
    return () => { push = null }
  }, [])
  const cur = reqs[0]
  const done = (v: boolean) => { cur?.resolve(v); setReqs((q) => q.slice(1)) }
  useEffect(() => {
    if (!cur) return
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false) } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur])
  if (!cur) return null
  const danger = cur.danger ?? /delete|remove|ban|clear|reset|삭제|차단/i.test(cur.message)
  return (
    <div className="confirm-backdrop" role="presentation" onClick={() => done(false)} data-testid="confirm-dialog">
      <div className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="confirm-msg" onClick={(e) => e.stopPropagation()}>
        <p id="confirm-msg" className="confirm-msg">{cur.message}</p>
        <div className="confirm-actions">
          <button type="button" className="btn btn-ghost" onClick={() => done(false)} data-testid="confirm-cancel">{cur.cancel ?? tx('Cancel')}</button>
          <button type="button" ref={okRef} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => done(true)} data-testid="confirm-ok">{cur.ok ?? (danger ? tx('Delete') : tx('OK'))}</button>
        </div>
      </div>
    </div>
  )
}

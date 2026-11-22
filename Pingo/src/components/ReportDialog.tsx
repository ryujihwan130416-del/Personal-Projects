import { tx } from '../i18n'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { db, fsCol } from '../firebase/app'
import { logActivity } from '../lib/activity'
import { useToast } from './Toast'

export type ReportTargetType = 'message' | 'user' | 'post'
export interface ReportTarget {
  type: ReportTargetType
  targetUid: string
  targetId?: string
  chatId?: string
  /** What the reporter saw, so the admin still has it if the content is later removed. */
  snapshot?: { text?: string; kind?: string; name?: string }
  label?: string
}

export const REPORT_REASONS = [
  'Spam or scam',
  'Harassment or bullying',
  'Hate speech',
  'Sexual content',
  'Violence or threats',
  'Self-harm',
  'Impersonation',
  'Other',
] as const

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!user || !reason) return
    setBusy(true)
    try {
      await addDoc(collection(db, ...fsCol('reports')), {
        reporterId: user.uid,
        reporterName: profile?.displayName ?? '',
        targetType: target.type,
        targetUid: target.targetUid,
        targetId: target.targetId ?? target.targetUid,
        chatId: target.chatId ?? null,
        reason,
        note: note.trim().slice(0, 1000),
        snapshot: {
          text: (target.snapshot?.text ?? '').slice(0, 1000),
          kind: target.snapshot?.kind ?? target.type,
          name: target.snapshot?.name ?? '',
        },
        status: 'open',
        source: 'user',
        createdAt: serverTimestamp(),
      })
      void logActivity(user.uid, 'report_filed', { targetType: target.type, targetUid: target.targetUid, reason })
      if (target.targetUid !== user.uid) void logActivity(user.uid, 'report_received', { targetType: target.type, reason }, target.targetUid)
      toast(tx("Thanks — your report was sent to the Pingo team"))
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : tx('Could not send the report'))
    } finally {
      setBusy(false)
    }
  }

  const what = target.type === 'message' ? 'message' : target.type === 'post' ? 'post' : 'account'
  // Portal to <body>: glassy ancestors (backdrop-filter) would otherwise trap a fixed overlay.
  return createPortal(
    <div className="backdrop center" onClick={onClose}>
      <div className="sheet report-sheet" role="dialog" aria-label={`Report ${what}`} data-testid="report-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-head">
          <span className="report-ico" aria-hidden="true">🚩</span>
          <div>
            <h3>{what === 'message' ? tx('Report message') : what === 'post' ? tx('Report post') : tx('Report account')}</h3>
            <p>{target.label ?? tx('Only the Pingo team sees reports. The person is not told who reported them.')}</p>
          </div>
        </div>
        {target.snapshot?.text ? <blockquote className="report-quote">{target.snapshot.text.slice(0, 220)}</blockquote> : null}
        <div className="reason-grid" role="radiogroup" aria-label={tx("Reason")}>
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={reason === r} className={`reason ${reason === r ? 'on' : ''}`} data-testid={`reason-${r.split(' ')[0].toLowerCase()}`} onClick={() => setReason(r)}>{tx(r)}</button>
          ))}
        </div>
        <textarea className="input textarea" rows={3} maxLength={1000} placeholder={tx("Add details (optional)")} value={note} onChange={(e) => setNote(e.target.value)} data-testid="report-note" />
        <div className="set-actions" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>{tx("Cancel")}</button>
          <button type="button" className="btn btn-primary" disabled={!reason || busy} onClick={() => void submit()} data-testid="report-submit">{busy ? tx('Sending…') : tx('Send report')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

import { useMemo } from 'react'

const PALETTE = ['#6d5efc', '#ec4899', '#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#10b981']

function colorFor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function Avatar({
  name,
  photoURL,
  size = 56,
  online,
  onClick,
  className = '',
  testId,
  ring,
}: {
  name: string
  photoURL?: string
  size?: number
  online?: boolean
  onClick?: () => void
  className?: string
  testId?: string
  /** Story ring: 'unseen' (colourful) or 'seen' (grey). */
  ring?: 'unseen' | 'seen'
}) {
  const bg = useMemo(() => colorFor(name || '?'), [name])
  const initial = (name || '?').trim().slice(0, 1)
  const style = { width: size, height: size, fontSize: Math.max(12, size * 0.38) }
  const inner = photoURL ? (
    <img src={photoURL} alt={name} />
  ) : (
    <span className="fallback" style={{ background: bg }}>{initial}</span>
  )
  const cls = `avatar ${size >= 88 ? 'lg' : ''} ${className}`
  if (ring) {
    return (
      <span className={`story-ring ${ring}`} data-testid={`ring-${ring}`} style={{ width: size + 8, height: size + 8 }}>
        <Avatar name={name} photoURL={photoURL} size={size} online={online} onClick={onClick} className={className} testId={testId} />
      </span>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} data-testid={testId} aria-label={name}>
        {inner}
        {online ? <span className="online-dot" data-testid="online-dot" /> : null}
      </button>
    )
  }
  return (
    <div className={cls} style={style} data-testid={testId}>
      {inner}
      {online ? <span className="online-dot" data-testid="online-dot" /> : null}
    </div>
  )
}

import { IconClose } from './Icons'
import { useT } from '../i18n'

export function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const t = useT()
  return (
    <div className="lightbox" onClick={onClose} data-testid="lightbox" role="dialog">
      <button type="button" className="close icon-btn" onClick={onClose} aria-label={t('common.close')}>
        <IconClose />
      </button>
      <img src={src} alt={alt ?? ''} onClick={(e) => e.stopPropagation()} />
    </div>
  )
}

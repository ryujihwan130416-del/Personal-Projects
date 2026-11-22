import { useState } from 'react'
import { useChatFilter, viewText } from '../lib/chatFilter'
import { FILTER_LEVELS, LEVEL_CATS, USER_CATEGORIES, activeCategories, levelRank, type FilterLevel, type UserFilter } from '../lib/moderation'
import { useT } from '../i18n'

/** Settings → Chat filter. Saved to the account (prefs.filter) and this device. */
export function ChatFilterSettings() {
  const t = useT()
  const { settings, cfg, save } = useChatFilter()
  const [sample, setSample] = useState('')
  const set = (patch: Partial<UserFilter>) => save({ ...settings, ...patch })
  const min = cfg.minLevel
  const level: FilterLevel = levelRank(settings.level) < levelRank(min) ? min : settings.level
  const minCats = new Set(LEVEL_CATS[min])
  const inLevel = new Set(LEVEL_CATS[level])
  const forced = new Set(USER_CATEGORIES.filter((c) => cfg.modes[c] === 'mask'))
  const demo = sample || t('filter.sample')
  const cats = activeCategories({ ...settings, level }, cfg)
  const preview = viewText(demo, settings, cats, new Set([...forced]), cfg)
  return (
    <section className="set-card" data-testid="chat-filter">
      <h3>🧼 {t('filter.title')}</h3>
      <p className="set-sub">{t('filter.sub')}</p>
      <div className="set-row col">
        <span>{t('filter.level')}</span>
        <div className="filter-levels" role="radiogroup" aria-label={t('filter.level')}>
          {FILTER_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={level === l} className={level === l ? 'on' : ''} disabled={levelRank(l) < levelRank(min)}
              onClick={() => set({ level: l })} data-testid={`filter-level-${l}`}>
              {t(`filter.lv.${l}`)}<small>{t(`filter.lvHint.${l}`)}</small>
            </button>
          ))}
        </div>
        {min !== 'off' ? <p className="set-sub" data-testid="filter-min-note">{t('filter.minNote', { level: t(`filter.lv.${min}`) })}</p> : null}
      </div>
      {level !== 'off' ? (
        <div className="set-row col">
          <span>{t('filter.categories')}</span>
          <div className="filter-cats">
            {USER_CATEGORIES.filter((c) => inLevel.has(c)).map((c) => {
              const locked = minCats.has(c) || forced.has(c)
              return (
                <label key={c} className={locked ? 'locked' : ''} title={locked ? t('filter.locked') : undefined}>
                  <input type="checkbox" checked={locked || settings.cats?.[c] !== false} disabled={locked}
                    onChange={(e) => set({ cats: { ...settings.cats, [c]: e.target.checked } })} data-testid={`filter-cat-${c}`} />
                  {t(`filter.cat.${c}`)}{locked ? ' 🔒' : ''}
                </label>
              )
            })}
          </div>
          <p className="set-sub">{t('filter.selfharmNote')}</p>
        </div>
      ) : null}
      <div className="set-row">
        <span>{t('filter.mask')}<small className="set-hint">{t('filter.maskHint')}</small></span>
        <input type="checkbox" className="switch" checked={settings.mask} onChange={(e) => set({ mask: e.target.checked })} data-testid="filter-mask" />
      </div>
      <div className="set-row">
        <span>{t('filter.blur')}<small className="set-hint">{t('filter.blurHint')}</small></span>
        <input type="checkbox" className="switch" checked={settings.blur} onChange={(e) => set({ blur: e.target.checked })} data-testid="filter-blur" />
      </div>
      <div className="set-row col">
        <span>{t('filter.try')}</span>
        <input className="input" value={sample} placeholder={t('filter.sample')} onChange={(e) => setSample(e.target.value)} data-testid="filter-sample" />
        <div className="filter-preview" data-testid="filter-preview">{preview.blur ? <i>{t('filter.hiddenTap')}</i> : preview.text}</div>
      </div>
    </section>
  )
}

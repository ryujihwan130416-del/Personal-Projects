import { LOCALES, useLocale, useT, type Locale } from '../i18n'
import { usePrefs } from '../lib/prefs'

/** Full picker for Settings: one button per language, shown in its own script. Saves to the account + this device. */
export function LanguagePicker() {
  const { locale } = useLocale()
  const { setLang } = usePrefs()
  const t = useT()
  return (
    <div className="lang-grid" role="radiogroup" aria-label={t('settings.language')}>
      {LOCALES.map((l) => (
        <button key={l.id} type="button" role="radio" aria-checked={locale === l.id} lang={l.tag} className={`lang-opt ${locale === l.id ? 'on' : ''}`} data-testid={`lang-${l.id}`} onClick={() => setLang(l.id)}>
          {l.name}
        </button>
      ))}
    </div>
  )
}

/** Compact dropdown for the login screen (no account yet, so it's saved on this device only). */
export function LanguageSelect() {
  const { locale, setLocale } = useLocale()
  const t = useT()
  return (
    <label className="lang-select">
      <span aria-hidden>🌐</span>
      <select value={locale} aria-label={t('settings.language')} data-testid="login-lang" onChange={(e) => setLocale(e.target.value as Locale)}>
        {LOCALES.map((l) => <option key={l.id} value={l.id} lang={l.tag}>{l.name}</option>)}
      </select>
    </label>
  )
}

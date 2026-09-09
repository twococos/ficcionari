import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const current = (i18n.resolvedLanguage ?? 'ca') as SupportedLanguage

  return (
    <div className="flex items-center gap-1 rounded-full bg-primary-dark/30 p-1">
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          aria-pressed={current === lng}
          className={`rounded-full px-3 py-1 text-sm font-bold transition ${
            current === lng ? 'bg-white text-primary' : 'text-white/70 hover:text-white'
          }`}
        >
          {t(`language.${lng}`)}
        </button>
      ))}
    </div>
  )
}

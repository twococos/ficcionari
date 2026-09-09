import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import caUi from './locales/ca/ui.json'
import esUi from './locales/es/ui.json'

export const SUPPORTED_LANGUAGES = ['ca', 'es'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const resources = {
  ca: { ui: caUi },
  es: { ui: esUi },
} as const

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ca',
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: 'ui',
    ns: ['ui'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'ficcionari-lang',
      caches: ['localStorage'],
    },
  })

export default i18n

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
      // Només la preferència desada per l'usuari; si no n'hi ha, cau al
      // fallbackLng ('ca'). Així el català és l'idioma per defecte encara que el
      // navegador estigui en castellà (abans 'navigator' el forçava a 'es').
      order: ['localStorage'],
      lookupLocalStorage: 'ficcionari-lang',
      caches: ['localStorage'],
    },
  })

export default i18n

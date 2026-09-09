import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LanguageDetectorModule } from 'i18next'

import { safeStorage } from '@/lib/safeStorage'
import caUi from './locales/ca/ui.json'
import esUi from './locales/es/ui.json'

export const SUPPORTED_LANGUAGES = ['ca', 'es'] as const
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const resources = {
  ca: { ui: caUi },
  es: { ui: esUi },
} as const

const LANG_KEY = 'ficcionari-lang'

/**
 * Detector d'idioma propi basat en `safeStorage` (no en el detector de
 * localStorage d'i18next). Motius:
 *  - Robustesa: si l'accés a localStorage llança (Firefox Android amb protecció
 *    de seguiment, mode privat…), no peta la càrrega inicial → evita la pàgina
 *    en blanc. `safeStorage` cau a memòria en aquest cas.
 *  - Idioma per defecte català: si no hi ha preferència desada, retornem res i
 *    i18next cau al `fallbackLng` ('ca'), encara que el navegador sigui en
 *    castellà.
 */
const safeDetector: LanguageDetectorModule = {
  type: 'languageDetector',
  detect: () => safeStorage.getItem(LANG_KEY) ?? undefined,
  cacheUserLanguage: (lng) => safeStorage.setItem(LANG_KEY, lng),
}

i18n
  .use(safeDetector)
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
  })

export default i18n

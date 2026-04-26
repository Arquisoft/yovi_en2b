/**
 * i18n configuration using react-i18next + i18next.
 *
 * Install dependencies first:
 *   npm install i18next react-i18next
 *
 * Usage in components:
 *   import { useTranslation } from 'react-i18next'
 *   const { t } = useTranslation()
 *   t('auth.signIn')
 *   t('gameConfig.boardSizeError', { min: 4, max: 16 })
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import es from './es'

// Supported languages
export type SupportedLocale = 'en' | 'es'
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'es']
export const DEFAULT_LOCALE: SupportedLocale = 'en'
const STORAGE_KEY = 'yovi_language'

/** Read the saved locale from localStorage, falling back to browser preference. */
function detectLocale(): SupportedLocale {
  // 1. Explicitly saved preference
  const saved = localStorage.getItem(STORAGE_KEY) as SupportedLocale | null
  if (saved && SUPPORTED_LOCALES.includes(saved)) return saved

  // 2. Browser language (e.g. "es-ES" → "es")
  const browserLang = navigator.language.split('-')[0] as SupportedLocale
  if (SUPPORTED_LOCALES.includes(browserLang)) return browserLang

  return DEFAULT_LOCALE
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: detectLocale(),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: {
      // React already escapes values
      escapeValue: false,
    },
    // Flat key separator — we use nested objects so keep the default '.'
    keySeparator: '.',
  })

/** Persist and switch the active language. */
export function setLocale(locale: SupportedLocale) {
  localStorage.setItem(STORAGE_KEY, locale)
  i18n.changeLanguage(locale)
}

/** Get the currently active locale. */
export function getLocale(): SupportedLocale {
  return (i18n.language as SupportedLocale) ?? DEFAULT_LOCALE
}

export default i18n
/**
 * LanguageContext
 *
 * Wraps i18next with a React context so that:
 *  - any component can read `locale` and `toggleLanguage`
 *  - switching languages re-renders the whole tree without a page reload
 *
 * Place <LanguageProvider> inside <BrowserRouter> but outside any route
 * guards so every page (including the login screen) is covered.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { setLocale, getLocale, SUPPORTED_LOCALES, type SupportedLocale } from './i18n'

interface LanguageContextValue {
  /** Currently active locale, e.g. "en" | "es" */
  locale: SupportedLocale
  /** Toggle between the two supported locales. */
  toggleLanguage: () => void
  /** Directly set a specific locale. */
  setLanguage: (locale: SupportedLocale) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getLocale)

  const setLanguage = useCallback((next: SupportedLocale) => {
    setLocale(next)
    setLocaleState(next)
  }, [])

  const toggleLanguage = useCallback(() => {
    const currentIndex = SUPPORTED_LOCALES.indexOf(locale)
    const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length
    setLanguage(SUPPORTED_LOCALES[nextIndex])
  }, [locale, setLanguage])

  return (
    <LanguageContext.Provider value={{ locale, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
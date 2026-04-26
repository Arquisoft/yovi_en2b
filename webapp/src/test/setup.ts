import '@testing-library/jest-dom'
import { vi } from 'vitest'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en'
import es from '@/i18n/es'

// Provide env vars required by src/config/api.ts before any module loads it.
vi.stubEnv('VITE_USERS_API_URL', 'http://api.localhost/users')
vi.stubEnv('VITE_GAME_API_URL', 'http://api.localhost/game')
vi.stubEnv('VITE_GAME_WS_URL', 'ws://api.localhost/game/ws')

// Initialise i18next with real translations so t('key') returns the English
// string instead of the literal key.
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        es: { translation: es },
      },
      lng: 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    })
}
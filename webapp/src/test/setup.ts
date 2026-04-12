import '@testing-library/jest-dom'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@/i18n/en'
import es from '@/i18n/es'

// Inicializar i18next con los recursos reales antes de cualquier test.
// Esto garantiza que t('chat.noMessages') → 'No messages yet' (no la clave literal),
// preservando todos los tests existentes que buscan strings en inglés.
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
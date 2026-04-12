/**
 * i18n/i18n.test.ts
 *
 * Prueba el módulo de configuración de i18next:
 * - detectLocale: prioridad localStorage → navigator.language → 'en'
 * - setLocale: persiste en localStorage y cambia el idioma
 * - getLocale: refleja el idioma activo
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const STORAGE_KEY = 'yovi_language'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

// Re-importar el módulo forzando una instancia limpia en cada test que lo necesite.
// Usamos importación dinámica para que la función detectLocale() se ejecute de nuevo
// con el estado de localStorage/navigator que dejamos en beforeEach.
async function freshImport() {
  // Invalida el módulo en el registry de Vite/vitest para que se re-ejecute
  vi.resetModules()
  return import('../i18n/i18n')
}

// ─── Tests: setLocale / getLocale ─────────────────────────────────────────────

describe('setLocale / getLocale', () => {
  beforeEach(() => clearStorage())
  afterEach(() => clearStorage())

  it('getLocale returns the current i18next language', async () => {
    const { getLocale, setLocale } = await freshImport()
    setLocale('es')
    expect(getLocale()).toBe('es')
  })

  it('setLocale persists the locale to localStorage', async () => {
    const { setLocale } = await freshImport()
    setLocale('es')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('es')
  })

  it('setLocale back to en persists correctly', async () => {
    const { setLocale } = await freshImport()
    setLocale('es')
    setLocale('en')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('en')
    expect((await freshImport()).getLocale()).toBe('en')
  })
})

// ─── Tests: locale detection ──────────────────────────────────────────────────

describe('detectLocale — localStorage priority', () => {
  afterEach(() => clearStorage())

  it('uses stored locale "es" when present', async () => {
    localStorage.setItem(STORAGE_KEY, 'es')
    const { getLocale } = await freshImport()
    expect(getLocale()).toBe('es')
  })

  it('uses stored locale "en" when present', async () => {
    localStorage.setItem(STORAGE_KEY, 'en')
    const { getLocale } = await freshImport()
    expect(getLocale()).toBe('en')
  })

  it('ignores unsupported stored locale and falls back', async () => {
    localStorage.setItem(STORAGE_KEY, 'fr') // not supported
    const { getLocale, DEFAULT_LOCALE } = await freshImport()
    // Should not be 'fr' — falls back to navigator or default
    expect(['en', 'es']).toContain(getLocale())
    expect(getLocale()).not.toBe('fr')
    // With no navigator mock matching, expect DEFAULT_LOCALE
    expect(getLocale()).toBe(DEFAULT_LOCALE)
  })
})

describe('detectLocale — navigator.language fallback', () => {
  afterEach(() => clearStorage())

  it('uses navigator.language "es" when no storage key', async () => {
    clearStorage()
    Object.defineProperty(navigator, 'language', { value: 'es-ES', configurable: true })
    const { getLocale } = await freshImport()
    expect(getLocale()).toBe('es')
  })

  it('uses navigator.language "en" when no storage key', async () => {
    clearStorage()
    Object.defineProperty(navigator, 'language', { value: 'en-GB', configurable: true })
    const { getLocale } = await freshImport()
    expect(getLocale()).toBe('en')
  })

  it('falls back to "en" when navigator.language is unsupported', async () => {
    clearStorage()
    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true })
    const { getLocale, DEFAULT_LOCALE } = await freshImport()
    expect(getLocale()).toBe(DEFAULT_LOCALE)
  })
})

// ─── Tests: constants ─────────────────────────────────────────────────────────

describe('module constants', () => {
  it('SUPPORTED_LOCALES contains "en" and "es"', async () => {
    const { SUPPORTED_LOCALES } = await freshImport()
    expect(SUPPORTED_LOCALES).toContain('en')
    expect(SUPPORTED_LOCALES).toContain('es')
  })

  it('DEFAULT_LOCALE is "en"', async () => {
    const { DEFAULT_LOCALE } = await freshImport()
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('SUPPORTED_LOCALES has exactly 2 entries', async () => {
    const { SUPPORTED_LOCALES } = await freshImport()
    expect(SUPPORTED_LOCALES).toHaveLength(2)
  })
})
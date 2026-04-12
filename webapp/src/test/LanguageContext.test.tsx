/**
 * i18n/LanguageContext.test.tsx
 *
 * Prueba el contexto React que gestiona el idioma activo:
 * - Estado inicial (locale inicial)
 * - toggleLanguage: alterna entre en ↔ es
 * - setLanguage: establece un idioma directamente
 * - Persistencia en localStorage vía setLocale
 * - Error al usar useLanguage fuera del provider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'

// vi.mock() se hoistea al inicio del fichero, por lo que las importaciones
// de abajo ya reciben la versión mockeada cuando se ejecuta el cuerpo.
import * as i18nModule from '../i18n/i18n'
import { LanguageProvider, useLanguage } from '../i18n/LanguageContext'

const STORAGE_KEY = 'yovi_language'

// ─── Mock de i18n.ts ──────────────────────────────────────────────────────────

vi.mock('../i18n/i18n', () => ({
  SUPPORTED_LOCALES: ['en', 'es'],
  DEFAULT_LOCALE: 'en',
  getLocale: vi.fn(() => 'en' as 'en' | 'es'),
  setLocale: vi.fn((locale: string) => {
    localStorage.setItem(STORAGE_KEY, locale)
  }),
}))

// Referencias tipadas a los fakes — no se usa require() en ningún sitio
const mockGetLocale = vi.mocked(i18nModule.getLocale)
const mockSetLocale = vi.mocked(i18nModule.setLocale)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapper({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  // Estado por defecto: inglés
  mockGetLocale.mockReturnValue('en')
  // clearAllMocks borra las implementaciones, así que la restauramos
  mockSetLocale.mockImplementation((locale: string) => {
    localStorage.setItem(STORAGE_KEY, locale)
  })
})

afterEach(() => {
  localStorage.clear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LanguageContext — initial state', () => {
  it('locale starts as "en" when getLocale returns "en"', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.locale).toBe('en')
  })

  it('locale starts as "es" when getLocale returns "es"', () => {
    mockGetLocale.mockReturnValue('es')
    const { result } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.locale).toBe('es')
  })
})

describe('LanguageContext — toggleLanguage', () => {
  it('toggles from "en" to "es"', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.locale).toBe('en')

    act(() => { result.current.toggleLanguage() })

    expect(result.current.locale).toBe('es')
  })

  it('toggles from "es" back to "en"', () => {
    mockGetLocale.mockReturnValue('es')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.toggleLanguage() })

    expect(result.current.locale).toBe('en')
  })

  it('alternates correctly over multiple toggles', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.toggleLanguage() })
    expect(result.current.locale).toBe('es')

    act(() => { result.current.toggleLanguage() })
    expect(result.current.locale).toBe('en')

    act(() => { result.current.toggleLanguage() })
    expect(result.current.locale).toBe('es')
  })

  it('calls setLocale with the new locale on each toggle', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.toggleLanguage() })
    expect(mockSetLocale).toHaveBeenCalledWith('es')

    act(() => { result.current.toggleLanguage() })
    expect(mockSetLocale).toHaveBeenCalledWith('en')
  })

  it('persists the new locale to localStorage via setLocale', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.toggleLanguage() })

    expect(localStorage.getItem(STORAGE_KEY)).toBe('es')
  })
})

describe('LanguageContext — setLanguage', () => {
  it('sets locale to "es" directly', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.setLanguage('es') })

    expect(result.current.locale).toBe('es')
  })

  it('sets locale to "en" directly when starting from "es"', () => {
    mockGetLocale.mockReturnValue('es')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.setLanguage('en') })

    expect(result.current.locale).toBe('en')
  })

  it('is idempotent — setting the current locale again does not change it', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })
    expect(result.current.locale).toBe('en')

    act(() => { result.current.setLanguage('en') })

    expect(result.current.locale).toBe('en')
  })

  it('calls setLocale with the chosen locale', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.setLanguage('es') })

    expect(mockSetLocale).toHaveBeenCalledWith('es')
  })

  it('persists the chosen locale to localStorage', () => {
    mockGetLocale.mockReturnValue('en')
    const { result } = renderHook(() => useLanguage(), { wrapper })

    act(() => { result.current.setLanguage('es') })

    expect(localStorage.getItem(STORAGE_KEY)).toBe('es')
  })
})

describe('LanguageContext — useLanguage outside provider', () => {
  it('throws a descriptive error', () => {
    expect(() => renderHook(() => useLanguage())).toThrow(
      'useLanguage must be used within a LanguageProvider'
    )
  })
})
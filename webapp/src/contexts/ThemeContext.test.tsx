import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import { ThemeProvider, useTheme } from './ThemeContext'

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
})

describe('ThemeContext — initialization', () => {
  it('defaults to dark when no stored preference', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('dark')
  })

  it('loads stored light theme from localStorage', () => {
    localStorage.setItem('yovi_theme', JSON.stringify('light'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('light')
  })

  it('loads stored dark theme from localStorage', () => {
    localStorage.setItem('yovi_theme', JSON.stringify('dark'))
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('dark')
  })
})

describe('ThemeContext — toggleTheme', () => {
  it('switches from dark to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.toggleTheme() })

    expect(result.current.theme).toBe('light')
  })

  it('switches from light to dark', () => {
    localStorage.setItem('yovi_theme', JSON.stringify('light'))
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.toggleTheme() })

    expect(result.current.theme).toBe('dark')
  })

  it('alternates correctly over multiple toggles', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.toggleTheme() })
    expect(result.current.theme).toBe('light')

    act(() => { result.current.toggleTheme() })
    expect(result.current.theme).toBe('dark')

    act(() => { result.current.toggleTheme() })
    expect(result.current.theme).toBe('light')
  })
})

describe('ThemeContext — setTheme', () => {
  it('sets theme to light directly', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('light') })

    expect(result.current.theme).toBe('light')
  })

  it('sets theme to dark directly', () => {
    localStorage.setItem('yovi_theme', JSON.stringify('light'))
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('dark') })

    expect(result.current.theme).toBe('dark')
  })

  it('is idempotent — setting the current theme again has no side effects', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })
    expect(result.current.theme).toBe('dark')

    act(() => { result.current.setTheme('dark') })

    expect(result.current.theme).toBe('dark')
  })
})

describe('ThemeContext — DOM and storage side effects', () => {
  it('applies the theme class to documentElement on mount', () => {
    renderHook(() => useTheme(), { wrapper })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('replaces the theme class on documentElement when theme changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.toggleTheme() })

    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists the new theme to localStorage when theme changes', () => {
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.setTheme('light') })

    expect(JSON.parse(localStorage.getItem('yovi_theme')!)).toBe('light')
  })

  it('persists dark theme to localStorage', () => {
    localStorage.setItem('yovi_theme', JSON.stringify('light'))
    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => { result.current.toggleTheme() })

    expect(JSON.parse(localStorage.getItem('yovi_theme')!)).toBe('dark')
  })
})

describe('ThemeContext — useTheme outside provider', () => {
  it('throws a descriptive error', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within a ThemeProvider'
    )
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from './useMediaQuery'

type MediaQueryCallback = (event: MediaQueryListEvent) => void

function createMatchMediaMock(matches: boolean) {
  const listeners: MediaQueryCallback[] = []
  const mql = {
    matches,
    addEventListener: vi.fn((_: string, cb: MediaQueryCallback) => listeners.push(cb)),
    removeEventListener: vi.fn((_: string, cb: MediaQueryCallback) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchChange: (newMatches: boolean) => {
      listeners.forEach((cb) => cb({ matches: newMatches } as MediaQueryListEvent))
    },
  }
  return mql
}

let mockMql: ReturnType<typeof createMatchMediaMock>

beforeEach(() => {
  mockMql = createMatchMediaMock(false)
  window.matchMedia = vi.fn().mockReturnValue(mockMql)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useMediaQuery', () => {
  it('returns false when query does not match', () => {
    mockMql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMql)

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('returns true when query matches', () => {
    mockMql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mockMql)

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('updates to true when media query starts matching', () => {
    mockMql = createMatchMediaMock(false)
    window.matchMedia = vi.fn().mockReturnValue(mockMql)

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)

    act(() => { mockMql.dispatchChange(true) })

    expect(result.current).toBe(true)
  })

  it('updates to false when media query stops matching', () => {
    mockMql = createMatchMediaMock(true)
    window.matchMedia = vi.fn().mockReturnValue(mockMql)

    const { result } = renderHook(() => useMediaQuery('(prefers-color-scheme: dark)'))
    expect(result.current).toBe(true)

    act(() => { mockMql.dispatchChange(false) })

    expect(result.current).toBe(false)
  })

  it('removes the event listener on unmount', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    unmount()
    expect(mockMql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-registers listener when query prop changes', () => {
    const { rerender } = renderHook(
      ({ query }: { query: string }) => useMediaQuery(query),
      { initialProps: { query: '(min-width: 768px)' } }
    )
    rerender({ query: '(min-width: 1024px)' })
    // addEventListener should have been called at least twice (initial + re-register)
    expect(mockMql.addEventListener).toHaveBeenCalledTimes(2)
  })
})

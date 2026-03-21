// webapp/src/controllers/useRankingController.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useRankingController } from './useRankingController'
import { useAuth } from '@/contexts/AuthContext'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('useRankingController', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'mock-token',
      user: { id: '1', username: 'PlayerOne', email: 'test@test.com', createdAt: '', updatedAt: '' },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
    })
  })

  it('starts with pve-easy mode selected', () => {
    const { result } = renderHook(() => useRankingController())
    expect(result.current.selectedMode).toBe('pve-easy')
  })

  it('loads entries for pve-easy by default', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.entries.length).toBeGreaterThan(0)
  })

  it('changes mode and loads new entries', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    act(() => result.current.setSelectedMode('pve-hard'))
    await waitFor(() => expect(result.current.selectedMode).toBe('pve-hard'))
    expect(result.current.entries[0].username).toBe('PlayerFive')
  })

  it('returns currentUsername from auth context', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentUsername).toBe('PlayerOne')
  })

  it('returns null currentUsername when no user', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'mock-token',
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
    })
    const { result } = renderHook(() => useRankingController())
    expect(result.current.currentUsername).toBeNull()
  })

  it('entries are ordered by rank', async () => {
    const { result } = renderHook(() => useRankingController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const ranks = result.current.entries.map((e) => e.rank)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
  })

  it('does not load when token is null', () => {
    vi.mocked(useAuth).mockReturnValue({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
    })
    const { result } = renderHook(() => useRankingController())
    expect(result.current.entries).toHaveLength(0)
  })
})
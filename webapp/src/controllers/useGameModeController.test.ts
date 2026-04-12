import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameModeController } from './useGameModeController'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useGameModeController', () => {
  it('navigates to the correct config route for pve', () => {
    const { result } = renderHook(() => useGameModeController())
    act(() => { result.current.handleSelectMode('pve') })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pve')
  })

  it('navigates to the correct config route for pvp-local', () => {
    const { result } = renderHook(() => useGameModeController())
    act(() => { result.current.handleSelectMode('pvp-local') })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pvp-local')
  })

  it('navigates to the correct config route for pvp-online', () => {
    const { result } = renderHook(() => useGameModeController())
    act(() => { result.current.handleSelectMode('pvp-online') })
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/config/pvp-online')
  })
})

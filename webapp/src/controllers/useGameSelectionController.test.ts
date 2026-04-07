import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameSelectionController } from './useGameSelectionController'
import { gameService } from '@/services/gameyService'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@/services/gameyService', () => ({
  gameService: {
    getAvailableGames: vi.fn(),
  },
}))

const mockGames = [
  {
    id: 'game-y',
    name: 'Game Y',
    description: 'A strategy game',
    thumbnail: '/thumb.png',
    minPlayers: 2,
    maxPlayers: 2,
    isAvailable: true,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(gameService.getAvailableGames).mockResolvedValue(mockGames)
})

describe('useGameSelectionController', () => {
  describe('loading games on mount', () => {
    it('loads available games and sets isLoading to false', async () => {
      const { result } = renderHook(() => useGameSelectionController())

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.games).toHaveLength(1)
      expect(result.current.games[0].id).toBe('game-y')
      expect(result.current.error).toBeNull()
    })

    it('sets error when getAvailableGames throws an Error', async () => {
      vi.mocked(gameService.getAvailableGames).mockRejectedValue(
        new Error('Service unavailable')
      )

      const { result } = renderHook(() => useGameSelectionController())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.error).toBe('Service unavailable')
      expect(result.current.games).toHaveLength(0)
    })

    it('sets generic error when getAvailableGames throws a non-Error value', async () => {
      vi.mocked(gameService.getAvailableGames).mockRejectedValue('connection reset')

      const { result } = renderHook(() => useGameSelectionController())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.error).toBe('Failed to load games')
    })
  })

  describe('handlePlayGame', () => {
    it('navigates to /games/y when game-y is selected', async () => {
      const { result } = renderHook(() => useGameSelectionController())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      act(() => { result.current.handlePlayGame('game-y') })

      expect(mockNavigate).toHaveBeenCalledWith('/games/y')
    })

    it('does not navigate when an unknown game id is selected', async () => {
      const { result } = renderHook(() => useGameSelectionController())
      await waitFor(() => expect(result.current.isLoading).toBe(false))

      act(() => { result.current.handlePlayGame('game-x') })

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useGameReplayController } from '@/controllers/useGameReplayController'
import { gameService } from '@/services/gameyService'
import type { GameState } from '@/types'

// ─── Router mocks ─────────────────────────────────────────────────────────────

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useParams: () => ({ gameId: 'game-replay-123' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('@/services/gameyService', () => ({
  gameService: { getGameState: vi.fn() },
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMove(row: number, col: number, player: 'player1' | 'player2') {
  return { row, col, player, timestamp: Date.now() }
}

function makeGame(overrides: Partial<GameState> = {}): GameState {
  return {
    id: 'game-replay-123',
    config: { mode: 'pvp-local', boardSize: 5 as any, timerEnabled: false },
    status: 'finished',
    phase: 'playing',
    board: [],
    players: {
      player1: { id: 'p1', name: 'Alice', color: 'player1' },
      player2: { id: 'p2', name: 'Bob', color: 'player2' },
    },
    currentTurn: 'player1',
    moves: [
      makeMove(0, 0, 'player1'),
      makeMove(1, 0, 'player2'),
      makeMove(2, 0, 'player1'),
    ],
    winner: 'player1',
    timer: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
  vi.mocked(gameService.getGameState).mockResolvedValue(makeGame())
})

// ─── Loading & error ──────────────────────────────────────────────────────────

describe('useGameReplayController — loading & error', () => {
  it('starts with isLoading true', () => {
    const { result } = renderHook(() => useGameReplayController())
    expect(result.current.isLoading).toBe(true)
  })

  it('sets isLoading false after data loads', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
  })

  it('calls getGameState with the gameId from params', async () => {
    renderHook(() => useGameReplayController())
    await waitFor(() => expect(gameService.getGameState).toHaveBeenCalledWith('game-replay-123'))
  })

  it('sets error when game is not found', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValueOnce(null)
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Game not found')
    expect(result.current.game).toBeNull()
  })

  it('sets error message when service throws', async () => {
    vi.mocked(gameService.getGameState).mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Network error')
  })

  it('sets generic error for non-Error rejections', async () => {
    vi.mocked(gameService.getGameState).mockRejectedValueOnce('timeout')
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe('Failed to load game')
  })
})

// ─── Initial step ─────────────────────────────────────────────────────────────

describe('useGameReplayController — initial step', () => {
  it('initial step equals totalMoves (final position)', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.step).toBe(3)
  })

  it('totalMoves matches the game moves array length', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.totalMoves).toBe(3)
  })

  it('boardAtStep is not null after load', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.boardAtStep).not.toBeNull()
  })

  it('currentMove is the last move at the final step', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.currentMove).toMatchObject({ row: 2, col: 0, player: 'player1' })
  })

  it('starts at step 0 for a game with no moves', async () => {
    vi.mocked(gameService.getGameState).mockResolvedValueOnce(makeGame({ moves: [] }))
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.step).toBe(0)
    expect(result.current.currentMove).toBeNull()
  })
})

// ─── Navigation flags ─────────────────────────────────────────────────────────

describe('useGameReplayController — navigation flags', () => {
  it('canGoBack is false at step 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    expect(result.current.canGoBack).toBe(false)
  })

  it('canGoForward is false at the final step', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Already at final step (3)
    expect(result.current.canGoForward).toBe(false)
  })

  it('canGoBack is true when step > 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => result.current.goForward())
    expect(result.current.canGoBack).toBe(true)
  })

  it('canGoForward is true when step < totalMoves', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    expect(result.current.canGoForward).toBe(true)
  })
})

// ─── Step navigation ──────────────────────────────────────────────────────────

describe('useGameReplayController — step navigation', () => {
  it('goBack decrements step by 1', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goBack())
    expect(result.current.step).toBe(2)
  })

  it('goBack does not go below 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => result.current.goBack())
    expect(result.current.step).toBe(0)
  })

  it('goForward increments step by 1', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => result.current.goForward())
    expect(result.current.step).toBe(1)
  })

  it('goForward does not exceed totalMoves', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    // Already at end (step 3)
    act(() => result.current.goForward())
    expect(result.current.step).toBe(3)
  })

  it('goToStart sets step to 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    expect(result.current.step).toBe(0)
  })

  it('goToEnd sets step to totalMoves', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => result.current.goToEnd())
    expect(result.current.step).toBe(3)
  })

  it('setStep accepts an arbitrary valid value', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.setStep(2))
    expect(result.current.step).toBe(2)
  })

  it('currentMove is null at step 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    expect(result.current.currentMove).toBeNull()
  })

  it('currentMove is the move played to reach the current step', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.setStep(1))
    expect(result.current.currentMove).toMatchObject({ row: 0, col: 0, player: 'player1' })
  })

})

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('useGameReplayController — keyboard navigation', () => {
  it('ArrowLeft decrements step', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })))
    expect(result.current.step).toBe(2)
  })

  it('ArrowRight increments step', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })))
    expect(result.current.step).toBe(1)
  })

  it('Home key goes to step 0', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' })))
    expect(result.current.step).toBe(0)
  })

  it('End key goes to totalMoves', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToStart())
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' })))
    expect(result.current.step).toBe(3)
  })

  it('irrelevant keys are ignored', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const stepBefore = result.current.step
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })))
    expect(result.current.step).toBe(stepBefore)
  })

  it('removes keyboard listener on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(gameService.getGameState).toHaveBeenCalled())
    unmount()
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
  })
})

// ─── goToHistory ──────────────────────────────────────────────────────────────

describe('useGameReplayController — goToHistory', () => {
  it('navigates to /history', async () => {
    const { result } = renderHook(() => useGameReplayController())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    act(() => result.current.goToHistory())
    expect(mockNavigate).toHaveBeenCalledWith('/history')
  })
})
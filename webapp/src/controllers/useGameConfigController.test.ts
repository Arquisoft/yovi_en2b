import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGameConfigController } from './useGameConfigController'
import { useAuth } from '@/contexts/AuthContext'
import { gameService } from '@/services/gameyService'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('@/services/gameyService', () => ({
  gameService: { createGame: vi.fn() },
}))

const mockNavigate = vi.fn()
let mockMode = 'pve'

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ mode: mockMode }),
}))

const mockUser = {
  id: 'user-1',
  username: 'TestUser',
  email: 'test@example.com',
  createdAt: '',
  updatedAt: '',
}

function makeAuthMock(overrides: Record<string, unknown> = {}) {
  return {
    user: mockUser,
    token: 'mock-token',
    isAuthenticated: true,
    isGuest: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    loginAsGuest: vi.fn(),
    logout: vi.fn(),
    updateProfile: vi.fn(),
    ...overrides,
  }
}

const mockGameState = {
  id: 'game-abc',
  status: 'playing',
  currentTurn: 'player1',
  winner: null,
  moves: [],
  board: [],
  config: { mode: 'pve', boardSize: 9, timerEnabled: false },
  players: {
    player1: { id: 'user-1', name: 'TestUser', color: 'player1' },
    player2: { id: 'bot', name: 'Bot', color: 'player2', isBot: true },
  },
  timer: null,
  createdAt: '',
  updatedAt: '',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMode = 'pve'
  sessionStorage.clear()
  vi.mocked(useAuth).mockReturnValue(makeAuthMock() as any)
  vi.mocked(gameService.createGame).mockResolvedValue(mockGameState as any)
})

describe('useGameConfigController', () => {
  describe('initial state', () => {
    it('starts with default board size 9 and timer disabled', () => {
      const { result } = renderHook(() => useGameConfigController())
      expect(result.current.boardSizeInput).toBe('9')
      expect(result.current.timerEnabled).toBe(false)
      expect(result.current.botLevel).toBe('medium')
      expect(result.current.playerColor).toBe('player1')
    })

    it('exposes the correct board size range constants', () => {
      const { result } = renderHook(() => useGameConfigController())
      expect(result.current.boardMin).toBe(4)
      expect(result.current.boardMax).toBe(16)
      expect(result.current.timerMin).toBe(1)
      expect(result.current.timerMax).toBe(20)
    })
  })

  describe('validation — boardSizeError', () => {
    it('boardSizeError is null for a valid board size', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => { result.current.setBoardSizeInput('9') })
      expect(result.current.boardSizeError).toBeNull()
    })

    it('boardSizeError is set when board size is out of range', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => { result.current.setBoardSizeInput('99') })
      expect(result.current.boardSizeError).toMatch(/4/)
      expect(result.current.boardSizeError).toMatch(/16/)
    })

    it('boardSizeError is null when input is empty (not yet typed)', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => { result.current.setBoardSizeInput('') })
      expect(result.current.boardSizeError).toBeNull()
    })

    it('parsedBoardSize is null for invalid input', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => { result.current.setBoardSizeInput('abc') })
      expect(result.current.parsedBoardSize).toBeNull()
    })
  })

  describe('validation — timerError', () => {
    it('timerError is null when timer is disabled regardless of input', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => {
        result.current.setTimerEnabled(false)
        result.current.setTimerInput('99')
      })
      expect(result.current.timerError).toBeNull()
    })

    it('timerError is set when timer is enabled and value is out of range', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => {
        result.current.setTimerEnabled(true)
        result.current.setTimerInput('99')
      })
      expect(result.current.timerError).toMatch(/1/)
      expect(result.current.timerError).toMatch(/20/)
    })

    it('timerError is null when timer is enabled and value is valid', async () => {
      const { result } = renderHook(() => useGameConfigController())
      act(() => {
        result.current.setTimerEnabled(true)
        result.current.setTimerInput('10')
      })
      expect(result.current.timerError).toBeNull()
    })
  })

  describe('handleStartGame', () => {
    it('calls createGame with correct config and navigates to the game', async () => {
      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(gameService.createGame).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'pve',
          boardSize: 9,
          timerEnabled: false,
          botLevel: 'medium',
          playerColor: 'player1',
        }),
        'mock-token',
        undefined
      )

      expect(mockNavigate).toHaveBeenCalledWith('/games/y/play/game-abc')
    })

    it('sets error and does not navigate when board size is invalid', async () => {
      const { result } = renderHook(() => useGameConfigController())

      act(() => { result.current.setBoardSizeInput('99') })

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(gameService.createGame).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(result.current.error).toMatch(/4/)
    })

    it('sets error and does not navigate when timer is enabled with invalid value', async () => {
      const { result } = renderHook(() => useGameConfigController())

      act(() => {
        result.current.setTimerEnabled(true)
        result.current.setTimerInput('99')
      })

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(gameService.createGame).not.toHaveBeenCalled()
      expect(result.current.error).toMatch(/1/)
    })

    it('omits botLevel and playerColor for non-pve modes', async () => {
      mockMode = 'pvp-local'
      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      const config = vi.mocked(gameService.createGame).mock.calls[0][0]
      expect(config.botLevel).toBeUndefined()
      expect(config.playerColor).toBeUndefined()
    })

    it('includes timerSeconds when timer is enabled', async () => {
      const { result } = renderHook(() => useGameConfigController())

      act(() => {
        result.current.setTimerEnabled(true)
        result.current.setTimerInput('5')
      })

      await act(async () => {
        await result.current.handleStartGame()
      })

      const config = vi.mocked(gameService.createGame).mock.calls[0][0]
      expect(config.timerEnabled).toBe(true)
      expect(config.timerSeconds).toBe(5 * 60)
    })

    it('passes undefined token and guestId for guest users', async () => {
      const guestUser = { ...mockUser, id: 'guest-xyz', username: 'Guest' }
      vi.mocked(useAuth).mockReturnValue(
        makeAuthMock({ user: guestUser, token: 'guest', isGuest: true }) as any
      )

      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(gameService.createGame).toHaveBeenCalledWith(
        expect.anything(),
        undefined,   // token is undefined for guests
        'guest-xyz'  // guestId is user.id
      )
    })

    it('sets error and does not navigate when createGame throws', async () => {
      vi.mocked(gameService.createGame).mockRejectedValue(new Error('Server error'))

      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(result.current.error).toBe('Server error')
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
    })

    it('sets generic error when createGame throws a non-Error value', async () => {
      vi.mocked(gameService.createGame).mockRejectedValue('timeout')

      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(result.current.error).toBe('Failed to start game')
    })

    it('sets isLoading true during game creation and false when done', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resolveCreate!: (v: any) => void
      vi.mocked(gameService.createGame).mockReturnValue(
        new Promise((resolve) => { resolveCreate = resolve })
      )

      const { result } = renderHook(() => useGameConfigController())

      act(() => { result.current.handleStartGame() })
      expect(result.current.isLoading).toBe(true)

      await act(async () => { resolveCreate(mockGameState) })
      expect(result.current.isLoading).toBe(false)
    })

    it('returns early without calling createGame when user is null', async () => {
      vi.mocked(useAuth).mockReturnValue(makeAuthMock({ user: null }) as any)

      const { result } = renderHook(() => useGameConfigController())

      await act(async () => {
        await result.current.handleStartGame()
      })

      expect(gameService.createGame).not.toHaveBeenCalled()
    })
  })

  describe('sessionStorage persistence', () => {
    it('saves config to sessionStorage when a game starts', async () => {
      const { result } = renderHook(() => useGameConfigController())

      act(() => {
        result.current.setBoardSizeInput('7')
        result.current.setBotLevel('hard')
      })

      await act(async () => {
        await result.current.handleStartGame()
      })

      const stored = JSON.parse(sessionStorage.getItem('yovi_config_pve') ?? '{}')
      expect(stored.boardSizeInput).toBe('7')
      expect(stored.botLevel).toBe('hard')
    })

    it('re-hydrates defaults from sessionStorage on mount', () => {
      sessionStorage.setItem('yovi_config_pve', JSON.stringify({
        boardSizeInput: '13',
        timerInput: '5',
        timerEnabled: true,
        botLevel: 'easy',
        playerColor: 'player2',
      }))

      const { result } = renderHook(() => useGameConfigController())

      expect(result.current.boardSizeInput).toBe('13')
      expect(result.current.timerEnabled).toBe(true)
      expect(result.current.botLevel).toBe('easy')
      expect(result.current.playerColor).toBe('player2')
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameConfigPage } from '@/pages/GameConfigPage'
import { useGameConfigController } from '@/controllers/useGameConfigController'

vi.mock('@/controllers/useGameConfigController', () => ({ useGameConfigController: vi.fn() }))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'pve',
    boardSizeInput: '9',
    setBoardSizeInput: vi.fn(),
    boardSizeError: null,
    parsedBoardSize: 9,
    timerInput: '10',
    setTimerInput: vi.fn(),
    timerError: null,
    parsedTimerMinutes: 10,
    timerEnabled: false,
    setTimerEnabled: vi.fn(),
    botLevel: 'medium',
    setBotLevel: vi.fn(),
    playerColor: 'player1',
    setPlayerColor: vi.fn(),
    isLoading: false,
    error: null,
    handleStartGame: vi.fn(),
    boardMin: 4,
    boardMax: 16,
    timerMin: 1,
    timerMax: 20,
    ...overrides,
  }
}

function renderPage(overrides: Record<string, unknown> = {}) {
  vi.mocked(useGameConfigController).mockReturnValue(makeController(overrides) as any)
  return render(<GameConfigPage />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
})

describe('GameConfigPage', () => {
  describe('mode title', () => {
    it('shows "vs Computer" for pve mode', () => {
      renderPage({ mode: 'pve' })
      expect(screen.getByText('vs Computer')).toBeInTheDocument()
    })

    it('shows "Local Match" for pvp-local mode', () => {
      renderPage({ mode: 'pvp-local' })
      expect(screen.getByText('Local Match')).toBeInTheDocument()
    })

    it('shows "Game Setup" for unknown mode', () => {
      renderPage({ mode: undefined })
      expect(screen.getByText('Game Setup')).toBeInTheDocument()
    })
  })

  describe('board size', () => {
    it('renders the board size input with current value', () => {
      renderPage({ boardSizeInput: '9' })
      expect(screen.getByRole('spinbutton', { name: /board size/i })).toHaveValue(9)
    })

    it('shows "9 × 9" when parsedBoardSize is 9', () => {
      renderPage({ parsedBoardSize: 9 })
      expect(screen.getByText('9 × 9')).toBeInTheDocument()
    })

    it('shows "— × —" when parsedBoardSize is null', () => {
      renderPage({ parsedBoardSize: null })
      expect(screen.getByText('— × —')).toBeInTheDocument()
    })

    it('shows board size error message when boardSizeError is set', () => {
      renderPage({ boardSizeError: 'Must be a whole number between 4 and 16' })
      expect(screen.getByText('Must be a whole number between 4 and 16')).toBeInTheDocument()
    })

    it('disables Start Game button when boardSizeError is set', () => {
      renderPage({ boardSizeError: 'Invalid board size', boardSizeInput: '99' })
      expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled()
    })

    it('disables Start Game button when boardSizeInput is empty', () => {
      renderPage({ boardSizeInput: '', parsedBoardSize: null })
      expect(screen.getByRole('button', { name: /start game/i })).toBeDisabled()
    })
  })

  describe('bot options (pve only)', () => {
    it('shows Bot Difficulty and Your Color selects for pve mode', () => {
      renderPage({ mode: 'pve' })
      expect(screen.getByLabelText('Bot Difficulty')).toBeInTheDocument()
      expect(screen.getByLabelText('Your Color')).toBeInTheDocument()
    })

    it('hides bot options for pvp-local mode', () => {
      renderPage({ mode: 'pvp-local' })
      expect(screen.queryByLabelText('Bot Difficulty')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Your Color')).not.toBeInTheDocument()
    })
  })

  describe('timer', () => {
    it('renders the Enable Timer toggle', () => {
      renderPage()
      expect(screen.getByLabelText('Enable Timer')).toBeInTheDocument()
    })

    it('hides timer input when timer is disabled', () => {
      renderPage({ timerEnabled: false })
      expect(screen.queryByLabelText('Time per Player')).not.toBeInTheDocument()
    })

    it('shows timer input and error when timer is enabled', () => {
      renderPage({
        timerEnabled: true,
        timerError: 'Must be a whole number between 1 and 20',
      })
      expect(screen.getByLabelText('Time per Player')).toBeInTheDocument()
      expect(screen.getByText('Must be a whole number between 1 and 20')).toBeInTheDocument()
    })

    it('shows "minute" (singular) when parsedTimerMinutes is 1', () => {
      renderPage({ timerEnabled: true, timerInput: '1', parsedTimerMinutes: 1 })
      expect(screen.getByText('minute')).toBeInTheDocument()
    })

    it('shows "minutes" (plural) when parsedTimerMinutes is greater than 1', () => {
      renderPage({ timerEnabled: true, timerInput: '5', parsedTimerMinutes: 5 })
      expect(screen.getByText('minutes')).toBeInTheDocument()
    })
  })

  describe('error and loading', () => {
    it('shows server error message when error is set', () => {
      renderPage({ error: 'Failed to start game' })
      expect(screen.getByText('Failed to start game')).toBeInTheDocument()
    })
  })

  describe('actions', () => {
    it('calls handleStartGame when Start Game is clicked', () => {
      const handleStartGame = vi.fn()
      renderPage({ handleStartGame })
      fireEvent.click(screen.getByRole('button', { name: /start game/i }))
      expect(handleStartGame).toHaveBeenCalledOnce()
    })

    it('navigates to /games/y when Back button is clicked', () => {
      renderPage()
      fireEvent.click(screen.getByRole('button', { name: /back/i }))
      expect(mockNavigate).toHaveBeenCalledWith('/games/y')
    })
  })
})

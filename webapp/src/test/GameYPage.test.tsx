import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameYPage } from '@/pages/GameYPage'

// ─── Mocks ────────────────────────────────────────────────────────────────

// Mock controller
vi.mock('@/controllers/useGameYController', () => ({
  useGameYController: vi.fn(),
}))

// Mock components
vi.mock('@/components/game-y/GameYBoard', () => ({
  GameYBoard: (props: any) => (
    <div data-testid="board" onClick={() => props.onCellClick?.(0, 0)}>
      Board
    </div>
  ),
}))

vi.mock('@/components/game-y/GameSidebar', () => ({
  GameSidebar: (props: any) => (
    <div data-testid="sidebar">
      Sidebar
      <button onClick={props.onSurrender}>Surrender</button>
      <button onClick={props.onPlayAgain}>PlayAgain</button>
    </div>
  ),
}))

vi.mock('@/components/game-y/GameOverlay', () => ({
  GameOverlay: (props: any) => (
    <div data-testid="overlay">
      Overlay
      <button onClick={props.onPlayAgain}>OverlayPlayAgain</button>
      <button onClick={props.onGoHome}>GoHome</button>
    </div>
  ),
}))

// Mock media query
vi.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
}))

// Mock navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Imports AFTER mocks
import { useGameYController } from '@/controllers/useGameYController'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// ─── Helpers ──────────────────────────────────────────────────────────────

const baseController = {
  game: { id: '1' },
  liveTimer: null,
  chatMessages: [],
  isLoading: false,
  error: null,
  lastMove: null,
  canPlay: true,
  handleCellClick: vi.fn(),
  handleSurrender: vi.fn(),
  handleSendMessage: vi.fn(),
  handlePlayAgain: vi.fn(),
  currentUserId: 'user-1',
}

function setup({
  controller = {},
  mobile = false,
}: {
  controller?: any
  mobile?: boolean
} = {}) {
  ;(useGameYController as any).mockReturnValue({
    ...baseController,
    ...controller,
  })

  ;(useMediaQuery as any).mockReturnValue(mobile)

  return render(<GameYPage />)
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('GameYPage — states', () => {
  it('shows loading', () => {
    setup({ controller: { isLoading: true } })
    expect(screen.getByText('Loading game...')).toBeDefined()
  })

  it('shows error', () => {
    setup({ controller: { error: 'Boom' } })
    expect(screen.getByText('Boom')).toBeDefined()
  })

  it('shows "Game not found" when no game', () => {
    setup({ controller: { game: null } })
    expect(screen.getByText('Game not found')).toBeDefined()
  })
})

describe('GameYPage — desktop', () => {
  it('renders board and sidebar', () => {
    setup()

    expect(screen.getByTestId('board')).toBeDefined()
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })

 
  it('calls handleCellClick when board clicked', () => {
    const handleCellClick = vi.fn()
    setup({ controller: { handleCellClick } })

    fireEvent.click(screen.getByTestId('board'))
    expect(handleCellClick).toHaveBeenCalled()
  })
})

describe('GameYPage — mobile', () => {
  it('renders mobile layout', () => {
    setup({ mobile: true })

    expect(screen.getByTestId('board')).toBeDefined()
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })

  
})

describe('GameYPage — overlay actions', () => {
  it('calls play again from overlay', () => {
    const handlePlayAgain = vi.fn()
    setup({ controller: { handlePlayAgain } })

    fireEvent.click(screen.getByText('OverlayPlayAgain'))
    expect(handlePlayAgain).toHaveBeenCalled()
  })

  it('navigates home from overlay', () => {
    setup()

    fireEvent.click(screen.getByText('GoHome'))
    expect(mockNavigate).toHaveBeenCalledWith('/games')
  })
})

describe('GameYPage — sidebar actions', () => {
  it('calls surrender', () => {
    const handleSurrender = vi.fn()
    setup({ controller: { handleSurrender } })

    fireEvent.click(screen.getByText('Surrender'))
    expect(handleSurrender).toHaveBeenCalled()
  })

  it('calls play again from sidebar', () => {
    const handlePlayAgain = vi.fn()
    setup({ controller: { handlePlayAgain } })

    fireEvent.click(screen.getByText('PlayAgain'))
    expect(handlePlayAgain).toHaveBeenCalled()
  })
})
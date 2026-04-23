import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GameHistoryPage } from '@/pages/GameHistoryPage'
import { useGameHistoryController } from '@/controllers/useGameHistoryController'

vi.mock('@/controllers/useGameHistoryController', () => ({
  useGameHistoryController: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSummary(overrides = {}) {
  return {
    id: 'g1',
    config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false },
    status: 'finished',
    phase: 'playing',
    players: {
      player1: { id: 'u1', name: 'Alice', color: 'player1' },
      player2: { id: 'u2', name: 'Bob', color: 'player2' },
    },
    winner: 'player1',
    moveCount: 10,
    createdAt: new Date('2026-01-15T10:00:00Z').toISOString(),
    updatedAt: new Date('2026-01-15T10:05:00Z').toISOString(),
    ...overrides,
  }
}

function makeController(overrides = {}) {
  return {
    games: [makeSummary()],
    isLoading: false,
    error: null,
    isGuest: false,
    ...overrides,
  }
}

function renderPage(controllerOverrides = {}) {
  vi.mocked(useGameHistoryController).mockReturnValue(
    makeController(controllerOverrides) as any
  )
  return render(
    <MemoryRouter>
      <GameHistoryPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockNavigate.mockReset()
})

// ─── Header & chrome ──────────────────────────────────────────────────────────

describe('GameHistoryPage — header', () => {
  it('renders the page title', () => {
    renderPage()
    expect(screen.getByText('Game History')).toBeDefined()
  })

  it('renders the back button', () => {
    renderPage()
    expect(screen.getByText('Back')).toBeDefined()
  })

  it('calls navigate(-1) when back button is clicked', () => {
    renderPage()
    fireEvent.click(screen.getByText('Back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})

// ─── Loading state ────────────────────────────────────────────────────────────

describe('GameHistoryPage — loading', () => {
  it('shows a spinner when isLoading is true', () => {
    renderPage({ isLoading: true, games: [] })
    expect(
      document.querySelector('.animate-spin')
    ).not.toBeNull()
  })

  it('does not render the table while loading', () => {
    renderPage({ isLoading: true, games: [] })
    expect(screen.queryByText('Date')).toBeNull()
  })
})

// ─── Error state ──────────────────────────────────────────────────────────────

describe('GameHistoryPage — error', () => {
  it('displays the error message', () => {
    renderPage({ error: 'Service unavailable', games: [] })
    expect(screen.getByText('Service unavailable')).toBeDefined()
  })

  it('does not render the table on error', () => {
    renderPage({ error: 'Service unavailable', games: [] })
    expect(screen.queryByText('Date')).toBeNull()
  })
})

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('GameHistoryPage — empty state', () => {
  it('shows empty state message when games list is empty', () => {
    renderPage({ games: [] })
    expect(screen.getByText('No games played yet.')).toBeDefined()
  })

  it('does not show the table when games list is empty', () => {
    renderPage({ games: [] })
    expect(screen.queryByText('Date')).toBeNull()
  })
})

// ─── Table rendering ──────────────────────────────────────────────────────────

describe('GameHistoryPage — table', () => {
  it('renders table column headers', () => {
    renderPage()
    expect(screen.getByText('Date')).toBeDefined()
    expect(screen.getByText('Mode')).toBeDefined()
    expect(screen.getByText('Opponent')).toBeDefined()
    expect(screen.getByText('Result')).toBeDefined()
  })

  it('renders a row for each game', () => {
    renderPage({
      games: [
        makeSummary({ id: 'g1' }),
        makeSummary({ id: 'g2', winner: 'player2' }),
      ],
    })
    // Two "Replay" buttons = two rows
    expect(screen.getAllByText('Replay')).toHaveLength(2)
  })

  it('displays the opponent name', () => {
    renderPage()
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('shows "Win" badge when the authenticated user won', () => {
    renderPage()
    expect(screen.getByText('Win')).toBeDefined()
  })

  it('shows "Loss" badge when the authenticated user lost', () => {
    renderPage({
      games: [makeSummary({ winner: 'player2' })],
    })
    expect(screen.getByText('Loss')).toBeDefined()
  })

  it('shows "Draw" badge when there is no winner', () => {
    renderPage({
      games: [makeSummary({ winner: null })],
    })
    expect(screen.getByText('Draw')).toBeDefined()
  })

  it('shows mode chip for pvp-local', () => {
    renderPage()
    expect(screen.getByText('Local')).toBeDefined()
  })

  it('shows mode chip for pve', () => {
    renderPage({
      games: [makeSummary({ config: { mode: 'pve', boardSize: 9, timerEnabled: false } })],
    })
    expect(screen.getByText('vs Bot')).toBeDefined()
  })

  it('shows mode chip for pvp-online', () => {
    renderPage({
      games: [makeSummary({ config: { mode: 'pvp-online', boardSize: 9, timerEnabled: false } })],
    })
    expect(screen.getByText('Online')).toBeDefined()
  })
})

// ─── Replay button ────────────────────────────────────────────────────────────

describe('GameHistoryPage — replay action', () => {
  it('clicking Replay navigates to the replay page', () => {
    renderPage()
    fireEvent.click(screen.getByText('Replay'))
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/replay/g1')
  })

  it('Replay button is disabled when moveCount is 0', () => {
    renderPage({ games: [makeSummary({ moveCount: 0 })] })
    const btn = screen.getByText('Replay').closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('Replay button is enabled when moveCount > 0', () => {
    renderPage()
    const btn = screen.getByText('Replay').closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })
})

// ─── Active game (resume) ─────────────────────────────────────────────────────

describe('GameHistoryPage — active game', () => {
  it('shows "Resume" button instead of "Replay" for an active game', () => {
    renderPage({ games: [makeSummary({ status: 'playing', winner: null })] })
    expect(screen.queryByText('Replay')).toBeNull()
    expect(screen.getByText('Resume')).toBeDefined()
  })

  it('clicking Resume navigates to the game page', () => {
    renderPage({ games: [makeSummary({ id: 'g1', status: 'playing', winner: null })] })
    fireEvent.click(screen.getByText('Resume'))
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/g1')
  })

  it('shows "In progress" badge instead of a result badge for an active game', () => {
    renderPage({ games: [makeSummary({ status: 'playing', winner: null })] })
    expect(screen.getByText('In progress')).toBeDefined()
    expect(screen.queryByText('Win')).toBeNull()
    expect(screen.queryByText('Loss')).toBeNull()
    expect(screen.queryByText('Draw')).toBeNull()
  })

  it('finished games still show Replay and not Resume', () => {
    renderPage({ games: [makeSummary({ status: 'finished', winner: 'player1' })] })
    expect(screen.getByText('Replay')).toBeDefined()
    expect(screen.queryByText('Resume')).toBeNull()
  })

  it('shows Resume for active game mixed with Replay for finished game', () => {
    renderPage({
      games: [
        makeSummary({ id: 'g1', status: 'playing', winner: null }),
        makeSummary({ id: 'g2', status: 'finished', winner: 'player1' }),
      ],
    })
    expect(screen.getByText('Resume')).toBeDefined()
    expect(screen.getByText('Replay')).toBeDefined()
  })

  it('Resume navigates to the correct game when multiple games are listed', () => {
    renderPage({
      games: [
        makeSummary({ id: 'active-game', status: 'playing', winner: null }),
        makeSummary({ id: 'finished-game', status: 'finished', winner: 'player1' }),
      ],
    })
    fireEvent.click(screen.getByText('Resume'))
    expect(mockNavigate).toHaveBeenCalledWith('/games/y/active-game')
  })
})

// ─── Guest upsell ─────────────────────────────────────────────────────────────

describe('GameHistoryPage — guest view', () => {
  it('renders the upsell heading for guests', () => {
    renderPage({ isGuest: true, games: [] })
    expect(screen.getByText('Track Your Progress')).toBeDefined()
  })

  it('does not render the table for guests', () => {
    renderPage({ isGuest: true, games: [] })
    expect(screen.queryByText('Date')).toBeNull()
    expect(screen.queryByText('Replay')).toBeNull()
  })

  it('shows Create Account button for guests', () => {
    renderPage({ isGuest: true, games: [] })
    expect(screen.getByText('Create Account')).toBeDefined()
  })

  it('shows Sign In button for guests', () => {
    renderPage({ isGuest: true, games: [] })
    expect(screen.getByText('Sign In')).toBeDefined()
  })

  it('navigates to /register when Create Account is clicked', () => {
    renderPage({ isGuest: true, games: [] })
    fireEvent.click(screen.getByText('Create Account'))
    expect(mockNavigate).toHaveBeenCalledWith('/register')
  })

  it('navigates to /login when Sign In is clicked', () => {
    renderPage({ isGuest: true, games: [] })
    fireEvent.click(screen.getByText('Sign In'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
  })

  it('still shows the page title and back button for guests', () => {
    renderPage({ isGuest: true, games: [] })
    expect(screen.getByText('Game History')).toBeDefined()
    expect(screen.getByText('Back')).toBeDefined()
  })
})
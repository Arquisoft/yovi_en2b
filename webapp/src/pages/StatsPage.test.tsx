import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StatsPage } from './StatsPage'
import { useStatsController } from '@/controllers/useStatsController'

vi.mock('@/controllers/useStatsController', () => ({
  useStatsController: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockHistory = [
  {
    id: '1',
    opponentName: 'Bot (medium)',
    result: 'win' as const,
    durationSeconds: 142,
    playedAt: new Date().toISOString(),
  },
  {
    id: '2',
    opponentName: 'PlayerTwo',
    result: 'loss' as const,
    durationSeconds: 87,
    playedAt: new Date().toISOString(),
  },
]

const mockStats = {
  overall: { wins: 8, losses: 4 },
  recent:  { wins: 3, losses: 2 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

/**
 * Build a complete controller return value.
 * isGuest defaults to false (authenticated user) so existing tests keep working
 * without needing to specify it every time.
 */
function makeControllerMock(overrides: Record<string, unknown> = {}) {
  return {
    history:   mockHistory,
    stats:     mockStats,
    isLoading: false,
    error:     null,
    isGuest:   false, // ← required — StatsPage reads this to branch rendering
    ...overrides,
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useStatsController).mockReturnValue(makeControllerMock() as any)
})

// ── Original tests (unchanged logic, mocks now include isGuest) ───────────────

describe('StatsPage — authenticated user view', () => {
  it('renders the page title', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Statistics')).toBeDefined()
  })

  it('renders the winrate section', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Winrate')).toBeDefined()
  })

  it('renders both pie chart titles', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Overall')).toBeDefined()
    expect(screen.getByText('Last 20 games')).toBeDefined()
  })

  it('renders match history section', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Match History')).toBeDefined()
  })

  it('renders opponent names from history', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Bot (medium)')).toBeDefined()
    expect(screen.getByText('PlayerTwo')).toBeDefined()
  })

  it('shows loading spinner when isLoading is true', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isLoading: true }) as any,
    )
    const { container } = renderWithRouter(<StatsPage />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('does not render winrate charts when stats is null', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ stats: null }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.queryByText('Winrate')).toBeNull()
  })

  it('renders empty history message when no matches', async () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [] }) as any,
    )
    renderWithRouter(<StatsPage />)
    await waitFor(() => {
      expect(screen.getByText('No matches played yet')).toBeDefined()
    })
  })

  it('renders back button', () => {
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Back')).toBeDefined()
  })
})

// ── NEW: guest-mode view tests ────────────────────────────────────────────────

describe('StatsPage — guest user view', () => {
  /**
   * When isGuest is true StatsPage renders a promotional card to encourage
   * account creation instead of showing empty charts.
   */
  it('renders the "Track Your Progress" upsell heading for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Track Your Progress')).toBeDefined()
  })

  /**
   * Guests should never see the Winrate card — they have no match history.
   */
  it('does not render the Winrate section for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.queryByText('Winrate')).toBeNull()
  })

  /**
   * The Match History card must also be absent for guests.
   */
  it('does not render the Match History section for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.queryByText('Match History')).toBeNull()
  })

  /**
   * The upsell card must include a direct link to account creation.
   */
  it('shows a "Create Account" button for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Create Account')).toBeDefined()
  })

  /**
   * Existing users visiting as guests should also be able to sign in.
   */
  it('shows a "Sign In" button for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Sign In')).toBeDefined()
  })

  /**
   * The page title and back button must still be present for guests so
   * navigation is not broken.
   */
  it('still renders the page title and back button for guests', () => {
    vi.mocked(useStatsController).mockReturnValue(
      makeControllerMock({ history: [], stats: null, isGuest: true }) as any,
    )
    renderWithRouter(<StatsPage />)
    expect(screen.getByText('Statistics')).toBeDefined()
    expect(screen.getByText('Back')).toBeDefined()
  })
})
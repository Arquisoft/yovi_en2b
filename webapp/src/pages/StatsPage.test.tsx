// webapp/src/pages/StatsPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StatsPage } from './StatsPage'
import { useStatsController } from '@/controllers/useStatsController'

vi.mock('@/controllers/useStatsController', () => ({
  useStatsController: vi.fn(),
}))

const mockHistory = [
  { id: '1', opponentName: 'Bot (medium)', result: 'win' as const, durationSeconds: 142, playedAt: new Date().toISOString() },
  { id: '2', opponentName: 'PlayerTwo', result: 'loss' as const, durationSeconds: 87, playedAt: new Date().toISOString() },
]

const mockStats = {
  overall: { wins: 8, losses: 4 },
  recent: { wins: 3, losses: 2 },
}

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('StatsPage', () => {
  beforeEach(() => {
    vi.mocked(useStatsController).mockReturnValue({
      history: mockHistory,
      stats: mockStats,
      isLoading: false,
    })
  })

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
    vi.mocked(useStatsController).mockReturnValue({
      history: [],
      stats: null,
      isLoading: true,
    })
    const { container } = renderWithRouter(<StatsPage />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('does not render winrate charts when stats is null', () => {
    vi.mocked(useStatsController).mockReturnValue({
      history: [],
      stats: null,
      isLoading: false,
    })
    renderWithRouter(<StatsPage />)
    expect(screen.queryByText('Winrate')).toBeNull()
  })

  it('renders empty history message when no matches', async () => {
    vi.mocked(useStatsController).mockReturnValue({
      history: [],
      stats: mockStats,
      isLoading: false,
    })
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
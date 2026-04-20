// webapp/src/pages/RankingPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RankingPage } from './RankingPage'
import { useRankingController } from '@/controllers/useRankingController'
import { useNavigate } from 'react-router-dom'

vi.mock('@/controllers/useRankingController', () => ({
  useRankingController: vi.fn(),
}))


vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}))

const mockEntries = [
  { rank: 1, username: 'PlayerOne', wins: 42 },
  { rank: 2, username: 'PlayerTwo', wins: 38 },
  { rank: 3, username: 'PlayerThree', wins: 31 },
  { rank: 4, username: 'PlayerFour', wins: 27 },
  { rank: 5, username: 'PlayerFive', wins: 19 },
]

describe('RankingPage', () => {
  beforeEach(() => {
    vi.mocked(useRankingController).mockReturnValue({
      selectedMode: 'pve-easy',
      setSelectedMode: vi.fn(),
      entries: mockEntries,
      isLoading: false,
      currentUsername: null,
      error: null
    })
  })

  it('renders the page title', () => {
    render(<RankingPage />)
    expect(screen.getByText('Ranking')).toBeDefined()
  })

  it('renders the back button', () => {
    render(<RankingPage />)
    expect(screen.getByText('Back')).toBeDefined()
  })

  it('renders all three mode buttons', () => {
    render(<RankingPage />)
    expect(screen.getByText('Bot fácil')).toBeDefined()
    expect(screen.getByText('Bot intermedio')).toBeDefined()
    expect(screen.getByText('Bot difícil')).toBeDefined()
  })

  it('renders the top 5 label', () => {
    render(<RankingPage />)
    expect(screen.getByText('Bot fácil — Top 5')).toBeDefined()
  })

  it('renders player entries', () => {
    render(<RankingPage />)
    expect(screen.getByText('PlayerOne')).toBeDefined()
    expect(screen.getByText('PlayerFive')).toBeDefined()
  })

  it('shows loading spinner when isLoading is true', () => {
    vi.mocked(useRankingController).mockReturnValue({
      selectedMode: 'pve-easy',
      setSelectedMode: vi.fn(),
      entries: [],
      isLoading: true,
      currentUsername: null,
      error: null
    })
    const { container } = render(<RankingPage />)
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('calls setSelectedMode when clicking a mode button', async () => {
    const setSelectedMode = vi.fn()
    vi.mocked(useRankingController).mockReturnValue({
      selectedMode: 'pve-easy',
      setSelectedMode,
      entries: mockEntries,
      isLoading: false,
      currentUsername: null,
      error: null
    })
    render(<RankingPage />)
    await userEvent.click(screen.getByText('Bot difícil'))
    expect(setSelectedMode).toHaveBeenCalledWith('pve-hard')
  })

  it('calls navigate when clicking back button', async () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<RankingPage />)
    await userEvent.click(screen.getByText('Back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GameSelectionPage } from '@/pages/GameSelectionPage'
import { AVAILABLE_GAMES } from '@/mocks/mockData'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockHandlePlayGame = vi.fn()

vi.mock('@/controllers/useGameSelectionController', () => ({
  useGameSelectionController: vi.fn(),
}))

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: vi.fn(() => ({ theme: 'dark', toggleTheme: vi.fn() })),
}))

import { useGameSelectionController } from '@/controllers/useGameSelectionController'
import { useTheme } from '@/contexts/ThemeContext'


const GAME_AVAILABLE = AVAILABLE_GAMES.find(g => g.isAvailable)!
const GAME_COMING_SOON = AVAILABLE_GAMES.find(g => !g.isAvailable)!

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupController(overrides = {}) {
  vi.mocked(useGameSelectionController).mockReturnValue({
    games: AVAILABLE_GAMES,
    isLoading: false,
    error: null,
    handlePlayGame: mockHandlePlayGame,
    ...overrides,
  })
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GameSelectionPage', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTheme).mockReturnValue({ theme: 'dark', toggleTheme: vi.fn(), setTheme: vi.fn() })
  })

  // ── Loading state ──────────────────────────────────────────────────────────

  describe('Loading state', () => {
    it('renders spinner when isLoading is true', () => {
      setupController({ isLoading: true, games: [] })
      render(<GameSelectionPage />)
      expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('does not render game list when loading', () => {
      setupController({ isLoading: true, games: [] })
      render(<GameSelectionPage />)
      expect(screen.queryByText('Available Games')).not.toBeInTheDocument()
    })
  })

  // ── Error state ────────────────────────────────────────────────────────────

  describe('Error state', () => {
    it('renders error message when error is set', () => {
      setupController({ error: 'Failed to load games', games: [] })
      render(<GameSelectionPage />)
      expect(screen.getByText('Failed to load games')).toBeInTheDocument()
    })

    it('does not render game list on error', () => {
      setupController({ error: 'Some error', games: [] })
      render(<GameSelectionPage />)
      expect(screen.queryByText('Available Games')).not.toBeInTheDocument()
    })
  })

  // ── Game list rendering ────────────────────────────────────────────────────

  describe('Game list rendering', () => {
    it('renders Available Games heading', () => {
      setupController()
      render(<GameSelectionPage />)
      expect(screen.getByText('Available Games')).toBeInTheDocument()
    })

    it('renders Choose Your Game title', () => {
      setupController()
      render(<GameSelectionPage />)
      expect(screen.getByText('Choose Your Game')).toBeInTheDocument()
    })

    it('renders all games from AVAILABLE_GAMES', () => {
        setupController()
        render(<GameSelectionPage />)
        AVAILABLE_GAMES.forEach(game => {
            expect(screen.getAllByText(game.name).length).toBeGreaterThan(0)
        })
    })
    
    it('renders Coming Soon badge for unavailable games', () => {
      setupController()
      render(<GameSelectionPage />)
      const unavailableCount = AVAILABLE_GAMES.filter(g => !g.isAvailable).length
      const badges = screen.getAllByText('Coming Soon')
      expect(badges.length).toBeGreaterThanOrEqual(unavailableCount)
    })

    it('shows empty state when games list is empty', () => {
      setupController({ games: [] })
      render(<GameSelectionPage />)
      expect(screen.getByText('Select a game from the list')).toBeInTheDocument()
    })
  })

  // ── Player count formatting ────────────────────────────────────────────────

  describe('Player count formatting', () => {
    it('shows single number when minPlayers equals maxPlayers', () => {
      const game = AVAILABLE_GAMES.find(g => g.minPlayers === g.maxPlayers)
      if (!game) return
      setupController({ games: [game] })
      render(<GameSelectionPage />)
      expect(screen.getAllByText(`${game.minPlayers} players`).length).toBeGreaterThan(0)
    })

    it('shows range when minPlayers differs from maxPlayers', () => {
      const game = AVAILABLE_GAMES.find(g => g.minPlayers !== g.maxPlayers)
      if (!game) return
      setupController({ games: [game] })
      render(<GameSelectionPage />)
      expect(screen.getAllByText(`${game.minPlayers}-${game.maxPlayers} players`).length).toBeGreaterThan(0)
    })
  })

  // ── Auto-select first game ─────────────────────────────────────────────────

  describe('Auto-selection', () => {
    it('auto-selects first game on load and shows its description', async () => {
      setupController()
      render(<GameSelectionPage />)
      await waitFor(() => {
        expect(screen.getByText(AVAILABLE_GAMES[0].description)).toBeInTheDocument()
      })
    })

    it('shows Play Now or Coming Soon button after auto-selection', async () => {
      setupController()
      render(<GameSelectionPage />)
      await waitFor(() => {
        const btn = screen.getByRole('button', {
          name: AVAILABLE_GAMES[0].isAvailable ? /play now/i : /coming soon/i
        })
        expect(btn).toBeInTheDocument()
      })
    })
  })

  // ── Game selection interaction ─────────────────────────────────────────────

  describe('Game selection interaction', () => {
    it('updates detail panel when a different game is clicked', async () => {
      setupController()
      render(<GameSelectionPage />)

      const secondGame = AVAILABLE_GAMES[1]
      const btn = screen.getByRole('button', { name: new RegExp(secondGame.name, 'i') })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(screen.getByText(secondGame.description)).toBeInTheDocument()
      })
    })

    it('highlights selected game in the list', async () => {
      setupController()
      render(<GameSelectionPage />)

      const secondGame = AVAILABLE_GAMES[1]
      const btn = screen.getByRole('button', { name: new RegExp(secondGame.name, 'i') })
      fireEvent.click(btn)

      await waitFor(() => {
        expect(btn.className).toContain('border-primary')
      })
    })
  })

  // ── Play button ────────────────────────────────────────────────────────────

  describe('Play button', () => {
    it('calls handlePlayGame with correct id when Play Now is clicked', async () => {
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(async () => {
        const playBtn = screen.getByRole('button', { name: /play now/i })
        fireEvent.click(playBtn)
        expect(mockHandlePlayGame).toHaveBeenCalledWith(GAME_AVAILABLE.id)
      })
    })

    it('disables Play button for unavailable games', async () => {
    setupController({ games: [GAME_COMING_SOON] })
    render(<GameSelectionPage />)

    await waitFor(() => {
        // Busca todos y coge el que es un <button> del panel principal (size="lg")
        const btns = screen.getAllByRole('button', { name: /coming soon/i })
        const mainPlayBtn = btns.find(btn => btn.classList.contains('w-full'))
        expect(mainPlayBtn).toBeDisabled()
    })
    })

    it('enables Play button for available games', async () => {
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        const btn = screen.getByRole('button', { name: /play now/i })
        expect(btn).not.toBeDisabled()
      })
    })
  })

  // ── Coming Soon overlay ────────────────────────────────────────────────────

  describe('Coming Soon overlay', () => {
    it('renders overlay for unavailable game in detail panel', async () => {
      setupController({ games: [GAME_COMING_SOON] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        expect(screen.getAllByText('Coming Soon').length).toBeGreaterThan(0)
      })
    })

    it('does not render overlay for available game', async () => {
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument()
      })
    })
  })

  // ── Thumbnail handling ─────────────────────────────────────────────────────

  describe('Thumbnail handling', () => {
    it('renders img when game has a thumbnail', async () => {
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        const imgs = document.querySelectorAll('img')
        const found = Array.from(imgs).some(img =>
          img.getAttribute('src')?.includes('game-y-thumbnail')
        )
        expect(found).toBe(true)
      })
    })

    it('falls back to icon when image fails to load', async () => {
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        const img = document.querySelector(`img[alt="${GAME_AVAILABLE.name}"]`) as HTMLImageElement
        if (img) fireEvent.error(img)
      })

      await waitFor(() => {
        const img = document.querySelector(`img[alt="${GAME_AVAILABLE.name}"]`)
        expect(img).toBeNull()
      })
    })
  })

  // ── Theme-aware thumbnail ──────────────────────────────────────────────────

  describe('Theme-aware thumbnail', () => {
    it('uses -dark.png suffix in dark mode', async () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'dark', toggleTheme: vi.fn(), setTheme: vi.fn() })
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        const img = document.querySelector(`img[alt="${GAME_AVAILABLE.name}"]`) as HTMLImageElement
        expect(img?.src).toContain('-dark.png')
      })
    })

    it('uses -light.png suffix in light mode', async () => {
      vi.mocked(useTheme).mockReturnValue({ theme: 'light', toggleTheme: vi.fn(), setTheme: vi.fn() })
      setupController({ games: [GAME_AVAILABLE] })
      render(<GameSelectionPage />)

      await waitFor(() => {
        const img = document.querySelector(`img[alt="${GAME_AVAILABLE.name}"]`) as HTMLImageElement
        expect(img?.src).toContain('-light.png')
      })
    })
  })

})
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
import '@testing-library/jest-dom'
import { MemoryRouter } from 'react-router-dom'
import GameSelectionScreen from '../components/GameSelectionScreen'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('GameSelectionScreen', () => {
  test('renders logo, title, game card, and action buttons', () => {
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    expect(screen.getByText('YOVI')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /select a game/i })).toBeInTheDocument()
    // 'Game Y' aparece en el preview y en la card, usamos getAllByText
    expect(screen.getAllByText('Game Y').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('button', { name: /play now/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to login/i })).toBeInTheDocument()
  })

  test('Game Y is selected by default', () => {
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    const card = screen.getByRole('button', { name: /game y/i })
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveClass('selection-game-card--active')
  })

  test('preview image shows selected game', () => {
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    const previewImg = screen.getAllByAltText('Game Y')[0]
    expect(previewImg).toHaveAttribute('src', '/GameY-Image.jpeg')
  })

  test('clicking Play Now navigates to /gamey', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /play now/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/gamey')
  })

  test('clicking Back to Login navigates to /', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /back to login/i }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  test('calls onSelectGame with the selected game id when Play Now is clicked', async () => {
    const user = userEvent.setup()
    const onSelectGame = vi.fn()
    render(
      <MemoryRouter>
        <GameSelectionScreen onSelectGame={onSelectGame} />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /play now/i }))
    expect(onSelectGame).toHaveBeenCalledWith('gamey')
  })

  test('calls onBack when Back to Login is clicked', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <MemoryRouter>
        <GameSelectionScreen onBack={onBack} />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: /back to login/i }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('does not throw without optional props', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <GameSelectionScreen />
      </MemoryRouter>
    )

    await expect(
      user.click(screen.getByRole('button', { name: /play now/i }))
    ).resolves.not.toThrow()

    await expect(
      user.click(screen.getByRole('button', { name: /back to login/i }))
    ).resolves.not.toThrow()
  })
})
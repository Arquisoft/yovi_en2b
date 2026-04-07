import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameCard } from './GameCard'
import type { GameInfo } from '@/types'

function makeGame(overrides: Partial<GameInfo> = {}): GameInfo {
  return {
    id: 'game-y',
    name: 'Game Y',
    description: 'A strategic hex game.',
    minPlayers: 2,
    maxPlayers: 2,
    isAvailable: true,
    thumbnail: '',
    ...overrides,
  }
}

describe('GameCard', () => {
  it('renders the game name and description', () => {
    render(<GameCard game={makeGame()} onPlay={vi.fn()} />)
    expect(screen.getByText('Game Y')).toBeDefined()
    expect(screen.getByText('A strategic hex game.')).toBeDefined()
  })

  it('shows single player count when min equals max', () => {
    render(<GameCard game={makeGame({ minPlayers: 2, maxPlayers: 2 })} onPlay={vi.fn()} />)
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows range when min and max differ', () => {
    render(<GameCard game={makeGame({ minPlayers: 2, maxPlayers: 4 })} onPlay={vi.fn()} />)
    expect(screen.getByText('2-4')).toBeDefined()
  })

  it('renders "Play" button when game is available', () => {
    render(<GameCard game={makeGame({ isAvailable: true })} onPlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Play' })).toBeDefined()
  })

  it('renders "Coming Soon" button when game is not available', () => {
    render(<GameCard game={makeGame({ isAvailable: false })} onPlay={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Coming Soon' })).toBeDefined()
  })

  it('button is disabled when game is not available', () => {
    render(<GameCard game={makeGame({ isAvailable: false })} onPlay={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Coming Soon' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('calls onPlay when Play button is clicked', () => {
    const onPlay = vi.fn()
    render(<GameCard game={makeGame()} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onPlay).toHaveBeenCalledOnce()
  })

  it('does not call onPlay when Coming Soon button is clicked (disabled)', () => {
    const onPlay = vi.fn()
    render(<GameCard game={makeGame({ isAvailable: false })} onPlay={onPlay} />)
    fireEvent.click(screen.getByRole('button', { name: 'Coming Soon' }))
    expect(onPlay).not.toHaveBeenCalled()
  })
})

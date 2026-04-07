import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TimerPanel } from './TimerPanel'
import type { TimerState } from '@/types'

function makeTimer(overrides: Partial<TimerState> = {}): TimerState {
  return {
    player1RemainingMs: 300000,
    player2RemainingMs: 300000,
    activePlayer: 'player1',
    lastSyncTimestamp: Date.now(),
    ...overrides,
  }
}

describe('TimerPanel — display', () => {
  it('shows the player name', () => {
    render(
      <TimerPanel timer={makeTimer()} player="player1" playerName="Alice" isCurrentPlayer={false} />
    )
    expect(screen.getByText('Alice')).toBeDefined()
  })

  it('displays formatted time for player1', () => {
    render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 125000 })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(screen.getByText('02:05')).toBeDefined()
  })

  it('displays formatted time for player2', () => {
    render(
      <TimerPanel
        timer={makeTimer({ player2RemainingMs: 45000 })}
        player="player2"
        playerName="Bob"
        isCurrentPlayer={false}
      />
    )
    expect(screen.getByText('00:45')).toBeDefined()
  })

  it('shows 00:00 when remaining time is zero', () => {
    render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 0 })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(screen.getByText('00:00')).toBeDefined()
  })
})

describe('TimerPanel — active / inactive state', () => {
  it('applies active border when this player is the active one', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ activePlayer: 'player1' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.firstChild).toHaveClass('border-primary')
  })

  it('applies inactive border when the other player is active', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ activePlayer: 'player2' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.firstChild).toHaveClass('border-border')
  })

  it('applies ring highlight when isCurrentPlayer is true', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer()}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={true}
      />
    )
    expect(container.firstChild).toHaveClass('ring-2')
  })

  it('does not apply ring when isCurrentPlayer is false', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer()}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.firstChild).not.toHaveClass('ring-2')
  })
})

describe('TimerPanel — low / critical time warning', () => {
  it('shows yellow text when time is low (< 60s) and this player is active', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 45000, activePlayer: 'player1' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.querySelector('.text-yellow-500')).not.toBeNull()
  })

  it('shows destructive text when time is critical (< 30s) and player is active', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 15000, activePlayer: 'player1' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.querySelector('.text-destructive')).not.toBeNull()
  })

  it('does NOT show critical styling when player is inactive, even at low time', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 15000, activePlayer: 'player2' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.querySelector('.text-destructive')).toBeNull()
    expect(container.querySelector('.text-yellow-500')).toBeNull()
  })

  it('does not show warning when time is comfortable (>= 60s)', () => {
    const { container } = render(
      <TimerPanel
        timer={makeTimer({ player1RemainingMs: 120000, activePlayer: 'player1' })}
        player="player1"
        playerName="Alice"
        isCurrentPlayer={false}
      />
    )
    expect(container.querySelector('.text-yellow-500')).toBeNull()
    expect(container.querySelector('.text-destructive')).toBeNull()
  })
})

describe('TimerPanel — player color dot', () => {
  it('shows player1 color dot for player1', () => {
    const { container } = render(
      <TimerPanel timer={makeTimer()} player="player1" playerName="Alice" isCurrentPlayer={false} />
    )
    expect(container.querySelector('.bg-player1')).not.toBeNull()
  })

  it('shows player2 color dot for player2', () => {
    const { container } = render(
      <TimerPanel timer={makeTimer()} player="player2" playerName="Bob" isCurrentPlayer={false} />
    )
    expect(container.querySelector('.bg-player2')).not.toBeNull()
  })
})

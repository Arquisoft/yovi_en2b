import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { GameYCell } from './GameYCell'
import type { PlayerColor } from '@/types'

interface CellOverrides {
  owner?: PlayerColor | null
  isLastMove?: boolean
  isHovered?: boolean
  isClickable?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function renderCell(overrides: CellOverrides = {}) {
  const props = {
    row: 0,
    col: 0,
    x: 50,
    y: 50,
    size: 30,
    owner: null as PlayerColor | null,
    isLastMove: false,
    isHovered: false,
    isClickable: true,
    onClick: vi.fn(),
    onMouseEnter: vi.fn(),
    onMouseLeave: vi.fn(),
    ...overrides,
  }
  const { container } = render(
    <svg>
      <GameYCell {...props} />
    </svg>
  )
  const g = container.querySelector('g')!
  const path = container.querySelector('path')!
  return { container, g, path, props }
}

describe('GameYCell — fill colors', () => {
  it('uses card color for an empty unowned cell', () => {
    const { path } = renderCell({ owner: null, isHovered: false })
    expect(path.getAttribute('fill')).toBe('hsl(var(--card))')
  })

  it('uses accent color when hovered and clickable', () => {
    const { path } = renderCell({ owner: null, isHovered: true, isClickable: true })
    expect(path.getAttribute('fill')).toBe('hsl(var(--accent))')
  })

  it('uses card color when hovered but NOT clickable', () => {
    const { path } = renderCell({ owner: null, isHovered: true, isClickable: false })
    expect(path.getAttribute('fill')).toBe('hsl(var(--card))')
  })

  it('uses player1 color for a player1 owned cell', () => {
    const { path } = renderCell({ owner: 'player1', isLastMove: false })
    expect(path.getAttribute('fill')).toBe('hsl(var(--player1))')
  })

  it('uses player1 faded for the last move by player1', () => {
    const { path } = renderCell({ owner: 'player1', isLastMove: true })
    expect(path.getAttribute('fill')).toBe('hsl(var(--player1) / 0.9)')
  })

  it('uses player2 color for a player2 owned cell', () => {
    const { path } = renderCell({ owner: 'player2', isLastMove: false })
    expect(path.getAttribute('fill')).toBe('hsl(var(--player2))')
  })

  it('uses player2 faded for the last move by player2', () => {
    const { path } = renderCell({ owner: 'player2', isLastMove: true })
    expect(path.getAttribute('fill')).toBe('hsl(var(--player2) / 0.9)')
  })
})

describe('GameYCell — click interaction', () => {
  it('calls onClick when clicked and isClickable', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: true, onClick })
    fireEvent.click(g)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does NOT call onClick when not isClickable', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: false, onClick })
    fireEvent.click(g)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick on Enter key when isClickable', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: true, onClick })
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('calls onClick on Space key when isClickable', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: true, onClick })
    fireEvent.keyDown(g, { key: ' ' })
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does NOT call onClick on Enter key when not isClickable', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: false, onClick })
    fireEvent.keyDown(g, { key: 'Enter' })
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does NOT fire onClick on non-Enter/Space keys', () => {
    const onClick = vi.fn()
    const { g } = renderCell({ isClickable: true, onClick })
    fireEvent.keyDown(g, { key: 'Tab' })
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('GameYCell — mouse events', () => {
  it('calls onMouseEnter when mouse enters', () => {
    const onMouseEnter = vi.fn()
    const { g } = renderCell({ onMouseEnter })
    fireEvent.mouseEnter(g)
    expect(onMouseEnter).toHaveBeenCalledOnce()
  })

  it('calls onMouseLeave when mouse leaves', () => {
    const onMouseLeave = vi.fn()
    const { g } = renderCell({ onMouseLeave })
    fireEvent.mouseLeave(g)
    expect(onMouseLeave).toHaveBeenCalledOnce()
  })
})

describe('GameYCell — accessibility', () => {
  it('has role="button" and tabIndex=0 when isClickable', () => {
    const { g } = renderCell({ isClickable: true })
    expect(g.getAttribute('role')).toBe('button')
    expect(g.tabIndex).toBe(0)
  })

  it('has no role or tabIndex when not isClickable', () => {
    const { g } = renderCell({ isClickable: false })
    expect(g.getAttribute('role')).toBeNull()
    expect(g.getAttribute('tabIndex')).toBeNull()
  })

  it('shows aria-label indicating owner when occupied', () => {
    const { g } = renderCell({ owner: 'player1' })
    expect(g.getAttribute('aria-label')).toContain('player1')
  })

  it('shows aria-label indicating empty when unowned', () => {
    const { g } = renderCell({ owner: null })
    expect(g.getAttribute('aria-label')).toContain('empty')
  })
})

describe('GameYCell — visual indicators', () => {
  it('renders last-move pulse circle when isLastMove is true', () => {
    const { container } = renderCell({ isLastMove: true, owner: 'player1' })
    const pulseCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('stroke') === 'hsl(var(--foreground))'
    )
    expect(pulseCircle).toBeDefined()
  })

  it('does NOT render pulse circle when isLastMove is false', () => {
    const { container } = renderCell({ isLastMove: false, owner: 'player1' })
    const pulseCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('stroke') === 'hsl(var(--foreground))'
    )
    expect(pulseCircle).toBeUndefined()
  })

  it('renders hover indicator circle for hovered + clickable + empty cell', () => {
    const { container } = renderCell({ owner: null, isHovered: true, isClickable: true })
    const hoverCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('fill')?.includes('muted-foreground')
    )
    expect(hoverCircle).toBeDefined()
  })

  it('does NOT render hover circle when cell is owned', () => {
    const { container } = renderCell({ owner: 'player2', isHovered: true, isClickable: false })
    const hoverCircle = Array.from(container.querySelectorAll('circle')).find(
      (c) => c.getAttribute('fill')?.includes('muted-foreground')
    )
    expect(hoverCircle).toBeUndefined()
  })
})

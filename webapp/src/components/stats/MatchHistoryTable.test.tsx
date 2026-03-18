// webapp/src/components/stats/MatchHistoryTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchHistoryTable } from './MatchHistoryTable'
import type { MatchRecord } from '@/types'

const mockHistory: MatchRecord[] = [
  { id: '1', opponentName: 'Bot (medium)', result: 'win', durationSeconds: 142, playedAt: new Date('2026-01-01T10:00:00Z').toISOString() },
  { id: '2', opponentName: 'PlayerTwo', result: 'loss', durationSeconds: 87, playedAt: new Date('2026-01-02T10:00:00Z').toISOString() },
]

const manyMatches: MatchRecord[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  opponentName: `Player${i + 1}`,
  result: i % 2 === 0 ? 'win' : 'loss',
  durationSeconds: 100 + i * 10,
  playedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
}))

describe('MatchHistoryTable', () => {
  it('shows empty state when no matches', () => {
    render(<MatchHistoryTable history={[]} />)
    expect(screen.getByText('No matches played yet')).toBeDefined()
  })

  it('renders opponent names', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('Bot (medium)')).toBeDefined()
    expect(screen.getByText('PlayerTwo')).toBeDefined()
  })

  it('renders win and loss badges', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('Win')).toBeDefined()
    expect(screen.getByText('Loss')).toBeDefined()
  })

  it('renders duration in MM:SS format', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('02:22')).toBeDefined()
    expect(screen.getByText('01:27')).toBeDefined()
  })

  it('renders table headers', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('Opponent')).toBeDefined()
    expect(screen.getByText('Result')).toBeDefined()
    expect(screen.getByText('Duration')).toBeDefined()
  })

  it('renders all match rows for small history', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(3) // 1 header + 2 data
  })

  it('renders a single match correctly', () => {
    render(<MatchHistoryTable history={[mockHistory[0]]} />)
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })

  it('does not show pagination for 2 matches', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.queryByText('Next')).toBeNull()
    expect(screen.queryByText('Previous')).toBeNull()
  })

  it('shows pagination when matches exceed page size', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    expect(screen.getByText('Next')).toBeDefined()
    expect(screen.getByText('First')).toBeDefined()
    expect(screen.getByText('Last')).toBeDefined()
  })

  it('shows correct page indicator', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    expect(screen.getByText('1 / 3')).toBeDefined()
  })

  it('navigates to next page', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('2 / 3')).toBeDefined()
  })

  it('navigates to last page', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Last'))
    expect(screen.getByText('3 / 3')).toBeDefined()
  })

  it('navigates back to first page', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Last'))
    fireEvent.click(screen.getByText('First'))
    expect(screen.getByText('1 / 3')).toBeDefined()
  })

  it('disables Previous and First on first page', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    expect(screen.getByText('First').closest('button')).toHaveProperty('disabled', true)
    expect(screen.getByText('Previous').closest('button')).toHaveProperty('disabled', true)
  })

  it('disables Next and Last on last page', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Last'))
    expect(screen.getByText('Next').closest('button')).toHaveProperty('disabled', true)
    expect(screen.getByText('Last').closest('button')).toHaveProperty('disabled', true)
  })

  it('only shows first page items initially', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    expect(screen.getByText('Player1')).toBeDefined()
    expect(screen.queryByText('Player6')).toBeNull()
  })
})
// webapp/src/components/stats/MatchHistoryTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MatchHistoryTable } from './MatchHistoryTable'
import type { MatchRecord } from '@/types'

const mockHistory: MatchRecord[] = [
  {
    id: '1',
    opponentName: 'Bot (medium)',
    result: 'win',
    durationSeconds: 142,
    playedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  },
  {
    id: '2',
    opponentName: 'PlayerTwo',
    result: 'loss',
    durationSeconds: 87,
    playedAt: new Date('2026-01-02T10:00:00Z').toISOString(),
  },
]

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
    expect(screen.getByText('02:22')).toBeDefined() // 142s
    expect(screen.getByText('01:27')).toBeDefined() // 87s
  })

  it('renders table headers', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('Opponent')).toBeDefined()
    expect(screen.getByText('Result')).toBeDefined()
    expect(screen.getByText('Duration')).toBeDefined()
  })

  it('renders all match rows', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const rows = screen.getAllByRole('row')
    // 1 header row + 2 data rows
    expect(rows.length).toBe(3)
  })
  
  it('renders a single match correctly', () => {
  const single = [mockHistory[0]]
  render(<MatchHistoryTable history={single} />)
  expect(screen.getByText('Bot (medium)')).toBeDefined()
})
})

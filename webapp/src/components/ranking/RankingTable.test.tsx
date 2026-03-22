// webapp/src/components/ranking/RankingTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RankingTable } from './RankingTable'
import type { RankingEntry } from '@/types'

const mockEntries: RankingEntry[] = [
  { rank: 1, username: 'PlayerOne',   wins: 42 },
  { rank: 2, username: 'PlayerTwo',   wins: 38 },
  { rank: 3, username: 'PlayerThree', wins: 31 },
  { rank: 4, username: 'PlayerFour',  wins: 27 },
  { rank: 5, username: 'PlayerFive',  wins: 19 },
]

describe('RankingTable', () => {
  it('shows empty state when no entries', () => {
    render(<RankingTable entries={[]} currentUsername={null} />)
    expect(screen.getByText('No hay datos disponibles')).toBeDefined()
  })

  it('renders all player usernames', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.getByText('PlayerOne')).toBeDefined()
    expect(screen.getByText('PlayerTwo')).toBeDefined()
    expect(screen.getByText('PlayerThree')).toBeDefined()
    expect(screen.getByText('PlayerFour')).toBeDefined()
    expect(screen.getByText('PlayerFive')).toBeDefined()
  })

  it('renders win counts', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('38')).toBeDefined()
    expect(screen.getByText('19')).toBeDefined()
  })

  it('renders table headers', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.getByText('#')).toBeDefined()
    expect(screen.getByText('Jugador')).toBeDefined()
    expect(screen.getByText('Victorias')).toBeDefined()
  })

  it('shows (tú) label for current user', () => {
    render(<RankingTable entries={mockEntries} currentUsername="PlayerOne" />)
    expect(screen.getByText('(tú)')).toBeDefined()
  })

  it('does not show (tú) label when currentUsername is null', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.queryByText('(tú)')).toBeNull()
  })

  it('shows numeric rank for positions 4 and 5', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })
})
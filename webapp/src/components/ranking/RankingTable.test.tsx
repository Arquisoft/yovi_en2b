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
    // i18n is initialised with 'en' in tests → t('ranking.noData') = 'No data available'
    expect(screen.getByText('No data available')).toBeDefined()
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
    // t('ranking.rankHash') = '#', t('ranking.player') = 'Player', t('ranking.victories') = 'Victories'
    expect(screen.getByText('#')).toBeDefined()
    expect(screen.getByText('Player')).toBeDefined()
    expect(screen.getByText('Victories')).toBeDefined()
  })

  it('shows (you) label for current user', () => {
    render(<RankingTable entries={mockEntries} currentUsername="PlayerOne" />)
    // t('ranking.you') = '(you)' in English
    expect(screen.getByText('(you)')).toBeDefined()
  })

  it('does not show (you) label when currentUsername is null', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.queryByText('(you)')).toBeNull()
  })

  it('shows numeric rank for positions 4 and 5', () => {
    render(<RankingTable entries={mockEntries} currentUsername={null} />)
    expect(screen.getByText('4')).toBeDefined()
    expect(screen.getByText('5')).toBeDefined()
  })
})
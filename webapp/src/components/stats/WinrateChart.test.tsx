// webapp/src/components/stats/WinrateChart.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinrateChart } from './WinrateChart'

describe('WinrateChart', () => {
  it('renders the title', () => {
    render(<WinrateChart data={{ wins: 8, losses: 4 }} title="Overall" />)
    expect(screen.getByText('Overall')).toBeDefined()
  })

  it('shows win and loss counts', () => {
    render(<WinrateChart data={{ wins: 8, losses: 4 }} title="Overall" />)
    expect(screen.getByText(/Wins 8/)).toBeDefined()
    expect(screen.getByText(/Losses 4/)).toBeDefined()
  })

  it('shows win percentage', () => {
    render(<WinrateChart data={{ wins: 3, losses: 1 }} title="Recent" />)
    expect(screen.getByText('75%')).toBeDefined()
  })

  it('shows No data when total is zero', () => {
    render(<WinrateChart data={{ wins: 0, losses: 0 }} title="Overall" />)
    expect(screen.getByText('No data')).toBeDefined()
  })

  it('handles all wins', () => {
    render(<WinrateChart data={{ wins: 5, losses: 0 }} title="Overall" />)
    expect(screen.getByText('100%')).toBeDefined()
  })

  it('handles all losses', () => {
    render(<WinrateChart data={{ wins: 0, losses: 5 }} title="Overall" />)
    expect(screen.getByText('0%')).toBeDefined()
  })

  it('renders svg when there are wins and losses', () => {
  const { container } = render(<WinrateChart data={{ wins: 3, losses: 2 }} title="Overall" />)
  expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders correctly when wins is exactly 180 degrees (50%)', () => {
    render(<WinrateChart data={{ wins: 1, losses: 1 }} title="Overall" />)
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('renders correctly when wins > 180 degrees (large arc)', () => {
    render(<WinrateChart data={{ wins: 3, losses: 1 }} title="Overall" />)
    expect(screen.getByText('75%')).toBeDefined()
  })
})

// webapp/src/components/stats/MatchHistoryTable.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchHistoryTable, SortButton, FilterBar } from './MatchHistoryTable'
import type { MatchRecord, MatchHistoryFilter } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockHistory: MatchRecord[] = [
  {
    id: '1',
    opponentName: 'Bot (medium)',
    result: 'win',
    durationSeconds: 142,
    playedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
    gameMode: 'pve-medium',
  },
  {
    id: '2',
    opponentName: 'PlayerTwo',
    result: 'loss',
    durationSeconds: 87,
    playedAt: new Date('2026-01-02T10:00:00Z').toISOString(),
    gameMode: 'pvp-local',
  },
  {
    id: '3',
    opponentName: 'Bot (easy)',
    result: 'win',
    durationSeconds: 200,
    playedAt: new Date('2026-01-03T10:00:00Z').toISOString(),
    gameMode: 'pve-easy',
  },
]

const manyMatches: MatchRecord[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  opponentName: `Player${i + 1}`,
  result: i % 2 === 0 ? 'win' : ('loss' as 'win' | 'loss'),
  durationSeconds: 100 + i * 10,
  playedAt: new Date('2026-01-01T10:00:00Z').toISOString(),
  gameMode: i % 3 === 0 ? 'pve-easy' : 'pve-medium',
}))

// ── Empty state ───────────────────────────────────────────────────────────────

describe('MatchHistoryTable — empty state', () => {
  it('shows empty state when no matches', () => {
    render(<MatchHistoryTable history={[]} />)
    expect(screen.getByText('No matches played yet')).toBeDefined()
  })
})

// ── Basic rendering ───────────────────────────────────────────────────────────

describe('MatchHistoryTable — basic rendering', () => {
  it('renders opponent names', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('Bot (medium)')).toBeDefined()
    expect(screen.getByText('PlayerTwo')).toBeDefined()
  })

  it('renders win and loss badges', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getAllByText('Win').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Loss').length).toBeGreaterThan(0)
  })

  it('renders duration in MM:SS format', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByText('02:22')).toBeDefined() // 142s
    expect(screen.getByText('01:27')).toBeDefined() // 87s
  })

  it('renders all match rows for small history', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(4) // 1 header + 3 data rows
  })

  it('renders a single match correctly', () => {
    render(<MatchHistoryTable history={[mockHistory[0]]} />)
    expect(screen.getByText('Bot (medium)')).toBeDefined()
  })
})

// ── Sort buttons in header ────────────────────────────────────────────────────

describe('MatchHistoryTable — sortable columns', () => {
  it('renders Opponent sort button', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('button', { name: /sort by opponent/i })).toBeDefined()
  })

  it('renders Result sort button', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('button', { name: /sort by result/i })).toBeDefined()
  })

  it('renders Duration sort button', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('button', { name: /sort by duration/i })).toBeDefined()
  })

  it('renders Date sort button', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('button', { name: /sort by date/i })).toBeDefined()
  })

  it('default sort is date descending — newest first', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const rows = screen.getAllByRole('row')
    // First data row (newest) should be Bot (easy) — playedAt 2026-01-03
    expect(rows[1].textContent).toContain('Bot (easy)')
  })

  it('clicking date sort once sets asc order', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const dateBtn = screen.getByRole('button', { name: /sort by date/i })
    fireEvent.click(dateBtn) // was desc, becomes asc
    const rows = screen.getAllByRole('row')
    // Oldest first: Bot (medium) — playedAt 2026-01-01
    expect(rows[1].textContent).toContain('Bot (medium)')
  })

  it('clicking date sort twice toggles back to desc', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const dateBtn = screen.getByRole('button', { name: /sort by date/i })
    fireEvent.click(dateBtn) // asc
    fireEvent.click(dateBtn) // desc again
    const rows = screen.getAllByRole('row')
    expect(rows[1].textContent).toContain('Bot (easy)') // newest
  })

  it('clicking duration sort orders by duration ascending', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const durationBtn = screen.getByRole('button', { name: /sort by duration/i })
    fireEvent.click(durationBtn) // desc: longest first (Bot easy 200s)
    fireEvent.click(durationBtn) // asc: shortest first (PlayerTwo 87s)
    const rows = screen.getAllByRole('row')
    // Shortest: PlayerTwo 87s → first
    expect(rows[1].textContent).toContain('PlayerTwo')
  })

  it('clicking result sort orders alphabetically', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const resultBtn = screen.getByRole('button', { name: /sort by result/i })
    fireEvent.click(resultBtn) // desc: win before loss
    fireEvent.click(resultBtn) // asc: loss before win
    const rows = screen.getAllByRole('row')
    expect(rows[1].textContent).toContain('Loss')
  })

  it('clicking opponent sort orders alphabetically', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const opponentBtn = screen.getByRole('button', { name: /sort by opponent/i })
    fireEvent.click(opponentBtn) // desc: PlayerTwo first
    fireEvent.click(opponentBtn) // asc: Bot (easy) first
    const rows = screen.getAllByRole('row')
    // "Bot (easy)" < "Bot (medium)" < "PlayerTwo"
    expect(rows[1].textContent).toContain('Bot (easy)')
  })

  it('active sort button shows directional arrow icon', () => {
    const { container } = render(<MatchHistoryTable history={mockHistory} />)
    // Default is date desc, so date button shows sort-desc indicator
    expect(container.querySelector('[data-testid="sort-desc"]')).not.toBeNull()
  })

  it('inactive sort buttons show neutral arrow icon', () => {
    const { container } = render(<MatchHistoryTable history={mockHistory} />)
    const neutralIcons = container.querySelectorAll('[data-testid="sort-neutral"]')
    expect(neutralIcons.length).toBeGreaterThan(0)
  })
})

// ── Filter bar ────────────────────────────────────────────────────────────────

describe('MatchHistoryTable — filter bar', () => {
  it('renders All, Win, Loss filter buttons', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('button', { name: /^all$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^win$/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /^loss$/i })).toBeDefined()
  })

  it('clicking Win filter shows only wins', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    fireEvent.click(screen.getByRole('button', { name: /^win$/i }))
    const rows = screen.getAllByRole('row')
    // 2 wins + header = 3 rows
    expect(rows.length).toBe(3)
    const tbody = document.querySelector('tbody')!
    const cells = Array.from(tbody.querySelectorAll('span')).filter(
      (el) => el.textContent === 'Win',
    )
    expect(cells.length).toBe(2)
  })

  it('clicking Loss filter shows only losses', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    fireEvent.click(screen.getByRole('button', { name: /^loss$/i }))
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(2) // 1 loss + header
  })

  it('clicking All filter after Win shows all records again', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    fireEvent.click(screen.getByRole('button', { name: /^win$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }))
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(4) // header + 3
  })

  it('shows game mode dropdown when multiple modes exist', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    expect(screen.getByRole('combobox', { name: /filter by game mode/i })).toBeDefined()
  })

  it('does not show mode dropdown when all records have same mode', () => {
    const sameMode = mockHistory.map((r) => ({ ...r, gameMode: 'pve-easy' }))
    render(<MatchHistoryTable history={sameMode} />)
    // Only 1 unique mode — dropdown hidden
    expect(screen.queryByRole('combobox', { name: /filter by game mode/i })).toBeNull()
  })

  it('selecting a mode from dropdown filters records', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    const select = screen.getByRole('combobox', { name: /filter by game mode/i }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'pve-easy' } })
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(2) // 1 pve-easy + header
  })

  it('shows no-match message when filter returns zero results', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    fireEvent.click(screen.getByRole('button', { name: /^loss$/i }))
    const select = screen.getByRole('combobox', { name: /filter by game mode/i }) as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'pve-easy' } })
    // No losses with pve-easy
    expect(screen.getByText('No matches match the selected filters')).toBeDefined()
  })

  it('resetting filters back to All shows everything', () => {
    render(<MatchHistoryTable history={mockHistory} />)
    fireEvent.click(screen.getByRole('button', { name: /^loss$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^all$/i }))
    expect(screen.getAllByRole('row').length).toBe(4)
  })
})

// ── Pagination ────────────────────────────────────────────────────────────────

describe('MatchHistoryTable — pagination', () => {
  it('does not show pagination for 3 matches', () => {
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

  it('resets to page 1 when filter changes', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('2 / 3')).toBeDefined()
    // Apply win filter → page resets
    fireEvent.click(screen.getByRole('button', { name: /^win$/i }))
    expect(screen.getByText('1 / 2')).toBeDefined()
  })

  it('resets to page 1 when sort changes', () => {
    render(<MatchHistoryTable history={manyMatches} />)
    fireEvent.click(screen.getByText('Next'))
    const durationBtn = screen.getByRole('button', { name: /sort by duration/i })
    fireEvent.click(durationBtn)
    // After sort, pagination resets to page 1
    expect(screen.getByText('1 / 3')).toBeDefined()
  })
})

// ── SortButton unit tests ─────────────────────────────────────────────────────

describe('SortButton', () => {
  const onSort = () => {}

  it('renders label text', () => {
    render(
      <svg>
        <foreignObject>
          <SortButton
            field="date"
            label="Date"
            current="date"
            direction="desc"
            onSort={onSort}
          />
        </foreignObject>
      </svg>
    )
    expect(screen.getByText('Date')).toBeDefined()
  })

  it('shows sort-desc icon when active and desc', () => {
    const { container } = render(
      <SortButton field="date" label="Date" current="date" direction="desc" onSort={onSort} />
    )
    expect(container.querySelector('[data-testid="sort-desc"]')).not.toBeNull()
  })

  it('shows sort-asc icon when active and asc', () => {
    const { container } = render(
      <SortButton field="date" label="Date" current="date" direction="asc" onSort={onSort} />
    )
    expect(container.querySelector('[data-testid="sort-asc"]')).not.toBeNull()
  })

  it('shows neutral icon when not active', () => {
    const { container } = render(
      <SortButton field="date" label="Date" current="opponent" direction="asc" onSort={onSort} />
    )
    expect(container.querySelector('[data-testid="sort-neutral"]')).not.toBeNull()
  })

  it('calls onSort with correct field on click', () => {
    const mockSort = vi.fn()
    render(
      <SortButton field="duration" label="Duration" current="date" direction="desc" onSort={mockSort} />
    )
    fireEvent.click(screen.getByRole('button', { name: /sort by duration/i }))
    expect(mockSort).toHaveBeenCalledWith('duration')
  })

  it('has aria-pressed true when active', () => {
    render(
      <SortButton field="date" label="Date" current="date" direction="desc" onSort={onSort} />
    )
    expect(screen.getByRole('button', { name: /sort by date/i }).getAttribute('aria-pressed')).toBe('true')
  })

  it('has aria-pressed false when not active', () => {
    render(
      <SortButton field="date" label="Date" current="opponent" direction="desc" onSort={onSort} />
    )
    expect(screen.getByRole('button', { name: /sort by date/i }).getAttribute('aria-pressed')).toBe('false')
  })
})

// ── FilterBar unit tests ──────────────────────────────────────────────────────

describe('FilterBar', () => {
  const baseFilter: MatchHistoryFilter = {
    result: 'all',
    gameMode: 'all',
    sortField: 'date',
    sortDirection: 'desc',
  }

  it('renders result filter group', () => {
    render(<FilterBar filter={baseFilter} availableModes={[]} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: /filter options/i })).toBeDefined()
  })

  it('calls onChange with updated result when Win is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar filter={baseFilter} availableModes={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^win$/i }))
    expect(onChange).toHaveBeenCalledWith({ ...baseFilter, result: 'win' })
  })

  it('calls onChange with updated result when Loss is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar filter={baseFilter} availableModes={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^loss$/i }))
    expect(onChange).toHaveBeenCalledWith({ ...baseFilter, result: 'loss' })
  })

  it('does not render mode select when availableModes is empty', () => {
    render(<FilterBar filter={baseFilter} availableModes={[]} onChange={() => {}} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('renders mode select when multiple modes given', () => {
    render(
      <FilterBar
        filter={baseFilter}
        availableModes={['pve-easy', 'pve-medium']}
        onChange={() => {}}
      />
    )
    expect(screen.getByRole('combobox')).toBeDefined()
  })

  it('calls onChange with updated gameMode when select changes', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        filter={baseFilter}
        availableModes={['pve-easy', 'pve-hard']}
        onChange={onChange}
      />
    )
    const select = screen.getByRole('combobox') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'pve-hard' } })
    expect(onChange).toHaveBeenCalledWith({ ...baseFilter, gameMode: 'pve-hard' })
  })

  it('All button is aria-pressed true by default', () => {
    render(<FilterBar filter={baseFilter} availableModes={[]} onChange={() => {}} />)
    expect(
      screen.getByRole('button', { name: /^all$/i }).getAttribute('aria-pressed')
    ).toBe('true')
  })

  it('Win button is aria-pressed true when filter is win', () => {
    render(
      <FilterBar
        filter={{ ...baseFilter, result: 'win' }}
        availableModes={[]}
        onChange={() => {}}
      />
    )
    expect(
      screen.getByRole('button', { name: /^win$/i }).getAttribute('aria-pressed')
    ).toBe('true')
  })
})

// Need to import vi for the SortButton test
import { vi } from 'vitest'
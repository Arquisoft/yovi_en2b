// webapp/src/test/GameModePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameModePage } from '@/pages/GameModePage'

const mockNavigate = vi.fn()
const mockHandleSelectMode = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))
vi.mock('@/controllers/useGameModeController', () => ({
  useGameModeController: () => ({ handleSelectMode: mockHandleSelectMode }),
}))

describe('GameModePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockHandleSelectMode.mockClear()
  })

  it('renders the three mode cards', () => {
    render(<GameModePage />)
    expect(screen.getByText('Local Match')).toBeInTheDocument()
    expect(screen.getByText('vs Computer')).toBeInTheDocument()
    expect(screen.getByText('Online Match')).toBeInTheDocument()
  })

  it('navigates back on back button click', () => {
    render(<GameModePage />)
    fireEvent.click(screen.getByText('Back to Games'))
    expect(mockNavigate).toHaveBeenCalledWith('/games')
  })

  it('calls handleSelectMode for pvp-local', () => {
    render(<GameModePage />)
    fireEvent.click(screen.getByText('Local Match'))
    expect(mockHandleSelectMode).toHaveBeenCalledWith('pvp-local')
  })

  it('calls handleSelectMode for pve', () => {
    render(<GameModePage />)
    fireEvent.click(screen.getByText('vs Computer'))
    expect(mockHandleSelectMode).toHaveBeenCalledWith('pve')
  })

  it('calls handleSelectMode for pvp-online', () => {
    render(<GameModePage />)
    fireEvent.click(screen.getByText('Online Match'))
    // pvp-online is now enabled — handleSelectMode should be called
    expect(mockHandleSelectMode).toHaveBeenCalledWith('pvp-online')
  })
})
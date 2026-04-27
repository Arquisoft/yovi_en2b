// webapp/src/test/GameModePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameModePage } from '@/pages/GameModePage'

const mockNavigate = vi.fn()
const mockHandleSelectMode = vi.fn()
const mockUseAuth = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))
vi.mock('@/controllers/useGameModeController', () => ({
  useGameModeController: () => ({ handleSelectMode: mockHandleSelectMode }),
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('GameModePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockHandleSelectMode.mockClear()
    mockUseAuth.mockReturnValue({ isGuest: false })
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

  it('calls handleSelectMode for pvp-online when authenticated', () => {
    render(<GameModePage />)
    fireEvent.click(screen.getByText('Online Match'))
    expect(mockHandleSelectMode).toHaveBeenCalledWith('pvp-online')
  })

  it('navigates to /login when guest clicks pvp-online', () => {
    mockUseAuth.mockReturnValue({ isGuest: true })
    render(<GameModePage />)
    fireEvent.click(screen.getByText('Online Match'))
    expect(mockNavigate).toHaveBeenCalledWith('/login')
    expect(mockHandleSelectMode).not.toHaveBeenCalled()
  })

  it('shows Sign in badge on pvp-online card for guests', () => {
    mockUseAuth.mockReturnValue({ isGuest: true })
    render(<GameModePage />)
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })
})
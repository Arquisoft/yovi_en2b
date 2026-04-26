import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnlineRoomPage } from '@/pages/OnlineRoomPage'
import { useOnlineRoomController } from '@/controllers/useOnlineRoomController'

vi.mock('@/controllers/useOnlineRoomController', () => ({
  useOnlineRoomController: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

function makeController(overrides: Record<string, any> = {}) {
  return {
    codeInput: '',
    setCodeInput: vi.fn(),
    joinStatus: 'idle' as const,
    error: null,
    isGuest: false,
    handleCreateRoom: vi.fn(),
    handleJoin: vi.fn(),
    handleCancel: vi.fn(),
    handleRetry: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useOnlineRoomController).mockReturnValue(makeController() as any)
})

describe('OnlineRoomPage — idle state', () => {
  it('renders create room and join room cards', () => {
    render(<OnlineRoomPage />)
    expect(screen.getAllByText('online.createRoom').length).toBeGreaterThan(0)
    expect(screen.getAllByText('online.joinRoom').length).toBeGreaterThan(0)
  })

  it('calls handleCancel when back button is clicked', () => {
    const handleCancel = vi.fn()
    vi.mocked(useOnlineRoomController).mockReturnValue(makeController({ handleCancel }) as any)
    render(<OnlineRoomPage />)
    fireEvent.click(screen.getByText('gameModes.backToGames'))
    expect(handleCancel).toHaveBeenCalledOnce()
  })

  it('calls handleCreateRoom when create room button is clicked', () => {
    const handleCreateRoom = vi.fn()
    vi.mocked(useOnlineRoomController).mockReturnValue(makeController({ handleCreateRoom }) as any)
    render(<OnlineRoomPage />)
    const buttons = screen.getAllByRole('button')
    const createBtn = buttons.find(b => b.textContent?.includes('online.createRoom'))
    if (createBtn) fireEvent.click(createBtn)
    expect(handleCreateRoom).toHaveBeenCalledOnce()
  })

  it('shows guest message when user is a guest', () => {
    vi.mocked(useOnlineRoomController).mockReturnValue(makeController({ isGuest: true }) as any)
    render(<OnlineRoomPage />)
    expect(screen.getByText('online.guestCannotJoin')).toBeDefined()
  })
})

describe('OnlineRoomPage — connecting state', () => {
  it('renders a non-idle state without the idle layout', () => {
    vi.mocked(useOnlineRoomController).mockReturnValue(
      makeController({ joinStatus: 'connecting' }) as any
    )
    render(<OnlineRoomPage />)
    expect(screen.getByText('online.joiningRoom')).toBeDefined()
  })
})

describe('OnlineRoomPage — waiting state', () => {
  it('shows joining room text while waiting for match', () => {
    vi.mocked(useOnlineRoomController).mockReturnValue(
      makeController({ joinStatus: 'waiting' }) as any
    )
    render(<OnlineRoomPage />)
    expect(screen.getByText('online.joiningRoom')).toBeDefined()
  })
})

describe('OnlineRoomPage — error state', () => {
  it('shows error message and retry button', () => {
    vi.mocked(useOnlineRoomController).mockReturnValue(
      makeController({ joinStatus: 'error', error: 'Room not found' }) as any
    )
    render(<OnlineRoomPage />)
    expect(screen.getByText('Room not found')).toBeDefined()
  })

  it('calls handleRetry when retry button is clicked', () => {
    const handleRetry = vi.fn()
    vi.mocked(useOnlineRoomController).mockReturnValue(
      makeController({ joinStatus: 'error', error: 'err', handleRetry }) as any
    )
    render(<OnlineRoomPage />)
    fireEvent.click(screen.getByText('online.tryAgain'))
    expect(handleRetry).toHaveBeenCalledOnce()
  })
})

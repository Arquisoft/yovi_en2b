import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnlineLobbyPage } from '@/pages/OnlineLobbyPage'
import { useOnlineLobbyController } from '@/controllers/useOnlineLobbyController'

// --- Mocks ---

vi.mock('@/controllers/useOnlineLobbyController', () => ({
  useOnlineLobbyController: vi.fn(),
}))

// Mock de react-i18next para evitar problemas con las traducciones en los tests
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      const messages: Record<string, string> = {
        'online.connecting': 'Connecting to server...',
        'online.lookingForOpponent': 'Looking for opponent...',
        'online.matched': 'Opponent found!',
        'online.connectionError': 'Connection error',
        'online.leaveQueue': 'Leave Queue',
        'online.tryAgain': 'Try again',
        'common.back': 'Back',
        'online.playingAgainst': `Playing against ${params?.name}`,
      }
      return messages[key] || key
    },
  }),
}))

function makeController(overrides: Record<string, any> = {}) {
  return {
    status: 'connecting',
    opponentName: null,
    error: null,
    queueSize: 0,
    leaveQueue: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useOnlineLobbyController).mockReturnValue(makeController() as any)
})

// --- Suite de Tests ---

describe('OnlineLobbyPage — connecting state', () => {
  it('shows connecting heading and icon', () => {
    render(<OnlineLobbyPage />)
    expect(screen.getByText('Connecting to server...')).toBeDefined()
  })

  it('does not show Leave Queue button while connecting', () => {
    render(<OnlineLobbyPage />)
    expect(screen.queryByRole('button', { name: /leave queue/i })).toBeNull()
  })
})

describe('OnlineLobbyPage — queuing state', () => {
  beforeEach(() => {
    vi.mocked(useOnlineLobbyController).mockReturnValue(
      makeController({ status: 'queuing', queueSize: 1 }) as any
    )
  })

  it('shows looking for opponent text and Leave button', () => {
    render(<OnlineLobbyPage />)
    expect(screen.getByText('Looking for opponent...')).toBeDefined()
    expect(screen.getByRole('button', { name: /leave queue/i })).toBeDefined()
  })

  it('calls leaveQueue when button is clicked', () => {
    const leaveQueue = vi.fn()
    vi.mocked(useOnlineLobbyController).mockReturnValue(
      makeController({ status: 'queuing', leaveQueue }) as any
    )
    
    render(<OnlineLobbyPage />)
    fireEvent.click(screen.getByRole('button', { name: /leave queue/i }))
    
    expect(leaveQueue).toHaveBeenCalledOnce()
  })
})

describe('OnlineLobbyPage — matched state', () => {
  beforeEach(() => {
    vi.mocked(useOnlineLobbyController).mockReturnValue(
      makeController({ status: 'matched', opponentName: 'Bob' }) as any
    )
  })

  it('shows matched heading and opponent name', () => {
    render(<OnlineLobbyPage />)
    expect(screen.getByText('Opponent found!')).toBeDefined()
    expect(screen.getByText(/Playing against Bob/)).toBeDefined()
  })

  it('hides action buttons when matched', () => {
    render(<OnlineLobbyPage />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('OnlineLobbyPage — error state', () => {
  const errorMsg = 'WebSocket connection failed'
  
  beforeEach(() => {
    vi.mocked(useOnlineLobbyController).mockReturnValue(
      makeController({ status: 'error', error: errorMsg }) as any
    )
  })

  it('shows error heading and specific message', () => {
    render(<OnlineLobbyPage />)
    expect(screen.getByText('Connection error')).toBeDefined()
    expect(screen.getByText(errorMsg)).toBeDefined()
  })

  it('renders Back and Try again buttons', () => {
    render(<OnlineLobbyPage />)
    expect(screen.getByRole('button', { name: /back/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined()
  })

  it('triggers retry and leaveQueue actions', () => {
    const retry = vi.fn()
    const leaveQueue = vi.fn()
    
    vi.mocked(useOnlineLobbyController).mockReturnValue(
      makeController({ status: 'error', error: 'err', retry, leaveQueue }) as any
    )
    
    render(<OnlineLobbyPage />)
    
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(retry).toHaveBeenCalledOnce()
    
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(leaveQueue).toHaveBeenCalledOnce()
  })
})
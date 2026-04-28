import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OnlineHostLobbyPage } from '@/pages/OnlineHostLobbyPage'
import { useOnlineHostLobbyController } from '@/controllers/useOnlineHostLobbyController'

vi.mock('@/controllers/useOnlineHostLobbyController', () => ({
  useOnlineHostLobbyController: vi.fn(),
}))

vi.mock('@/components/online/LobbyVariantBadge', () => ({
  LobbyVariantBadge: ({ variant }: { variant: string }) => <span>{variant}-badge</span>,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'online.connecting': 'Connecting...',
        'online.connectingHint': 'Please wait',
        'online.waitingForOpponent': 'Waiting for opponent',
        'online.waitingForOpponentHint': 'Share the code',
        'online.roomCode': 'Room code',
        'online.codeCopied': 'Copied!',
        'online.copyCode': 'Copy code',
        'online.cancelRoom': 'Cancel room',
        'online.matched': 'Opponent found!',
        'online.playingAgainst': `Playing against ${params?.name}`,
        'online.connectionError': 'Connection error',
        'online.tryAgain': 'Try again',
        'common.back': 'Back',
      }
      return map[key] ?? key
    },
  }),
}))

function makeController(overrides: Record<string, unknown> = {}) {
  return {
    status: 'connecting' as const,
    roomCode: null,
    opponentName: null,
    error: null,
    copied: false,
    variant: 'y',
    handleCancel: vi.fn(),
    handleCopy: vi.fn(),
    handleRetry: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useOnlineHostLobbyController).mockReturnValue(makeController() as any)
})

describe('OnlineHostLobbyPage — connecting', () => {
  it('shows connecting heading', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('Connecting...')).toBeDefined()
  })

  it('shows variant badge', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('y-badge')).toBeDefined()
  })
})

describe('OnlineHostLobbyPage — waiting', () => {
  beforeEach(() => {
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'waiting', roomCode: 'ABC123' }) as any
    )
  })

  it('shows room code', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('ABC123')).toBeDefined()
  })

  it('shows copy button and cancel button', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByRole('button', { name: /copy code/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /cancel room/i })).toBeDefined()
  })

  it('calls handleCopy when copy button is clicked', () => {
    const handleCopy = vi.fn()
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'waiting', roomCode: 'ABC123', handleCopy }) as any
    )
    render(<OnlineHostLobbyPage />)
    fireEvent.click(screen.getByRole('button', { name: /copy code/i }))
    expect(handleCopy).toHaveBeenCalledOnce()
  })

  it('shows Copied! when copied is true', () => {
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'waiting', roomCode: 'ABC123', copied: true }) as any
    )
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('Copied!')).toBeDefined()
  })

  it('calls handleCancel when cancel button is clicked', () => {
    const handleCancel = vi.fn()
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'waiting', roomCode: 'ABC123', handleCancel }) as any
    )
    render(<OnlineHostLobbyPage />)
    fireEvent.click(screen.getByRole('button', { name: /cancel room/i }))
    expect(handleCancel).toHaveBeenCalledOnce()
  })
})

describe('OnlineHostLobbyPage — matched', () => {
  beforeEach(() => {
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'matched', opponentName: 'Alice' }) as any
    )
  })

  it('shows matched heading and opponent name', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('Opponent found!')).toBeDefined()
    expect(screen.getByText(/Playing against Alice/)).toBeDefined()
  })
})

describe('OnlineHostLobbyPage — error', () => {
  const errorMsg = 'WebSocket failed'

  beforeEach(() => {
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'error', error: errorMsg }) as any
    )
  })

  it('shows error heading and message', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.getByText('Connection error')).toBeDefined()
    expect(screen.getByText(errorMsg)).toBeDefined()
  })

  it('does not show variant badge on error', () => {
    render(<OnlineHostLobbyPage />)
    expect(screen.queryByText('y-badge')).toBeNull()
  })

  it('calls handleRetry and handleCancel', () => {
    const handleRetry = vi.fn()
    const handleCancel = vi.fn()
    vi.mocked(useOnlineHostLobbyController).mockReturnValue(
      makeController({ status: 'error', error: errorMsg, handleRetry, handleCancel }) as any
    )
    render(<OnlineHostLobbyPage />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(handleRetry).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(handleCancel).toHaveBeenCalledOnce()
  })
})

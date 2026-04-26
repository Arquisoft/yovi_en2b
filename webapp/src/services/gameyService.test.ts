import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gameService } from './gameyService'

global.fetch = vi.fn()

const mockGame = {
  id: 'game-1',
  status: 'playing',
  currentTurn: 'player1',
  winner: null,
  moves: [],
  board: [],
  config: { mode: 'pve', boardSize: 5, timerEnabled: false },
  players: {
    player1: { id: '1', name: 'TestUser', color: 'player1' },
    player2: { id: 'bot', name: 'Bot (medium)', color: 'player2', isBot: true },
  },
  timer: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
const mockSummary = {
  id: 'game-1',
  config: { mode: 'pvp-local', boardSize: 5, timerEnabled: false },
  status: 'finished',
  phase: 'playing',
  players: {
    player1: { id: '1', name: 'TestUser', color: 'player1' },
    player2: { id: '2', name: 'Opponent', color: 'player2' },
  },
  winner: 'player1',
  moveCount: 8,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}
 

beforeEach(() => {
  vi.clearAllMocks()
    ; (gameService as any).chatMessages = new Map()
})

describe('GameService', () => {
  describe('createGame', () => {
    it('calls POST /api/games with config and token', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGame,
      } as any)

      const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
      const result = await gameService.createGame(config, 'test-token')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/games'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      )
      expect(result.id).toBe('game-1')
    })

    it('throws on error response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      } as any)

      const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
      await expect(gameService.createGame(config, 'token')).rejects.toThrow('Server error')
    })
  })

  describe('getGameState', () => {
    it('calls GET /api/games/:id and returns game', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGame,
      } as any)

      const result = await gameService.getGameState('game-1')
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/games/game-1'))
      expect(result?.id).toBe('game-1')
    })

    it('returns null on 404', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as any)
      const result = await gameService.getGameState('nonexistent')
      expect(result).toBeNull()
    })

    it('throws on non-404 error', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as any)
      await expect(gameService.getGameState('game-1')).rejects.toThrow()
    })
  })

 describe('getUserGames', () => {
    it('calls GET /api/games with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSummary],
      } as any)
 
      await gameService.getUserGames('my-token')
 
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/games'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        })
      )
    })
 
    it('does NOT include a method (defaults to GET)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any)
 
      await gameService.getUserGames('token')
 
      const [, options] = vi.mocked(fetch).mock.calls[0]
      expect((options as RequestInit).method).toBeUndefined()
    })
 
    it('returns an array of game summaries on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSummary, { ...mockSummary, id: 'game-2' }],
      } as any)
 
      const result = await gameService.getUserGames('token')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('game-1')
      expect(result[1].id).toBe('game-2')
    })
 
    it('returns an empty array when server returns empty array', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any)
 
      const result = await gameService.getUserGames('token')
      expect(result).toHaveLength(0)
    })
 
    it('summaries contain moveCount', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [mockSummary],
      } as any)
 
      const [summary] = await gameService.getUserGames('token')
      expect(summary.moveCount).toBe(8)
    })
 
    it('throws using data.error on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      } as any)
 
      await expect(gameService.getUserGames('bad-token')).rejects.toThrow('Unauthorized')
    })
 
    it('throws generic message when json() fails on error response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json') },
      } as any)
 
      await expect(gameService.getUserGames('token')).rejects.toThrow('Failed to fetch game history')
    })
 
 
  })


  describe('playMove', () => {
    it('calls POST /api/games/:id/move with row, col, player', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockGame, moves: [{ row: 0, col: 0 }] }),
      } as any)

      await gameService.playMove('game-1', 0, 0, 'player1', 'token')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/games/game-1/move'),
        expect.objectContaining({ method: 'POST' })
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body).toMatchObject({ row: 0, col: 0, player: 'player1' })
    })

    it('throws on server error with message', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Not your turn' }),
      } as any)

      await expect(gameService.playMove('game-1', 0, 0, 'player2')).rejects.toThrow('Not your turn')
    })

    it('sends Authorization header when token provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGame,
      } as any)

      await gameService.playMove('game-1', 0, 0, 'player1', 'my-token')

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        })
      )
    })

    it('omits Authorization header when no token provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => mockGame,
      } as any)

      await gameService.playMove('game-1', 0, 0, 'player1')

      const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
      expect(headers?.Authorization).toBeUndefined()
    })
  })

  describe('surrender', () => {
    it('calls POST /api/games/:id/surrender', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockGame, status: 'finished', winner: 'player2' }),
      } as any)

      const result = await gameService.surrender('game-1', 'player1', 'token')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/games/game-1/surrender'),
        expect.objectContaining({ method: 'POST' })
      )
      expect(result.winner).toBe('player2')
      expect(result.status).toBe('finished')
    })

    it('throws on error', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Game not found' }),
      } as any)

      await expect(gameService.surrender('bad-id', 'player1')).rejects.toThrow('Game not found')
    })

    it('omits Authorization header when no token provided', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockGame, status: 'finished', winner: 'player2' }),
      } as any)

      await gameService.surrender('game-1', 'player1')

      const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
      expect(headers?.Authorization).toBeUndefined()
    })
  })

  describe('getChatMessages', () => {
    it('returns empty array for unknown game', async () => {
      const messages = await gameService.getChatMessages('nonexistent')
      expect(messages).toEqual([])
    })

    it('returns messages after sending', async () => {
      await gameService.sendChatMessage('game-1', 'user1', 'TestUser', 'hello')
      const messages = await gameService.getChatMessages('game-1')
      expect(messages.some((m) => m.content === 'hello')).toBe(true)
    })
  })

  describe('sendChatMessage', () => {
    it('returns message with correct fields', async () => {
      const msg = await gameService.sendChatMessage('game-1', 'user1', 'TestUser', 'hi')
      expect(msg).toMatchObject({
        gameId: 'game-1',
        senderId: 'user1',
        senderName: 'TestUser',
        content: 'hi',
      })
      expect(msg.id).toBeDefined()
      expect(msg.timestamp).toBeDefined()
    })

    it('accumulates multiple messages', async () => {
      await gameService.sendChatMessage('game-1', 'user1', 'A', 'msg1')
      await gameService.sendChatMessage('game-1', 'user1', 'A', 'msg2')
      const messages = await gameService.getChatMessages('game-1')
      expect(messages.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getAvailableGames', () => {
    it('returns array of games', async () => {
      const games = await gameService.getAvailableGames()
      expect(Array.isArray(games)).toBe(true)
      expect(games.length).toBeGreaterThan(0)
    })
  })

  describe('error handling when response body is not valid JSON', () => {
    it('createGame falls back to generic error when json() rejects', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json') },
      } as any)

      const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
      await expect(gameService.createGame(config)).rejects.toThrow('Failed to create game')
    })

    it('playMove falls back to generic error when json() rejects', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json') },
      } as any)

      await expect(gameService.playMove('game-1', 0, 0, 'player1')).rejects.toThrow('Failed to play move')
    })

    it('surrender falls back to generic error when json() rejects', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json') },
      } as any)

      await expect(gameService.surrender('game-1', 'player1')).rejects.toThrow('Failed to surrender')
    })
  })
})

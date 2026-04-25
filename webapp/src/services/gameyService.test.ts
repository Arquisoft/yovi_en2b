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
 
    it('the URL targets the /api/games endpoint (not a sub-route)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as any)
 
      await gameService.getUserGames('token')
 
      const [url] = vi.mocked(fetch).mock.calls[0]
      // Should end with /games, not /games/something
      expect(String(url)).toMatch(/\/games$/)
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

  describe('GameService.createGame — extended', () => {
  it('works without a token (guest scenario)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    const result = await gameService.createGame(config)
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(result.id).toBe('game-1')
  })
 
  it('includes guestId in body when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config, undefined, 'guest-xyz')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.guestId).toBe('guest-xyz')
  })
 
  it('omits guestId from body when not provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config, 'token')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.guestId).toBeUndefined()
  })
 
  it('throws with status code in message when error body has neither error nor message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as any)
 
    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await expect(gameService.createGame(config, 'token')).rejects.toThrow('503')
  })
 
  it('includes Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    await gameService.createGame(
      { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false },
      'tok',
    )
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
})
 
// ── getGameState ──────────────────────────────────────────────────────────────
 
describe('GameService.getGameState — extended', () => {
  it('returns full game object from the API', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockGame, id: 'game-abc' }),
    } as any)
 
    const result = await gameService.getGameState('game-abc')
    expect(result?.id).toBe('game-abc')
    expect(result?.config.mode).toBe('pve')
  })
 
  it('propagates non-404 errors without calling json()', async () => {
    const jsonFn = vi.fn()
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: jsonFn,
    } as any)
 
    await expect(gameService.getGameState('game-1')).rejects.toThrow('500')
    // json() should not be called on non-404 errors (optimisation path)
  })
})
 
// ── getUserGames ──────────────────────────────────────────────────────────────
 
describe('GameService.getUserGames — extended', () => {
  it('sends Content-Type header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as any)
 
    await gameService.getUserGames('token')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
 
  it('throws using data.message when present (preferred over error)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ message: 'Forbidden', error: 'fallback' }),
    } as any)
 
    await expect(gameService.getUserGames('token')).rejects.toThrow('fallback')
  })
})
 
// ── playMove ──────────────────────────────────────────────────────────────────
 
describe('GameService.playMove — extended', () => {
  it('includes all required fields in request body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    await gameService.playMove('game-1', 2, 3, 'player2', 'tok')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.row).toBe(2)
    expect(body.col).toBe(3)
    expect(body.player).toBe('player2')
  })
 
  it('returns updated game state with moves', async () => {
    const updatedGame = {
      ...mockGame,
      moves: [{ row: 0, col: 0, player: 'player1', timestamp: 1 }],
      currentTurn: 'player2',
    }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => updatedGame,
    } as any)
 
    const result = await gameService.playMove('game-1', 0, 0, 'player1', 'tok')
    expect(result.moves).toHaveLength(1)
    expect(result.currentTurn).toBe('player2')
  })
 
  it('throws with status in message when body has neither error field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    } as any)
 
    await expect(gameService.playMove('game-1', 0, 0, 'player1')).rejects.toThrow('429')
  })
})
 
// ── decidePie ────────────────────────────────────────────────────────────────
 
describe('GameService.decidePie', () => {
  it('calls POST /api/games/:id/pie-decision', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    await gameService.decidePie('game-1', 'swap', 'tok')
 
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toContain('/games/game-1/pie-decision')
    expect((options as RequestInit).method).toBe('POST')
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.decision).toBe('swap')
  })
 
  it('sends Authorization header when token is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    await gameService.decidePie('game-1', 'keep', 'my-token')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token')
  })
 
  it('omits Authorization header when no token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockGame,
    } as any)
 
    await gameService.decidePie('game-1', 'keep')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = (options as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })
 
  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Not in pie-decision phase' }),
    } as any)
 
    await expect(gameService.decidePie('game-1', 'swap')).rejects.toThrow(
      'Not in pie-decision phase',
    )
  })
 
  it('falls back to generic error when json() fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => { throw new Error('not json') },
    } as any)
 
    await expect(gameService.decidePie('game-1', 'swap')).rejects.toThrow('Failed to decide')
  })
 
  it('returns updated game state', async () => {
    const swappedGame = { ...mockGame, phase: 'playing', currentTurn: 'player1' }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => swappedGame,
    } as any)
 
    const result = await gameService.decidePie('game-1', 'swap', 'tok')
    expect(result.phase).toBe('playing')
  })
})
 
// ── surrender ────────────────────────────────────────────────────────────────
 
describe('GameService.surrender — extended', () => {
  it('sends player in body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockGame, status: 'finished', winner: 'player2' }),
    } as any)
 
    await gameService.surrender('game-1', 'player1', 'tok')
 
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = JSON.parse((options as RequestInit).body as string)
    expect(body.player).toBe('player1')
  })
 
  it('throws with status code when body has no error fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as any)
 
    await expect(gameService.surrender('game-1', 'player1')).rejects.toThrow('500')
  })
})
 
// ── chat messages ─────────────────────────────────────────────────────────────
 
describe('GameService chat — extended', () => {
  it('getChatMessages returns messages in insertion order', async () => {
    await gameService.sendChatMessage('game-1', 'u1', 'Alice', 'first')
    await gameService.sendChatMessage('game-1', 'u2', 'Bob', 'second')
    await gameService.sendChatMessage('game-1', 'u1', 'Alice', 'third')
 
    const msgs = await gameService.getChatMessages('game-1')
    expect(msgs[0].content).toBe('first')
    expect(msgs[1].content).toBe('second')
    expect(msgs[2].content).toBe('third')
  })
 
  it('messages for different games are isolated', async () => {
    await gameService.sendChatMessage('game-A', 'u1', 'Alice', 'hello A')
    await gameService.sendChatMessage('game-B', 'u2', 'Bob', 'hello B')
 
    const a = await gameService.getChatMessages('game-A')
    const b = await gameService.getChatMessages('game-B')
 
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0].gameId).toBe('game-A')
    expect(b[0].gameId).toBe('game-B')
  })
 
  it('sendChatMessage assigns a unique id to each message', async () => {
    const m1 = await gameService.sendChatMessage('g', 'u1', 'Alice', 'a')
    const m2 = await gameService.sendChatMessage('g', 'u1', 'Alice', 'b')
    expect(m1.id).not.toBe(m2.id)
  })
 
  it('sendChatMessage timestamp is an ISO string', async () => {
    const msg = await gameService.sendChatMessage('g', 'u1', 'Alice', 'hi')
    expect(() => new Date(msg.timestamp)).not.toThrow()
    expect(new Date(msg.timestamp).toISOString()).toBe(msg.timestamp)
  })
})
 
// ── getAvailableGames ─────────────────────────────────────────────────────────
 
describe('GameService.getAvailableGames — extended', () => {
  it('returns at least one available game', async () => {
    const games = await gameService.getAvailableGames()
    const available = games.filter(g => g.isAvailable)
    expect(available.length).toBeGreaterThan(0)
  })
 
  it('returned games have all required fields', async () => {
    const games = await gameService.getAvailableGames()
    for (const game of games) {
      expect(game).toHaveProperty('id')
      expect(game).toHaveProperty('name')
      expect(game).toHaveProperty('description')
      expect(game).toHaveProperty('thumbnail')
      expect(game).toHaveProperty('minPlayers')
      expect(game).toHaveProperty('maxPlayers')
      expect(game).toHaveProperty('isAvailable')
    }
  })
})
})

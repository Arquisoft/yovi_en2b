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
  ;(gameService as any).chatMessages = new Map()
})

// ── createGame ────────────────────────────────────────────────────────────────

describe('GameService — createGame', () => {
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

  it('sends guestId in body when provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config, undefined, 'guest-xyz')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.guestId).toBe('guest-xyz')
  })

  it('omits Authorization header when no token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const config = { mode: 'pvp-local' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config)

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers?.Authorization).toBeUndefined()
  })

  it('omits guestId from body when not provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config, 'token')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.guestId).toBeUndefined()
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

  it('falls back to generic error when json() rejects', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json') },
    } as any)

    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await expect(gameService.createGame(config)).rejects.toThrow('Failed to create game')
  })

  it('sends config in request body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const config = { mode: 'pve' as const, boardSize: 9 as const, timerEnabled: true, timerSeconds: 300 }
    await gameService.createGame(config, 'token')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.config).toMatchObject({ mode: 'pve', boardSize: 9, timerSeconds: 300 })
  })

  it('uses Content-Type application/json', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const config = { mode: 'pve' as const, boardSize: 5 as const, timerEnabled: false }
    await gameService.createGame(config, 'token')

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })
})

// ── getGameState ──────────────────────────────────────────────────────────────

describe('GameService — getGameState', () => {
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

  it('returns full game state object', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    const result = await gameService.getGameState('game-1')
    expect(result).toMatchObject({
      id: 'game-1',
      status: 'playing',
      config: expect.objectContaining({ mode: 'pve' }),
    })
  })

  it('uses GET method (no method in options)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.getGameState('game-1')

    const callArgs = vi.mocked(fetch).mock.calls[0]
    // Either no options at all or no method specified
    const options = callArgs[1]
    expect((options as any)?.method).toBeUndefined()
  })
})

// ── getUserGames ──────────────────────────────────────────────────────────────

describe('GameService — getUserGames', () => {
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

  it('summaries contain winner', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockSummary],
    } as any)

    const [summary] = await gameService.getUserGames('token')
    expect(summary.winner).toBe('player1')
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
    expect(String(url)).toMatch(/\/games$/)
  })

  it('summaries contain config with mode', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockSummary],
    } as any)

    const [summary] = await gameService.getUserGames('token')
    expect(summary.config.mode).toBe('pvp-local')
  })

  it('summaries contain players', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [mockSummary],
    } as any)

    const [summary] = await gameService.getUserGames('token')
    expect(summary.players.player1.name).toBe('TestUser')
  })
})

// ── playMove ──────────────────────────────────────────────────────────────────

describe('GameService — playMove', () => {
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

  it('falls back to generic error when json() rejects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json') },
    } as any)

    await expect(gameService.playMove('game-1', 0, 0, 'player1')).rejects.toThrow('Failed to play move')
  })

  it('returns updated game state with moves', async () => {
    const updatedGame = { ...mockGame, moves: [{ row: 0, col: 0, player: 'player1' }] }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => updatedGame,
    } as any)

    const result = await gameService.playMove('game-1', 0, 0, 'player1', 'token')
    expect(result.moves).toHaveLength(1)
  })

  it('sends player2 correctly in the body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.playMove('game-1', 2, 1, 'player2', 'token')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body).toMatchObject({ row: 2, col: 1, player: 'player2' })
  })
})

// ── decidePie ─────────────────────────────────────────────────────────────────

describe('GameService — decidePie', () => {
  it('calls POST /api/games/:id/pie-decision with decision', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.decidePie('game-1', 'keep', 'token')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/games/game-1/pie-decision'),
      expect.objectContaining({ method: 'POST' })
    )
    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.decision).toBe('keep')
  })

  it('calls with swap decision', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.decidePie('game-1', 'swap', 'token')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.decision).toBe('swap')
  })

  it('sends Authorization header when token provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.decidePie('game-1', 'keep', 'my-token')

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token')
  })

  it('omits Authorization when no token', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => mockGame,
    } as any)

    await gameService.decidePie('game-1', 'keep')

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers?.Authorization).toBeUndefined()
  })

  it('throws on error response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Not in pie phase' }),
    } as any)

    await expect(gameService.decidePie('game-1', 'swap')).rejects.toThrow('Not in pie phase')
  })

  it('falls back to generic error when json() rejects', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json') },
    } as any)

    await expect(gameService.decidePie('game-1', 'swap')).rejects.toThrow('Failed to decide')
  })

  it('returns updated game state', async () => {
    const updatedGame = { ...mockGame, phase: 'playing' }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => updatedGame,
    } as any)

    const result = await gameService.decidePie('game-1', 'keep', 'token')
    expect(result.phase).toBe('playing')
  })
})

// ── surrender ─────────────────────────────────────────────────────────────────

describe('GameService — surrender', () => {
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

  it('sends Authorization header when token provided', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockGame, status: 'finished', winner: 'player2' }),
    } as any)

    await gameService.surrender('game-1', 'player1', 'my-token')

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer my-token')
  })

  it('sends player in the body', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockGame, status: 'finished', winner: 'player2' }),
    } as any)

    await gameService.surrender('game-1', 'player1', 'token')

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
    expect(body.player).toBe('player1')
  })

  it('falls back to generic error when json() rejects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new Error('not json') },
    } as any)

    await expect(gameService.surrender('game-1', 'player1')).rejects.toThrow('Failed to surrender')
  })

  it('surrendering player2 sets winner to player1', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ...mockGame, status: 'finished', winner: 'player1' }),
    } as any)

    const result = await gameService.surrender('game-1', 'player2', 'token')
    expect(result.winner).toBe('player1')
  })
})

// ── getChatMessages ───────────────────────────────────────────────────────────

describe('GameService — getChatMessages', () => {
  it('returns empty array for unknown game', async () => {
    const messages = await gameService.getChatMessages('nonexistent')
    expect(messages).toEqual([])
  })

  it('returns messages after sending', async () => {
    await gameService.sendChatMessage('game-1', 'user1', 'TestUser', 'hello')
    const messages = await gameService.getChatMessages('game-1')
    expect(messages.some((m) => m.content === 'hello')).toBe(true)
  })

  it('returns messages only for the correct gameId', async () => {
    await gameService.sendChatMessage('game-1', 'user1', 'TestUser', 'hello from game 1')
    await gameService.sendChatMessage('game-2', 'user2', 'OtherUser', 'hello from game 2')

    const game1Messages = await gameService.getChatMessages('game-1')
    const game2Messages = await gameService.getChatMessages('game-2')

    expect(game1Messages).toHaveLength(1)
    expect(game2Messages).toHaveLength(1)
    expect(game1Messages[0].content).toBe('hello from game 1')
    expect(game2Messages[0].content).toBe('hello from game 2')
  })

  it('returns all messages accumulated for a game', async () => {
    await gameService.sendChatMessage('game-1', 'user1', 'A', 'msg1')
    await gameService.sendChatMessage('game-1', 'user2', 'B', 'msg2')
    await gameService.sendChatMessage('game-1', 'user1', 'A', 'msg3')

    const messages = await gameService.getChatMessages('game-1')
    expect(messages).toHaveLength(3)
  })

  it('messages are in insertion order', async () => {
    await gameService.sendChatMessage('game-1', 'u1', 'A', 'first')
    await gameService.sendChatMessage('game-1', 'u2', 'B', 'second')

    const messages = await gameService.getChatMessages('game-1')
    expect(messages[0].content).toBe('first')
    expect(messages[1].content).toBe('second')
  })
})

// ── sendChatMessage ───────────────────────────────────────────────────────────

describe('GameService — sendChatMessage', () => {
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

  it('each message has a unique id', async () => {
    const msg1 = await gameService.sendChatMessage('game-1', 'u1', 'A', 'a')
    const msg2 = await gameService.sendChatMessage('game-1', 'u1', 'A', 'b')
    expect(msg1.id).not.toBe(msg2.id)
  })

  it('message timestamp is a valid ISO string', async () => {
    const msg = await gameService.sendChatMessage('game-1', 'u1', 'A', 'hi')
    expect(new Date(msg.timestamp).getTime()).not.toBeNaN()
  })

  it('stores the message under the correct gameId', async () => {
    await gameService.sendChatMessage('game-abc', 'u1', 'Name', 'text')
    const msgs = await gameService.getChatMessages('game-abc')
    expect(msgs[0].gameId).toBe('game-abc')
  })

  it('different senderNames are preserved', async () => {
    const msg = await gameService.sendChatMessage('game-1', 'u1', 'Alice', 'hello')
    expect(msg.senderName).toBe('Alice')
  })
})

// ── getAvailableGames ─────────────────────────────────────────────────────────

describe('GameService — getAvailableGames', () => {
  it('returns array of games', async () => {
    const games = await gameService.getAvailableGames()
    expect(Array.isArray(games)).toBe(true)
    expect(games.length).toBeGreaterThan(0)
  })

  it('each game has required fields', async () => {
    const games = await gameService.getAvailableGames()
    for (const game of games) {
      expect(game.id).toBeDefined()
      expect(game.name).toBeDefined()
      expect(game.description).toBeDefined()
      expect(typeof game.isAvailable).toBe('boolean')
      expect(typeof game.minPlayers).toBe('number')
      expect(typeof game.maxPlayers).toBe('number')
    }
  })

  it('does not call fetch (uses mock data)', async () => {
    await gameService.getAvailableGames()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('includes game-y as available', async () => {
    const games = await gameService.getAvailableGames()
    const gameY = games.find((g) => g.id === 'game-y')
    expect(gameY).toBeDefined()
    expect(gameY?.isAvailable).toBe(true)
  })
})

// ── error handling ────────────────────────────────────────────────────────────

describe('GameService — error handling when response body is not valid JSON', () => {
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
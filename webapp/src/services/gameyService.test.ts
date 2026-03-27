import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gameService } from './gameyService'

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
    ; (gameService as any).games = new Map()
    ; (gameService as any).rooms = new Map()
    ; (gameService as any).chatMessages = new Map()
  vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as any)
})

const mockConfig = {
  mode: 'pve' as const,
  boardSize: 5 as const,
  timerEnabled: false,
  botLevel: 'medium' as const,
  playerColor: 'player1' as const,
}

const mockUser = {
  id: 'user1',
  name: 'TestUser',
  color: 'player1' as const,
}

describe('GameService', () => {

  describe('createGame', () => {
    it('should create a pve game with user as player1', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      expect(game).toBeDefined()
      expect(game.players.player1.id).toBe('user1')
      expect(game.players.player2.isBot).toBe(true)
      expect(game.status).toBe('playing')
    })

    it('should create a pve game with user as player2', async () => {
      const config = { ...mockConfig, playerColor: 'player2' as const }
      const game = await gameService.createGame(config, mockUser)
      expect(game.players.player2.id).toBe('user1')
      expect(game.players.player1.isBot).toBe(true)
    })

    it('should create a pvp-local game with two local players', async () => {
      const config = { ...mockConfig, mode: 'pvp-local' as const }
      const game = await gameService.createGame(config, mockUser)
      expect(game.players.player1.isLocal).toBe(true)
      expect(game.players.player2.isLocal).toBe(true)
    })

    it('should store the game internally', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const retrieved = await gameService.getGameState(game.id)
      expect(retrieved?.id).toBe(game.id)
    })

    it('should create game with correct board size', async () => {
      const config = { ...mockConfig, boardSize: 5 as const }
      const game = await gameService.createGame(config, mockUser)
      expect(game.config.boardSize).toBe(5)
    })

    it('should return game after creation', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const result = await gameService.getGameState(game.id)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(game.id)
    })
  })

  describe('playMove', () => {
    it('should throw if not player turn', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await expect(
        gameService.playMove(game.id, 0, 0, 'player2')
      ).rejects.toThrow('Not your turn')
    })

    it('should apply move and change turn', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const updated = await gameService.playMove(game.id, 0, 0, 'player1')
      expect(updated.moves).toHaveLength(1)
      expect(updated.moves[0]).toMatchObject({ row: 0, col: 0, player: 'player1' })
    })

    it('should throw on invalid move to occupied cell', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.playMove(game.id, 0, 0, 'player1')
      const updated = await gameService.getGameState(game.id)
      await expect(
        gameService.playMove(game.id, 0, 0, updated!.currentTurn)
      ).rejects.toThrow('Invalid move')
    })

    it('should call saveMatchRecord when game finishes with token', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, status: 'finished', winner: 'player1' },
        'mock-token'
      )
      expect(fetch).toHaveBeenCalledWith(
        'http://api.localhost/users/api/stats/record',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('surrender', () => {
    it('should throw if game not found', async () => {
      await expect(
        gameService.surrender('nonexistent', 'player1')
      ).rejects.toThrow('Game not found')
    })

    it('should set winner as opposite player', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const result = await gameService.surrender(game.id, 'player1')
      expect(result.winner).toBe('player2')
      expect(result.status).toBe('finished')
    })

    it('should set winner correctly when player2 surrenders', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const result = await gameService.surrender(game.id, 'player2')
      expect(result.winner).toBe('player1')
    })

    it('should call saveMatchRecord with token when provided', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.surrender(game.id, 'player1', 'test-token')
      expect(fetch).toHaveBeenCalledWith(
        'http://api.localhost/users/api/stats/record',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        })
      )
    })

    it('should not call saveMatchRecord without token', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.surrender(game.id, 'player1')
      expect(fetch).not.toHaveBeenCalledWith(
        'http://api.localhost/users/api/stats/record',
        expect.anything()
      )
    })

    it('should disable timer on surrender', async () => {
      const config = { ...mockConfig, timerEnabled: true, timerSeconds: 300 }
      const game = await gameService.createGame(config, mockUser)
      const result = await gameService.surrender(game.id, 'player1')
      if (result.timer) {
        expect(result.timer.activePlayer).toBeNull()
      }
    })
  })

  describe('saveMatchRecord', () => {
    it('should not call fetch if no winner', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord({ ...game, winner: null }, 'token')
      expect(fetch).not.toHaveBeenCalledWith(
        'http://api.localhost/users/api/stats/record',
        expect.anything()
      )
    })

    it('should send win when player1 wins', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player1', status: 'finished' }, 'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.result).toBe('win')
    })

    it('should send loss when player2 wins', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player2', status: 'finished' }, 'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.result).toBe('loss')
    })

    it('should send opponent name', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player1', status: 'finished' }, 'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.opponentName).toBe(game.players.player2.name)
    })

    it('should not throw on fetch error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      const game = await gameService.createGame(mockConfig, mockUser)
      await expect(
        (gameService as any).saveMatchRecord(
          { ...game, winner: 'player1', status: 'finished' }, 'token'
        )
      ).resolves.not.toThrow()
    })
  })

  describe('getChatMessages', () => {
    it('should return empty array for unknown game', async () => {
      const messages = await gameService.getChatMessages('nonexistent')
      expect(messages).toEqual([])
    })

    it('should return messages after sending', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.sendChatMessage(game.id, 'user1', 'TestUser', 'hello')
      const messages = await gameService.getChatMessages(game.id)
      expect(messages.some(m => m.content === 'hello')).toBe(true)
    })
  })

  describe('sendChatMessage', () => {
    it('should return message with correct fields', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const msg = await gameService.sendChatMessage(game.id, 'user1', 'TestUser', 'hi')
      expect(msg).toMatchObject({
        gameId: game.id,
        senderId: 'user1',
        senderName: 'TestUser',
        content: 'hi',
      })
      expect(msg.id).toBeDefined()
      expect(msg.timestamp).toBeDefined()
    })

    it('should accumulate multiple messages', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.sendChatMessage(game.id, 'user1', 'A', 'msg1')
      await gameService.sendChatMessage(game.id, 'user1', 'A', 'msg2')
      const messages = await gameService.getChatMessages(game.id)
      expect(messages.length).toBeGreaterThanOrEqual(2)
    })

    it('should accumulate multiple messages', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      await gameService.sendChatMessage(game.id, 'user1', 'A', 'msg1')
      await gameService.sendChatMessage(game.id, 'user1', 'A', 'msg2')
      const messages = await gameService.getChatMessages(game.id)
      expect(messages.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('getAvailableGames', () => {
    it('should return array of games', async () => {
      const games = await gameService.getAvailableGames()
      expect(Array.isArray(games)).toBe(true)
      expect(games.length).toBeGreaterThan(0)
    })
  })

  describe('startTimerCheck', () => {
  it('should finish game when player1 runs out of time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)

    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      timer: {
        ...currentGame.timer,
        player1RemainingMs: 100,
        lastSyncTimestamp: Date.now() - 200,
      }
    })

    await vi.advanceTimersByTimeAsync(600)

    const updated = await gameService.getGameState(game.id)
    expect(updated?.status).toBe('finished')
    expect(updated?.winner).toBe('player2')
    vi.useRealTimers()
  })

  it('should finish game when player2 runs out of time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)

    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      currentTurn: 'player2',
      timer: {
        ...currentGame.timer,
        activePlayer: 'player2',
        player2RemainingMs: 100,
        lastSyncTimestamp: Date.now() - 200,
      }
    })

    await vi.advanceTimersByTimeAsync(600)

    const updated = await gameService.getGameState(game.id)
    expect(updated?.status).toBe('finished')
    expect(updated?.winner).toBe('player1')
    vi.useRealTimers()
  })

  it('should not modify finished games', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)

    ;(gameService as any).games.set(game.id, {
      ...(gameService as any).games.get(game.id),
      status: 'finished',
      winner: 'player1',
    })

    await vi.advanceTimersByTimeAsync(600)

    const updated = await gameService.getGameState(game.id)
    expect(updated?.winner).toBe('player1')
    vi.useRealTimers()
  })

  it('should not run timer check if no timer configured', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const game = await gameService.createGame(mockConfig, mockUser)

    await vi.advanceTimersByTimeAsync(600)

    const updated = await gameService.getGameState(game.id)
    expect(updated?.status).toBe('playing')
    vi.useRealTimers()
  })
})

describe('getRooms', () => {
  it('should return mock rooms when no rooms created', async () => {
    const rooms = await gameService.getRooms()
    expect(Array.isArray(rooms)).toBe(true)
    expect(rooms.length).toBeGreaterThan(0)
  })

  it('should include created public rooms', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test Room', isPrivate: false }
    await gameService.createRoom(config, mockUser)
    const rooms = await gameService.getRooms()
    expect(rooms.some(r => r.name === 'Test Room')).toBe(true)
  })

  it('should not include private rooms', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Private', isPrivate: true }
    await gameService.createRoom(config, mockUser)
    const rooms = await gameService.getRooms()
    expect(rooms.some(r => r.name === 'Private')).toBe(false)
  })
})

describe('getRoom', () => {
  it('should return null for unknown room', async () => {
    const result = await gameService.getRoom('nonexistent')
    expect(result).toBeNull()
  })

  it('should return room after creation', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    const result = await gameService.getRoom(room.id)
    expect(result?.id).toBe(room.id)
  })
})

describe('createRoom', () => {
  it('should create a room with correct config', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 7 as const, timerEnabled: false, roomName: 'My Room', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    expect(room.name).toBe('My Room')
    expect(room.boardSize).toBe(7)
    expect(room.playerCount).toBe(1)
  })
})

describe('joinRoom', () => {
  it('should throw if room not found', async () => {
    await expect(
      gameService.joinRoom('nonexistent', mockUser)
    ).rejects.toThrow('Room not found')
  })

  it('should increment player count', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    const joined = await gameService.joinRoom(room.id, { ...mockUser, id: 'user2' })
    expect(joined.playerCount).toBe(2)
  })

  it('should throw if room is full', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    await gameService.joinRoom(room.id, { ...mockUser, id: 'user2' })
    await expect(
      gameService.joinRoom(room.id, { ...mockUser, id: 'user3' })
    ).rejects.toThrow('Room is full')
  })
})

describe('startGameFromRoom', () => {
  it('should throw if room not found', async () => {
    await expect(
      gameService.startGameFromRoom('nonexistent')
    ).rejects.toThrow('Room not found')
  })

  it('should throw if not enough players', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    await expect(
      gameService.startGameFromRoom(room.id)
    ).rejects.toThrow('Not enough players')
  })

  it('should create game when room has 2 players', async () => {
    const config = { mode: 'pvp-online' as const, boardSize: 5 as const, timerEnabled: false, roomName: 'Test', isPrivate: false }
    const room = await gameService.createRoom(config, mockUser)
    await gameService.joinRoom(room.id, { ...mockUser, id: 'user2', name: 'User2' })
    const game = await gameService.startGameFromRoom(room.id)
    expect(game.status).toBe('playing')
    expect(game.config.mode).toBe('pvp-online')
  })
})

describe('playMove with timer', () => {
  it('should deduct time from active player', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 300 }
    const game = await gameService.createGame(config, mockUser)
    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      timer: { ...currentGame.timer, lastSyncTimestamp: Date.now() - 5000 }
    })
    const updated = await gameService.playMove(game.id, 0, 0, 'player1')
    expect(updated.timer?.player1RemainingMs).toBeLessThan(300000)
  })

  it('should finish game when player runs out of time on move', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)
    ;(gameService as any).games.set(game.id, {
      ...(gameService as any).games.get(game.id),
      timer: {
        ...(gameService as any).games.get(game.id).timer,
        player1RemainingMs: 0,
        lastSyncTimestamp: Date.now() - 2000,
      }
    })
    const updated = await gameService.playMove(game.id, 0, 0, 'player1')
    expect(updated.status).toBe('finished')
    expect(updated.winner).toBe('player2')
  })
})

describe('scheduleBotMove', () => {
  it('should call bot API and play bot move after human move', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const botCoords = { coords: { x: 1, y: 0, z: -1 } }
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => botCoords,
    } as any)

    const game = await gameService.createGame(mockConfig, mockUser)
    await gameService.playMove(game.id, 0, 0, 'player1')

    await vi.runAllTimersAsync()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ybot/choose/minimax_bot'),
      expect.objectContaining({ method: 'POST' })
    )

    const updated = await gameService.getGameState(game.id)
    expect(updated?.moves.length).toBeGreaterThanOrEqual(2)

    vi.useRealTimers()
  })

  it('should not crash if bot API returns error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as any)

    const game = await gameService.createGame(mockConfig, mockUser)
    await gameService.playMove(game.id, 0, 0, 'player1')

    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()

    vi.useRealTimers()
  })

  it('should not crash if fetch throws', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    const game = await gameService.createGame(mockConfig, mockUser)
    await gameService.playMove(game.id, 0, 0, 'player1')

    await expect(vi.runAllTimersAsync()).resolves.not.toThrow()

    vi.useRealTimers()
  })

  it('should not make bot move if game is finished before timeout fires', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })

  vi.mocked(fetch).mockImplementation(async (url) => {
    // Simulate network latency so we can cancel before it plays
    await new Promise(res => setTimeout(res, 100))
    return {
      ok: true,
      json: async () => ({ coords: { x: 1, y: 0, z: -1 } }),
    } as any
  })

  const game = await gameService.createGame(mockConfig, mockUser)
  await gameService.playMove(game.id, 0, 0, 'player1')

  // Finish game before bot move is applied
  ;(gameService as any).games.set(game.id, {
    ...(gameService as any).games.get(game.id),
    status: 'finished',
    winner: 'player1',
  })

  await vi.runAllTimersAsync()

  // fetch may have been called, but the move should NOT have been applied
  const updated = await gameService.getGameState(game.id)
  expect(updated?.moves).toHaveLength(1) // solo el movimiento humano
  expect(updated?.status).toBe('finished')
  expect(updated?.winner).toBe('player1')

  vi.useRealTimers()
})
})

describe('playMove triggering saveMatchRecord', () => {
  it('should call saveMatchRecord when move causes game to finish', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    } as any)

    // Use pvp-local so no bot move is scheduled
    const config = { ...mockConfig, mode: 'pvp-local' as const }
    const game = await gameService.createGame(config, mockUser)

    // Force a near-win state: player1 wins on next move
    const { checkWinner } = await import('@/utils/gameY')
    vi.spyOn({ checkWinner }, 'checkWinner').mockReturnValue('player1')

    // Directly manipulate to make checkWinner return winner
    // Easier: force via internal game state — fill board almost
    // Instead, test saveMatchRecord is called by spying on private method
    const saveSpy = vi.spyOn(gameService as any, 'saveMatchRecord').mockResolvedValue(undefined)

    const updatedGame = {
      ...(gameService as any).games.get(game.id),
      players: {
        player1: { id: 'local-p1', name: 'Player 1', color: 'player1', isLocal: true },
        player2: { id: 'local-p2', name: 'Player 2', color: 'player2', isLocal: true },
      },
    }
    ;(gameService as any).games.set(game.id, updatedGame)

    // Mock checkWinner to return a winner
    const gameY = await import('@/utils/gameY')
    vi.spyOn(gameY, 'checkWinner').mockReturnValue('player1')

    await gameService.playMove(game.id, 2, 2, 'player1', 'test-token')

    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ winner: 'player1', status: 'finished' }),
      'test-token'
    )

    saveSpy.mockRestore()
    vi.restoreAllMocks()
  })
})

describe('startGameFromRoom with timer', () => {
  it('should start timer check when room game starts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const config = {
      mode: 'pvp-online' as const,
      boardSize: 5 as const,
      timerEnabled: true,
      timerSeconds: 1,
      roomName: 'Timed Room',
      isPrivate: false,
    }

    const room = await gameService.createRoom(config, mockUser)
    await gameService.joinRoom(room.id, { ...mockUser, id: 'user2', name: 'User2' })
    const game = await gameService.startGameFromRoom(room.id)

    // Drain the time of the active player
    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      timer: {
        ...currentGame.timer,
        player1RemainingMs: 100,
        lastSyncTimestamp: Date.now() - 200,
      },
    })

    await vi.advanceTimersByTimeAsync(600)

    const updated = await gameService.getGameState(game.id)
    expect(updated?.status).toBe('finished')

    vi.useRealTimers()
  })
})

describe('computeUpdatedTimer', () => {
  it('should deduct time from player2 when player2 is active', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 300 }
    const game = await gameService.createGame(config, mockUser)

    // Force player2 turn
    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      currentTurn: 'player2',
      timer: {
        ...currentGame.timer,
        activePlayer: 'player2',
        lastSyncTimestamp: Date.now() - 5000,
      },
    })

    const updated = await gameService.playMove(game.id, 0, 0, 'player2')
    expect(updated.timer?.player2RemainingMs).toBeLessThan(300000)
  })

  it('should not deduct time when timer activePlayer differs from current player', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 300 }
    const game = await gameService.createGame(config, mockUser)

    const currentGame = (gameService as any).games.get(game.id)
    ;(gameService as any).games.set(game.id, {
      ...currentGame,
      timer: {
        ...currentGame.timer,
        activePlayer: 'player2', // player2 is active but player1 is moving
        lastSyncTimestamp: Date.now() - 5000,
      },
    })

    const updated = await gameService.playMove(game.id, 0, 0, 'player1')
    expect(updated.timer?.player1RemainingMs).toBe(300000)
  })
})

describe('timedOutPlayer', () => {
  it('should return player2 when player1 time is 0', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)

    ;(gameService as any).games.set(game.id, {
      ...(gameService as any).games.get(game.id),
      timer: {
        ...(gameService as any).games.get(game.id).timer,
        player1RemainingMs: 0,
        lastSyncTimestamp: Date.now(),
      },
    })

    const updated = await gameService.playMove(game.id, 0, 0, 'player1')
    expect(updated.winner).toBe('player2')
  })

  it('should return player1 when player2 time is 0', async () => {
    const config = { ...mockConfig, timerEnabled: true, timerSeconds: 1 }
    const game = await gameService.createGame(config, mockUser)

    ;(gameService as any).games.set(game.id, {
      ...(gameService as any).games.get(game.id),
      currentTurn: 'player2',
      timer: {
        ...(gameService as any).games.get(game.id).timer,
        activePlayer: 'player2',
        player2RemainingMs: 0,
        lastSyncTimestamp: Date.now(),
      },
    })

    const updated = await gameService.playMove(game.id, 0, 0, 'player2')
    expect(updated.winner).toBe('player1')
  })

  it('should return null when no timer', async () => {
    const result = (gameService as any).timedOutPlayer(null)
    expect(result).toBeNull()
  })

  it('should return null when both players have time remaining', async () => {
    const result = (gameService as any).timedOutPlayer({
      player1RemainingMs: 10000,
      player2RemainingMs: 10000,
      activePlayer: 'player1',
      lastSyncTimestamp: Date.now(),
    })
    expect(result).toBeNull()
  })
})

describe('waitForBotMove', () => {
  it('should return game when bot has moved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ coords: { x: 1, y: 0, z: -1 } }),
    } as any)

    const game = await gameService.createGame(mockConfig, mockUser)
    const initialMoves = game.moves.length

    // Simulate bot move happening after a delay
    setTimeout(() => {
      const current = (gameService as any).games.get(game.id)
      if (current) {
        ;(gameService as any).games.set(game.id, {
          ...current,
          moves: [...current.moves, { row: 1, col: 0, player: 'player2', timestamp: Date.now() }],
        })
      }
    }, 100)

    const resultPromise = gameService.waitForBotMove(game.id, initialMoves)
    await vi.advanceTimersByTimeAsync(200)
    const result = await resultPromise

    expect(result?.moves.length).toBeGreaterThan(initialMoves)
    vi.useRealTimers()
  })

  it('should return null for unknown game', async () => {
    const result = await gameService.waitForBotMove('nonexistent', 0)
    expect(result).toBeNull()
  })

  it('should return game when status is finished', async () => {
    const game = await gameService.createGame(mockConfig, mockUser)
    ;(gameService as any).games.set(game.id, {
      ...(gameService as any).games.get(game.id),
      status: 'finished',
      winner: 'player1',
    })

    const result = await gameService.waitForBotMove(game.id, 0)
    expect(result?.status).toBe('finished')
  })
})

describe('executeBotMove opening game', () => {
  it('should add delay when bot opens the game (0 moves)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ coords: { x: 1, y: 0, z: -1 } }),
    } as any)

    // Bot plays as player1 (opens the game)
    const config = { ...mockConfig, playerColor: 'player2' as const }
    const game = await gameService.createGame(config, mockUser)

    await vi.advanceTimersByTimeAsync(500)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ybot/choose/minimax_bot'),
      expect.anything()
    )

    vi.useRealTimers()
  })
})

})
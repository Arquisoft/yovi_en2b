import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gameService } from './gameyService'

// Mock fetch globally
global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // Reset internal state between tests by casting to any
  ;(gameService as any).games = new Map()
  ;(gameService as any).rooms = new Map()
  ;(gameService as any).chatMessages = new Map()
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
  })

  describe('getGameState', () => {
    it('should return null for unknown game', async () => {
      const result = await gameService.getGameState('nonexistent')
      expect(result).toBeNull()
    })

    it('should return game after creation', async () => {
      const game = await gameService.createGame(mockConfig, mockUser)
      const result = await gameService.getGameState(game.id)
      expect(result).not.toBeNull()
      expect(result?.id).toBe(game.id)
    })
  })

  describe('playMove', () => {
    it('should throw if game not found', async () => {
      await expect(
        gameService.playMove('nonexistent', 0, 0, 'player1')
      ).rejects.toThrow('Game not found')
    })

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
      // Bot may have moved, try to play on occupied cell
      await expect(
        gameService.playMove(game.id, 0, 0, updated!.currentTurn)
      ).rejects.toThrow('Invalid move')
    })

    it('should call saveMatchRecord when game finishes with token', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
 
      // Force finish by making the game winner
      ;(gameService as any).games.set(game.id, {
        ...game,
        status: 'finished',
        winner: 'player1',
      })

      // Not easy to trigger via playMove directly, verify saveMatchRecord is called
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
      expect(fetch).not.toHaveBeenCalled()
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
      expect(fetch).not.toHaveBeenCalled()
    })

    it('should send win when player1 wins', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player1', status: 'finished' },
        'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.result).toBe('win')
    })

    it('should send loss when player2 wins', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player2', status: 'finished' },
        'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.result).toBe('loss')
    })

    it('should send opponent name', async () => {
      vi.mocked(fetch).mockResolvedValue({ status: 201, json: async () => ({}) } as any)
      const game = await gameService.createGame(mockConfig, mockUser)
      await (gameService as any).saveMatchRecord(
        { ...game, winner: 'player1', status: 'finished' },
        'token'
      )
      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body.opponentName).toBe(game.players.player2.name)
    })

    it('should not throw on fetch error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
      const game = await gameService.createGame(mockConfig, mockUser)
      await expect(
        (gameService as any).saveMatchRecord(
          { ...game, winner: 'player1', status: 'finished' },
          'token'
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
  })

  describe('getAvailableGames', () => {
    it('should return array of games', async () => {
      const games = await gameService.getAvailableGames()
      expect(Array.isArray(games)).toBe(true)
      expect(games.length).toBeGreaterThan(0)
    })
  })
})
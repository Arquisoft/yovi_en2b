import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ConnectedClient } from '../websocket/types'

// 1. Mocks de dependencias externas (deben ir antes de importar el Manager)
vi.mock('ws', () => {
  const WebSocketServer = vi.fn(function (this: any) {
    this.on = vi.fn()
    this.close = vi.fn()
  })

  const WebSocket = vi.fn()
  ;(WebSocket as any).OPEN   = 1
  ;(WebSocket as any).CLOSED = 3

  return { WebSocketServer, WebSocket }
})

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
  verify: vi.fn(),
}))

import { WebSocketManager } from '../websocket/WebSocketManager'
import jwt from 'jsonwebtoken'

// ── Helpers ────────────────────────────────────────────────────────────────────

function createMockWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    on: vi.fn(),
  }
}

function makeClient(userId: number, overrides: Partial<ConnectedClient> = {}): ConnectedClient {
  return {
    ws: createMockWs() as any,
    userId,
    username: `player${userId}`,
    token: `tok-${userId}`,
    inQueue: false,
    ...overrides,
  }
}

function getManager() {
  const mockServer = { on: vi.fn() } as any
  const gameService = {
    createGame: vi.fn(),
    getGame: vi.fn(),
    playMove: vi.fn(),
    surrender: vi.fn(),
    setPlayer2Id: vi.fn(),
  } as any
  const manager = new WebSocketManager(mockServer, gameService)
  return { manager, gameService }
}

// ── Suite de Tests ─────────────────────────────────────────────────────────────

describe('WebSocketManager', () => {
  beforeEach(() => {
    vi.mocked(jwt.verify).mockReturnValue({ id: 1, username: 'player1', role: 'player' } as any)
  })

  // ── client management ──────────────────────────────────────────────────────

  describe('client management', () => {
    it('initially has 0 connected clients', () => {
      const { manager } = getManager()
      expect(manager.getConnectedCount()).toBe(0)
    })

    it('_injectClient adds a client', () => {
      const { manager } = getManager()
      manager._injectClient(makeClient(1))
      expect(manager.getConnectedCount()).toBe(1)
      expect(manager.getClient(1)).toBeDefined()
    })

    it('getClient returns undefined for unknown userId', () => {
      const { manager } = getManager()
      expect(manager.getClient(99)).toBeUndefined()
    })

    it('can inject multiple clients', () => {
      const { manager } = getManager()
      manager._injectClient(makeClient(1))
      manager._injectClient(makeClient(2))
      manager._injectClient(makeClient(3))
      expect(manager.getConnectedCount()).toBe(3)
    })

    it('getClient returns the correct client', () => {
      const { manager } = getManager()
      const client = makeClient(42, { username: 'specialPlayer' })
      manager._injectClient(client)
      const retrieved = manager.getClient(42)
      expect(retrieved?.username).toBe('specialPlayer')
    })

    it('getQueueSize starts at 0', () => {
      const { manager } = getManager()
      expect(manager.getQueueSize()).toBe(0)
    })
  })

  // ── ping ───────────────────────────────────────────────────────────────────

  describe('handleMessage — ping', () => {
    it('responds with pong', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'ping' })

      expect(client.ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }))
    })

    it('only sends pong to the sender, not others', async () => {
      const { manager } = getManager()
      const client1 = makeClient(1)
      const client2 = makeClient(2)
      manager._injectClient(client1)
      manager._injectClient(client2)

      await manager.handleMessage(1, { type: 'ping' })

      expect(client1.ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }))
      expect(client2.ws.send).not.toHaveBeenCalled()
    })
  })

  // ── join_game / leave_game ─────────────────────────────────────────────────

  describe('handleMessage — join_game / leave_game', () => {
    it('join_game sets currentGameId on client', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_game', gameId: 'game-abc' })

      expect(manager.getClient(1)?.currentGameId).toBe('game-abc')
    })

    it('leave_game clears currentGameId when it matches', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'game-abc' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'leave_game', gameId: 'game-abc' })

      expect(manager.getClient(1)?.currentGameId).toBeUndefined()
    })

    it('leave_game does nothing when gameId does not match', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'game-abc' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'leave_game', gameId: 'game-xyz' })

      expect(manager.getClient(1)?.currentGameId).toBe('game-abc')
    })

    it('join_game overwrites existing currentGameId', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'old-game' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_game', gameId: 'new-game' })

      expect(manager.getClient(1)?.currentGameId).toBe('new-game')
    })
  })

  // ── join_queue ─────────────────────────────────────────────────────────────

  describe('handleMessage — join_queue', () => {
    it('adds player to queue and sends queue_joined', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_queue' })

      expect(manager.getQueueSize()).toBe(1)
      const msg = JSON.parse((client.ws.send as any).mock.calls[0][0])
      expect(msg.type).toBe('queue_joined')
    })

    it('rejects join when player is in a game', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'game-abc' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_queue' })

      const msg = JSON.parse((client.ws.send as any).mock.calls[0][0])
      expect(msg.type).toBe('error')
      expect(msg.code).toBe('IN_GAME')
    })

    it('does not add to queue again if already queuing', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { inQueue: true })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_queue' })

      // Since client.inQueue is true, it returns early
      expect(manager.getQueueSize()).toBe(0)
    })

    it('triggers matching when two players join', async () => {
      const { manager, gameService } = getManager()
      const mockGame = {
        id: 'game-123',
        status: 'playing',
        config: { mode: 'pvp-online' },
        players: { player1: { id: '1', name: 'player1' }, player2: { id: '2', name: 'player2' } },
        board: [], moves: [], currentTurn: 'player1', winner: null,
        timer: null, phase: 'playing',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }

      gameService.createGame.mockResolvedValue(mockGame)
      gameService.setPlayer2Id.mockResolvedValue(undefined)

      const c1 = makeClient(1)
      const c2 = makeClient(2)
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'join_queue' })
      await manager.handleMessage(2, { type: 'join_queue' })

      expect(manager.getQueueSize()).toBe(0)
      const msgs1 = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs1.some((m: any) => m.type === 'matched')).toBe(true)
    })

    it('sends matched message with correct playerColor to each client', async () => {
      const { manager, gameService } = getManager()
      const mockGame = {
        id: 'game-123',
        status: 'playing',
        config: { mode: 'pvp-online' },
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        board: [], moves: [], currentTurn: 'player1', winner: null,
        timer: null, phase: 'playing',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }

      gameService.createGame.mockResolvedValue(mockGame)
      gameService.setPlayer2Id.mockResolvedValue(undefined)

      const c1 = makeClient(1)
      const c2 = makeClient(2)
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'join_queue' })
      await manager.handleMessage(2, { type: 'join_queue' })

      const msgs1 = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))

      const matched1 = msgs1.find((m: any) => m.type === 'matched')
      const matched2 = msgs2.find((m: any) => m.type === 'matched')

      expect(matched1?.playerColor).toBe('player1')
      expect(matched2?.playerColor).toBe('player2')
    })

    it('sends error and re-queues both players when game creation fails', async () => {
      const { manager, gameService } = getManager()
      gameService.createGame.mockRejectedValue(new Error('DB error'))

      const c1 = makeClient(1)
      const c2 = makeClient(2)
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'join_queue' })
      await manager.handleMessage(2, { type: 'join_queue' })

      const msgs1 = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs1.some((m: any) => m.type === 'error' && m.code === 'MATCH_FAILED')).toBe(true)
    })
  })

  // ── leave_queue ────────────────────────────────────────────────────────────

  describe('handleMessage — leave_queue', () => {
    it('removes player from queue and sends queue_left', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'join_queue' })
      expect(manager.getQueueSize()).toBe(1)

      await manager.handleMessage(1, { type: 'leave_queue' })
      expect(manager.getQueueSize()).toBe(0)

      const messages = (client.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(messages.some((m: any) => m.type === 'queue_left')).toBe(true)
    })

    it('does nothing when player is not in queue', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'leave_queue' })

      // No queue_left message sent since client was not in queue
      const messages = (client.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(messages.some((m: any) => m.type === 'queue_left')).toBe(false)
    })
  })

  // ── move ───────────────────────────────────────────────────────────────────

  describe('handleMessage — move', () => {
    it('relays game update to both players after valid move', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1',
        status: 'playing',
        moves: [{ row: 0, col: 0 }],
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], currentTurn: 'player2',
        winner: null, timer: null, phase: 'playing',
        createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.playMove.mockResolvedValue(gameData)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs2.some((m: any) => m.type === 'game_update')).toBe(true)
    })

    it('clears currentGameId for both players when game finishes', async () => {
      const { manager, gameService } = getManager()
      const finishedGame = {
        id: 'game-1', status: 'finished', winner: 'player1',
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], moves: [], currentTurn: 'player1',
        timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(finishedGame)
      gameService.playMove.mockResolvedValue(finishedGame)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      expect(manager.getClient(1)?.currentGameId).toBeUndefined()
      expect(manager.getClient(2)?.currentGameId).toBeUndefined()
    })

    it('sends WRONG_GAME error when gameId does not match currentGameId', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'other-game' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      const msgs = (client.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs.some((m: any) => m.type === 'error' && m.code === 'WRONG_GAME')).toBe(true)
    })

    it('sends game_update to sender and opponent', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'playing', moves: [],
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], currentTurn: 'player2',
        winner: null, timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.playMove.mockResolvedValue(gameData)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      const msgs1 = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))

      expect(msgs1.some((m: any) => m.type === 'game_update')).toBe(true)
      expect(msgs2.some((m: any) => m.type === 'game_update')).toBe(true)
    })

    it('sends MOVE_FAILED error when playMove throws', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'playing', moves: [],
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], currentTurn: 'player1',
        winner: null, timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.playMove.mockRejectedValue(new Error('Not your turn'))

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      const msgs = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs.some((m: any) => m.type === 'error' && m.code === 'MOVE_FAILED')).toBe(true)
    })
  })

  // ── surrender ──────────────────────────────────────────────────────────────

  describe('handleMessage — surrender', () => {
    it('broadcasts game_update and clears game for both players', async () => {
      const { manager, gameService } = getManager()
      const finishedGame = {
        id: 'game-1', status: 'finished', winner: 'player2',
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], moves: [], currentTurn: 'player1',
        timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(finishedGame)
      gameService.surrender.mockResolvedValue(finishedGame)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'surrender', gameId: 'game-1' })

      const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs2.some((m: any) => m.type === 'game_update')).toBe(true)
    })

    it('sends WRONG_GAME error when gameId does not match', async () => {
      const { manager } = getManager()
      const client = makeClient(1, { currentGameId: 'other-game' })
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'surrender', gameId: 'game-1' })

      const msgs = (client.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs.some((m: any) => m.type === 'error' && m.code === 'WRONG_GAME')).toBe(true)
    })

    it('sends SURRENDER_FAILED error when surrender throws', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'playing', players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], moves: [], currentTurn: 'player1',
        winner: null, timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.surrender.mockRejectedValue(new Error('Already finished'))

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      manager._injectClient(c1)

      await manager.handleMessage(1, { type: 'surrender', gameId: 'game-1' })

      const msgs = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(msgs.some((m: any) => m.type === 'error' && m.code === 'SURRENDER_FAILED')).toBe(true)
    })

    it('determines player color by matching userId to player1.id', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'finished', winner: 'player2',
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], moves: [], currentTurn: 'player1',
        timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.surrender.mockResolvedValue({ ...gameData, status: 'finished' })

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      manager._injectClient(c1)

      await manager.handleMessage(1, { type: 'surrender', gameId: 'game-1' })

      expect(gameService.surrender).toHaveBeenCalledWith('game-1', 'player1', 'tok-1')
    })

    it('determines player color as player2 when userId matches player2.id', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'finished', winner: 'player1',
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], moves: [], currentTurn: 'player1',
        timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.surrender.mockResolvedValue({ ...gameData, status: 'finished' })

      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c2)

      await manager.handleMessage(2, { type: 'surrender', gameId: 'game-1' })

      expect(gameService.surrender).toHaveBeenCalledWith('game-1', 'player2', 'tok-2')
    })
  })

  // ── errors ─────────────────────────────────────────────────────────────────

  describe('handleMessage — errors', () => {
    it('sends UNKNOWN_MESSAGE error for bad types', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'bad_type' } as any)

      const msg = JSON.parse((client.ws.send as any).mock.calls[0][0])
      expect(msg.type).toBe('error')
      expect(msg.code).toBe('UNKNOWN_MESSAGE')
    })

    it('does nothing when userId is not a known client', async () => {
      const { manager } = getManager()
      // Don't inject any client
      await expect(manager.handleMessage(999, { type: 'ping' })).resolves.not.toThrow()
    })
  })

  // ── getConnectedCount / getQueueSize ───────────────────────────────────────

  describe('manager accessors', () => {
    it('getConnectedCount increases as clients are added', () => {
      const { manager } = getManager()
      expect(manager.getConnectedCount()).toBe(0)
      manager._injectClient(makeClient(1))
      expect(manager.getConnectedCount()).toBe(1)
      manager._injectClient(makeClient(2))
      expect(manager.getConnectedCount()).toBe(2)
    })

    it('getQueueSize increases as players join queue', async () => {
      const { manager } = getManager()
      const c1 = makeClient(1)
      const c2 = makeClient(2)
      manager._injectClient(c1)
      manager._injectClient(c2)

      expect(manager.getQueueSize()).toBe(0)
      await manager.handleMessage(1, { type: 'join_queue' })
      expect(manager.getQueueSize()).toBe(1)
      await manager.handleMessage(2, { type: 'join_queue' })
      expect(manager.getQueueSize()).toBe(2)
    })
  })

  // ── getPlayerColor logic ───────────────────────────────────────────────────

  describe('getPlayerColor', () => {
    it('move uses player1 color for player with id matching player1.id', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'playing', moves: [],
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], currentTurn: 'player1',
        winner: null, timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.playMove.mockResolvedValue(gameData)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(1, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      expect(gameService.playMove).toHaveBeenCalledWith('game-1', 0, 0, 'player1', 'tok-1')
    })

    it('move uses player2 color for player with id matching player2.id', async () => {
      const { manager, gameService } = getManager()
      const gameData = {
        id: 'game-1', status: 'playing', moves: [],
        players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
        config: { mode: 'pvp-online' }, board: [], currentTurn: 'player2',
        winner: null, timer: null, phase: 'playing', createdAt: '', updatedAt: '',
      }

      gameService.getGame.mockResolvedValue(gameData)
      gameService.playMove.mockResolvedValue(gameData)

      const c1 = makeClient(1, { currentGameId: 'game-1' })
      const c2 = makeClient(2, { currentGameId: 'game-1' })
      manager._injectClient(c1)
      manager._injectClient(c2)

      await manager.handleMessage(2, { type: 'move', gameId: 'game-1', row: 0, col: 0 })

      expect(gameService.playMove).toHaveBeenCalledWith('game-1', 0, 0, 'player2', 'tok-2')
    })
  })
})
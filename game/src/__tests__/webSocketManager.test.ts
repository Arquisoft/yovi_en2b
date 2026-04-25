import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ConnectedClient } from '../websocket/types'

// 1. Mocks de dependencias externas (deben ir antes de importar el Manager)
vi.mock('ws', () => {
  const WebSocketServer = vi.fn(function (this: any) {
    this.on = vi.fn()
    this.close = vi.fn()
  })

  // WebSocket must look like the real class so that
  // `ws.readyState === WebSocket.OPEN` passes inside WebSocketManager.
  // We expose OPEN/CLOSED as static-like properties on the constructor fn.
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

// --- Helpers para los tests ---

function createMockWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // must equal WebSocket.OPEN (1)
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

// --- Suite de Tests ---

describe('WebSocketManager', () => {
  beforeEach(() => {
    vi.mocked(jwt.verify).mockReturnValue({ id: 1, username: 'player1', role: 'player' } as any)
  })

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
  })

  describe('handleMessage — ping', () => {
    it('responds with pong', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await manager.handleMessage(1, { type: 'ping' })

      expect(client.ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'pong' }))
    })
  })

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
  })

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
  })

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
  })
})
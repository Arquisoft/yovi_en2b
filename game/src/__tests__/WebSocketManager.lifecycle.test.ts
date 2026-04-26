import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ConnectedClient } from '../websocket/types'

// ── Mocks ──────────────────────────────────────────────────────────────────────

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

function createMockWs(readyState = 1) {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState,
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

/**
 * Simulates how WebSocketManager.handleConnection works internally:
 * pulls the 'connection' handler registered on wss, then fires 'message'/'close' events.
 */
function getConnectionHandler(manager: WebSocketManager) {
  const wss = (manager as any).wss
  const [, handler] = wss.on.mock.calls.find(([event]: [string]) => event === 'connection') ?? []
  return handler as ((ws: any, req: any) => void) | undefined
}

// ── Suite ──────────────────────────────────────────────────────────────────────

describe('WebSocketManager – Connection lifecycle & Authentication', () => {
  beforeEach(() => {
    vi.mocked(jwt.verify).mockReturnValue({ id: 1, username: 'player1', role: 'player' } as any)
  })

  // ── handleConnection ───────────────────────────────────────────────────────

  describe('handleConnection', () => {
    it('registers message, close and error handlers on the socket', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)
      expect(handler).toBeDefined()

      const ws = createMockWs()
      handler!(ws, {} as any)

      const events = ws.on.mock.calls.map(([e]: [string]) => e)
      expect(events).toContain('message')
      expect(events).toContain('close')
      expect(events).toContain('error')
    })

    it('sends NOT_AUTHENTICATED error if non-auth message arrives before auth', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      // grab the 'message' listener
      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'ping' })))

      const sent = ws.send.mock.calls[0][0]
      const msg = JSON.parse(sent)
      expect(msg.type).toBe('error')
      expect(msg.code).toBe('NOT_AUTHENTICATED')
    })

    it('sends INVALID_MESSAGE error when raw data is not valid JSON', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from('not-json'))

      const sent = ws.send.mock.calls[0][0]
      const msg = JSON.parse(sent)
      expect(msg.type).toBe('error')
      expect(msg.code).toBe('INVALID_MESSAGE')
    })

    it('routes messages to handleMessage once authenticated', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')

      // authenticate first
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'valid-token' })))
      // then send ping
      await onMessage(Buffer.from(JSON.stringify({ type: 'ping' })))

      const messages = ws.send.mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(messages.some((m: any) => m.type === 'pong')).toBe(true)
    })
  })

  // ── handleAuth ─────────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('sends authenticated message with userId and username on success', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      const msg = JSON.parse(ws.send.mock.calls[0][0])
      expect(msg.type).toBe('authenticated')
      expect(msg.userId).toBe(1)
      expect(msg.username).toBe('player1')
    })

    it('registers the client in the manager after successful auth', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      expect(manager.getConnectedCount()).toBe(1)
      expect(manager.getClient(1)).toBeDefined()
    })

    it('sends AUTH_FAILED error when jwt.verify throws', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('bad token') })

      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'invalid' })))

      const msg = JSON.parse(ws.send.mock.calls[0][0])
      expect(msg.type).toBe('error')
      expect(msg.code).toBe('AUTH_FAILED')
    })

    it('does NOT register client when auth fails', async () => {
      vi.mocked(jwt.verify).mockImplementation(() => { throw new Error('bad') })

      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'invalid' })))

      expect(manager.getConnectedCount()).toBe(0)
    })

    it('restores an existing client during grace period on reconnect', async () => {
      const { manager } = getManager()

      // Pre-inject a "disconnected" client (has disconnectedAt set)
      const oldWs = createMockWs()
      const client: ConnectedClient = {
        ws: oldWs as any,
        userId: 1,
        username: 'player1',
        token: 'old-tok',
        inQueue: false,
        currentGameId: 'game-abc',
        disconnectedAt: Date.now() - 5_000,
      }
      manager._injectClient(client)

      const handler = getConnectionHandler(manager)!
      const newWs = createMockWs()
      handler(newWs, {} as any)

      const [[, onMessage]] = newWs.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'new-tok' })))

      // Should still be 1 client, not 2
      expect(manager.getConnectedCount()).toBe(1)

      const restored = manager.getClient(1)!
      expect(restored.disconnectedAt).toBeUndefined()
      expect(restored.token).toBe('new-tok')
    })

    it('notifies opponent of reconnection when client had an active game', async () => {
      const { manager } = getManager()

      // Inject opponent first
      const opponent = makeClient(2, { currentGameId: 'game-abc' })
      manager._injectClient(opponent)

      // Inject the "disconnected" client
      const client: ConnectedClient = {
        ws: createMockWs() as any,
        userId: 1,
        username: 'player1',
        token: 'old',
        inQueue: false,
        currentGameId: 'game-abc',
        disconnectedAt: Date.now() - 1_000,
      }
      manager._injectClient(client)

      const handler = getConnectionHandler(manager)!
      const newWs = createMockWs()
      handler(newWs, {} as any)

      const [[, onMessage]] = newWs.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'new-tok' })))

      const opponentMsgs = (opponent.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(opponentMsgs.some((m: any) => m.type === 'opponent_reconnected')).toBe(true)
    })
  })

  // ── Disconnect / reconnect ─────────────────────────────────────────────────

  describe('Disconnect / reconnect', () => {
    it('removes client from map on close if no active game', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))
      expect(manager.getConnectedCount()).toBe(1)

      const [[, onClose]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'close')
      onClose()

      expect(manager.getConnectedCount()).toBe(0)
    })

    it('leaves client in map (grace period) on close if in active game', async () => {
      const { manager } = getManager()

      // Inject client with an active game
      const client = makeClient(1, { currentGameId: 'game-abc' })
      manager._injectClient(client)

      const handler = getConnectionHandler(manager)!
      // simulate disconnect from a raw ws (we can call handleDisconnect directly via close event)
      // instead, access private method via casting
      ;(manager as any).handleDisconnect(1)

      // Client should still exist but have disconnectedAt set
      expect(manager.getConnectedCount()).toBe(1)
      expect(manager.getClient(1)?.disconnectedAt).toBeDefined()
    })

    it('notifies opponent with opponent_disconnected when player disconnects mid-game', () => {
      const { manager } = getManager()

      const opponent = makeClient(2, { currentGameId: 'game-abc' })
      manager._injectClient(opponent)
      manager._injectClient(makeClient(1, { currentGameId: 'game-abc' }))

      ;(manager as any).handleDisconnect(1)

      const msgs = (opponent.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const notice = msgs.find((m: any) => m.type === 'opponent_disconnected')
      expect(notice).toBeDefined()
      expect(notice.gracePeriodMs).toBe(30_000)
    })

    it('removes player from matchmaking queue on disconnect if queuing', () => {
      const { manager } = getManager()
      const client = makeClient(1, { inQueue: true })
      manager._injectClient(client)
      ;(manager as any).matchmaking.join({ userId: 1, username: 'player1', token: 'tok', joinedAt: Date.now() })

      expect(manager.getQueueSize()).toBe(1)
      ;(manager as any).handleDisconnect(1)
      expect(manager.getQueueSize()).toBe(0)
    })

    it('sets inQueue to false when disconnecting a queued player', () => {
      const { manager } = getManager()
      const client = makeClient(1, { inQueue: true })
      manager._injectClient(client)
      ;(manager as any).matchmaking.join({ userId: 1, username: 'player1', token: 'tok', joinedAt: Date.now() })

      ;(manager as any).handleDisconnect(1)
      // client still in map only if it had a game; here it doesn't → deleted
      expect(manager.getClient(1)).toBeUndefined()
    })

    it('does nothing on disconnect for unknown userId', () => {
      const { manager } = getManager()
      // should not throw
      expect(() => (manager as any).handleDisconnect(999)).not.toThrow()
    })

    it('socket error event triggers disconnect the same way close does', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))
      expect(manager.getConnectedCount()).toBe(1)

      const [[, onError]] = ws.on.mock.calls.filter(([e]: [string]) => e === 'error')
      onError()

      // client had no active game → should be removed
      expect(manager.getConnectedCount()).toBe(0)
    })

    it('clears disconnectedAt and updates ws on reconnect during grace period', async () => {
      const { manager } = getManager()

      const client: ConnectedClient = {
        ws: createMockWs() as any,
        userId: 1,
        username: 'player1',
        token: 'old',
        inQueue: false,
        currentGameId: undefined,
        disconnectedAt: Date.now() - 5_000,
      }
      manager._injectClient(client)

      const handler = getConnectionHandler(manager)!
      const freshWs = createMockWs()
      handler(freshWs, {} as any)

      const [[, onMessage]] = freshWs.on.mock.calls.filter(([e]: [string]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'new-tok' })))

      const restored = manager.getClient(1)!
      expect(restored.ws).toBe(freshWs)
      expect(restored.disconnectedAt).toBeUndefined()
    })
  })
})

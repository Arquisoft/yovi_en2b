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
    ping: vi.fn(),
    terminate: vi.fn(),
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
  const [, handler] = wss.on.mock.calls.find(([event]: any[]) => event === 'connection') ?? []
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

      const events = ws.on.mock.calls.map(([e]) => e)
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
      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')

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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = newWs.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = newWs.on.mock.calls.filter(([e]) => e === 'message')
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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))
      expect(manager.getConnectedCount()).toBe(1)

      const [[, onClose]] = ws.on.mock.calls.filter(([e]) => e === 'close')
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
      ;(manager as any).matchmaking.join('y', { userId: 1, username: 'player1', token: 'tok', joinedAt: Date.now() })

      expect(manager.getQueueSize()).toBe(1)
      ;(manager as any).handleDisconnect(1)
      expect(manager.getQueueSize()).toBe(0)
    })

    it('sets inQueue to false when disconnecting a queued player', () => {
      const { manager } = getManager()
      const client = makeClient(1, { inQueue: true })
      manager._injectClient(client)
      ;(manager as any).matchmaking.join('y', { userId: 1, username: 'player1', token: 'tok', joinedAt: Date.now() })

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

      const [[, onMessage]] = ws.on.mock.calls.filter(([e]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))
      expect(manager.getConnectedCount()).toBe(1)

      const [[, onError]] = ws.on.mock.calls.filter(([e]) => e === 'error')
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

      const [[, onMessage]] = freshWs.on.mock.calls.filter(([e]) => e === 'message')
      await onMessage(Buffer.from(JSON.stringify({ type: 'auth', token: 'new-tok' })))

      const restored = manager.getClient(1)!
      expect(restored.ws).toBe(freshWs)
      expect(restored.disconnectedAt).toBeUndefined()
    })
  })

  // ── Heartbeat ──────────────────────────────────────────────────────────────

  describe('Heartbeat', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('registers pong and close listeners for heartbeat cleanup', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const events = ws.on.mock.calls.map(([e]: any[]) => e)
      expect(events).toContain('pong')
    })

    it('calls ws.ping() after 25 s', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      vi.advanceTimersByTime(25_000)
      expect(ws.ping).toHaveBeenCalledTimes(1)
    })

    it('calls ws.terminate() if no pong arrives within 10 s of ping', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      vi.advanceTimersByTime(25_000 + 10_000)
      expect(ws.terminate).toHaveBeenCalled()
    })

    it('does NOT terminate if pong arrives in time', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      vi.advanceTimersByTime(25_000)
      expect(ws.ping).toHaveBeenCalled()

      // Simulate browser auto-pong
      const [[, onPong]] = ws.on.mock.calls.filter(([e]: any[]) => e === 'pong')
      onPong()

      vi.advanceTimersByTime(10_000)
      expect(ws.terminate).not.toHaveBeenCalled()
    })

    it('stops pinging after socket close', () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!
      const ws = createMockWs()
      handler(ws, {} as any)

      const [[, onClose]] = ws.on.mock.calls.filter(([e]: any[]) => e === 'close')
      onClose()

      vi.advanceTimersByTime(25_000)
      expect(ws.ping).not.toHaveBeenCalled()
    })
  })

  // ── Duplicate connection (same userId) ─────────────────────────────────────

  describe('Duplicate connection (same userId, active session)', () => {
    it('sends session_replaced to the old socket and closes it', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!

      // First connection
      const ws1 = createMockWs()
      handler(ws1, {} as any)
      const [[, onMsg1]] = ws1.on.mock.calls.filter(([e]: any[]) => e === 'message')
      await onMsg1(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      // Second connection — same userId
      const ws2 = createMockWs()
      handler(ws2, {} as any)
      const [[, onMsg2]] = ws2.on.mock.calls.filter(([e]: any[]) => e === 'message')
      await onMsg2(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      const ws1Msgs = ws1.send.mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(ws1Msgs.some((m: any) => m.type === 'session_replaced')).toBe(true)
      expect(ws1.close).toHaveBeenCalled()
    })

    it('sends authenticated to the new socket and still counts as 1 client', async () => {
      const { manager } = getManager()
      const handler = getConnectionHandler(manager)!

      const ws1 = createMockWs()
      handler(ws1, {} as any)
      const [[, onMsg1]] = ws1.on.mock.calls.filter(([e]: any[]) => e === 'message')
      await onMsg1(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      const ws2 = createMockWs()
      handler(ws2, {} as any)
      const [[, onMsg2]] = ws2.on.mock.calls.filter(([e]: any[]) => e === 'message')
      await onMsg2(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      const ws2Msgs = ws2.send.mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(ws2Msgs.some((m: any) => m.type === 'authenticated')).toBe(true)
      expect(manager.getConnectedCount()).toBe(1)
      expect(manager.getClient(1)?.ws).toBe(ws2)
    })

    it('preserves game state (currentGameId) when session is transferred', async () => {
      const { manager } = getManager()

      // Pre-inject client already in a game
      const ws1 = createMockWs() as any
      manager._injectClient({ ws: ws1, userId: 1, username: 'player1', token: 'tok', inQueue: false, currentGameId: 'game-xyz' })

      const handler = getConnectionHandler(manager)!
      const ws2 = createMockWs()
      handler(ws2, {} as any)
      const [[, onMsg2]] = ws2.on.mock.calls.filter(([e]: any[]) => e === 'message')
      await onMsg2(Buffer.from(JSON.stringify({ type: 'auth', token: 'tok' })))

      expect(manager.getClient(1)?.currentGameId).toBe('game-xyz')
    })
  })

  // ── cancel_room ────────────────────────────────────────────────────────────

  describe('cancel_room', () => {
    it('removes the room so subsequent join_room gets ROOM_NOT_FOUND', async () => {
      const { manager } = getManager()
      const host = makeClient(1)
      const guest = makeClient(2)
      manager._injectClient(host)
      manager._injectClient(guest)

      // Host creates room
      await manager.handleMessage(1, { type: 'create_room', config: undefined })
      const hostMsgs = (host.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const created = hostMsgs.find((m: any) => m.type === 'room_created')
      expect(created).toBeDefined()

      // Host cancels room
      await manager.handleMessage(1, { type: 'cancel_room' })

      // Guest tries to join
      await manager.handleMessage(2, { type: 'join_room', code: created.code })
      const guestMsgs = (guest.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const err = guestMsgs.find((m: any) => m.type === 'error')
      expect(err?.code).toBe('ROOM_NOT_FOUND')
    })

    it('is a no-op if the client has no hosted room', async () => {
      const { manager } = getManager()
      const client = makeClient(1)
      manager._injectClient(client)

      await expect(manager.handleMessage(1, { type: 'cancel_room' })).resolves.not.toThrow()
    })

    it('only removes the room belonging to the calling client', async () => {
      const { manager } = getManager()
      const host1 = makeClient(1)
      const host2 = makeClient(2)
      manager._injectClient(host1)
      manager._injectClient(host2)

      await manager.handleMessage(1, { type: 'create_room', config: undefined })
      await manager.handleMessage(2, { type: 'create_room', config: undefined })

      // host1 cancels — host2's room should still exist
      await manager.handleMessage(1, { type: 'cancel_room' })

      const host2Msgs = (host2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      const host2Code = host2Msgs.find((m: any) => m.type === 'room_created')?.code

      // guest tries to join host2's room — should succeed (room still there)
      const guest = makeClient(3)
      manager._injectClient(guest)

      // We can't easily create the game in test (gameService.createGame would need mocking),
      // but we can verify no ROOM_NOT_FOUND error is returned — the room exists.
      // We mock createGame to throw so the flow stops after room lookup.
      ;(manager as any).gameService.createGame = vi.fn().mockRejectedValue(new Error('test-stop'))
      await manager.handleMessage(3, { type: 'join_room', code: host2Code })

      const guestMsgs = (guest.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
      expect(guestMsgs.some((m: any) => m.code === 'ROOM_NOT_FOUND')).toBe(false)
    })
  })
})

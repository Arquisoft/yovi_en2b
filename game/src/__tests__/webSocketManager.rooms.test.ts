import { describe, it, expect, vi } from 'vitest'
import type { ConnectedClient } from '../websocket/types'

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

// ── Helpers ────────────────────────────────────────────────────────────────────

const ROOM_CHARS = new Set('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))

function createMockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1, on: vi.fn() }
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
    decidePie: vi.fn(),
  } as any
  const manager = new WebSocketManager(mockServer, gameService)
  return { manager, gameService }
}

function mockGame(hostId: number, joinerId: number) {
  return {
    id: 'game-room-1', status: 'playing', config: { mode: 'pvp-online' },
    players: {
      player1: { id: String(hostId),   name: `player${hostId}` },
      player2: { id: String(joinerId), name: `player${joinerId}` },
    },
    board: [], moves: [], currentTurn: 'player1', winner: null,
    timer: null, phase: 'playing', createdAt: '', updatedAt: '',
  }
}

/** Creates a room as user hostId and returns the code + both client refs. */
async function openRoom(
  manager: WebSocketManager,
  gameService: any,
  hostId = 1,
  joinerId = 2,
  config?: any,
) {
  const host   = makeClient(hostId)
  const joiner = makeClient(joinerId)
  manager._injectClient(host)
  manager._injectClient(joiner)
  gameService.createGame.mockResolvedValue(mockGame(hostId, joinerId))
  gameService.setPlayer2Id.mockResolvedValue(undefined)

  await manager.handleMessage(hostId, { type: 'create_room', config })
  const lastSent = (host.ws.send as any).mock.calls.at(-1)[0]
  const code: string = JSON.parse(lastSent).code
  return { host, joiner, code }
}

// ── create_room ────────────────────────────────────────────────────────────────

describe('WebSocketManager – create_room', () => {
  it('sends room_created with a 6-character code', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    await manager.handleMessage(1, { type: 'create_room' })

    const msgs = (manager.getClient(1)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const msg  = msgs.find((m: any) => m.type === 'room_created')
    expect(msg).toBeDefined()
    expect(msg.code).toHaveLength(6)
  })

  it('room code only contains chars from the unambiguous charset', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    await manager.handleMessage(1, { type: 'create_room' })

    const msgs = (manager.getClient(1)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const code: string = msgs.find((m: any) => m.type === 'room_created').code
    expect([...code].every(ch => ROOM_CHARS.has(ch))).toBe(true)
  })

  it('sends IN_GAME error when client already has an active game', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1, { currentGameId: 'game-abc' }))

    await manager.handleMessage(1, { type: 'create_room' })

    const msgs = (manager.getClient(1)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'IN_GAME')).toBe(true)
  })

  it('stores the room keyed by the code', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    await manager.handleMessage(1, { type: 'create_room' })

    expect((manager as any).rooms.size).toBe(1)
  })

  it('stores the host config in the room entry', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    const config = { boardSize: 13 as any, timerEnabled: false, playerColor: 'player2' as const }
    await manager.handleMessage(1, { type: 'create_room', config })

    const room = [...(manager as any).rooms.values()][0]
    expect(room.config).toEqual(config)
  })

  it('replaces the old room when the same host creates a second room', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    await manager.handleMessage(1, { type: 'create_room' })
    await manager.handleMessage(1, { type: 'create_room' })

    expect((manager as any).rooms.size).toBe(1)
    const room = [...(manager as any).rooms.values()][0]
    expect(room.hostId).toBe(1)
  })

  it('two different hosts can have rooms simultaneously', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))
    manager._injectClient(makeClient(2))

    await manager.handleMessage(1, { type: 'create_room' })
    await manager.handleMessage(2, { type: 'create_room' })

    expect((manager as any).rooms.size).toBe(2)
  })
})

// ── join_room ──────────────────────────────────────────────────────────────────

describe('WebSocketManager – join_room', () => {
  it('sends matched to both host and joiner', async () => {
    const { manager, gameService } = getManager()
    const { host, joiner, code } = await openRoom(manager, gameService)

    await manager.handleMessage(2, { type: 'join_room', code })

    const hostMsgs   = (host.ws.send   as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const joinerMsgs = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(hostMsgs.some((m: any)   => m.type === 'matched')).toBe(true)
    expect(joinerMsgs.some((m: any) => m.type === 'matched')).toBe(true)
  })

  it('host gets player1 and joiner gets player2 by default', async () => {
    const { manager, gameService } = getManager()
    const { host, joiner, code } = await openRoom(manager, gameService)

    await manager.handleMessage(2, { type: 'join_room', code })

    const hostMatched   = (host.ws.send   as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    const joinerMatched = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    expect(hostMatched?.playerColor).toBe('player1')
    expect(joinerMatched?.playerColor).toBe('player2')
  })

  it('swaps colors when host config has playerColor: player2', async () => {
    const { manager, gameService } = getManager()
    const { host, joiner, code } = await openRoom(
      manager, gameService, 1, 2,
      { boardSize: 11, timerEnabled: true, playerColor: 'player2' },
    )

    await manager.handleMessage(2, { type: 'join_room', code })

    const hostMatched   = (host.ws.send   as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    const joinerMatched = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    expect(hostMatched?.playerColor).toBe('player2')
    expect(joinerMatched?.playerColor).toBe('player1')
  })

  it('includes the correct opponent names in matched messages', async () => {
    const { manager, gameService } = getManager()
    const { host, joiner, code } = await openRoom(manager, gameService)

    await manager.handleMessage(2, { type: 'join_room', code })

    const hostMatched   = (host.ws.send   as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    const joinerMatched = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0])).find((m: any) => m.type === 'matched')
    expect(hostMatched?.opponentName).toBe('player2')
    expect(joinerMatched?.opponentName).toBe('player1')
  })

  it('sets currentGameId on both clients after successful join', async () => {
    const { manager, gameService } = getManager()
    const { code } = await openRoom(manager, gameService)

    await manager.handleMessage(2, { type: 'join_room', code })

    expect(manager.getClient(1)?.currentGameId).toBe('game-room-1')
    expect(manager.getClient(2)?.currentGameId).toBe('game-room-1')
  })

  it('removes the room from the map after a successful join', async () => {
    const { manager, gameService } = getManager()
    const { code } = await openRoom(manager, gameService)

    expect((manager as any).rooms.size).toBe(1)
    await manager.handleMessage(2, { type: 'join_room', code })
    expect((manager as any).rooms.size).toBe(0)
  })

  it('sends ROOM_NOT_FOUND for an unknown code', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(2))

    await manager.handleMessage(2, { type: 'join_room', code: 'XXXXXX' })

    const msgs = (manager.getClient(2)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'ROOM_NOT_FOUND')).toBe(true)
  })

  it('sends CANNOT_JOIN_OWN_ROOM when the host tries to join their own room', async () => {
    const { manager, gameService } = getManager()
    const { host, code } = await openRoom(manager, gameService)

    await manager.handleMessage(1, { type: 'join_room', code })

    const msgs = (host.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'CANNOT_JOIN_OWN_ROOM')).toBe(true)
  })

  it('sends ROOM_NOT_FOUND and deletes the room when the host has disconnected', async () => {
    const { manager, gameService } = getManager()
    const { joiner, code } = await openRoom(manager, gameService)
    ;(manager as any).clients.delete(1)

    await manager.handleMessage(2, { type: 'join_room', code })

    const msgs = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'ROOM_NOT_FOUND')).toBe(true)
    expect((manager as any).rooms.size).toBe(0)
  })

  it('sends IN_GAME error when the joiner already has an active game', async () => {
    const { manager, gameService } = getManager()
    const host   = makeClient(1)
    const joiner = makeClient(2, { currentGameId: 'existing-game' })
    manager._injectClient(host)
    manager._injectClient(joiner)
    gameService.createGame.mockResolvedValue(mockGame(1, 2))
    gameService.setPlayer2Id.mockResolvedValue(undefined)

    await manager.handleMessage(1, { type: 'create_room' })
    const code = JSON.parse((host.ws.send as any).mock.calls.at(-1)[0]).code

    await manager.handleMessage(2, { type: 'join_room', code })

    const msgs = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'IN_GAME')).toBe(true)
  })

  it('sends ROOM_FAILED to both players when game creation throws', async () => {
    const { manager, gameService } = getManager()
    const host   = makeClient(1)
    const joiner = makeClient(2)
    manager._injectClient(host)
    manager._injectClient(joiner)
    gameService.createGame.mockRejectedValue(new Error('DB down'))

    await manager.handleMessage(1, { type: 'create_room' })
    const code = JSON.parse((host.ws.send as any).mock.calls.at(-1)[0]).code
    await manager.handleMessage(2, { type: 'join_room', code })

    const hostMsgs   = (host.ws.send   as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const joinerMsgs = (joiner.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(hostMsgs.some((m: any)   => m.type === 'error' && m.code === 'ROOM_FAILED')).toBe(true)
    expect(joinerMsgs.some((m: any) => m.type === 'error' && m.code === 'ROOM_FAILED')).toBe(true)
  })
})

// ── host disconnect cleans up room ─────────────────────────────────────────────

describe('WebSocketManager – host disconnect cleans up room', () => {
  it('removes the room when the host disconnects', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))

    await manager.handleMessage(1, { type: 'create_room' })
    expect((manager as any).rooms.size).toBe(1)

    ;(manager as any).handleDisconnect(1)
    expect((manager as any).rooms.size).toBe(0)
  })

  it('does not remove another host room on disconnect', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1))
    manager._injectClient(makeClient(2))

    await manager.handleMessage(1, { type: 'create_room' })
    await manager.handleMessage(2, { type: 'create_room' })
    expect((manager as any).rooms.size).toBe(2)

    ;(manager as any).handleDisconnect(1)
    expect((manager as any).rooms.size).toBe(1)
    const [remaining] = [...(manager as any).rooms.values()]
    expect(remaining.hostId).toBe(2)
  })
})

// ── pie_decision ───────────────────────────────────────────────────────────────

describe('WebSocketManager – pie_decision', () => {
  const pieGame = {
    id: 'game-1', status: 'playing', moves: [],
    players: { player1: { id: '1', name: 'p1' }, player2: { id: '2', name: 'p2' } },
    config: { mode: 'pvp-online' }, board: [], currentTurn: 'player2',
    winner: null, timer: null, phase: 'pie', createdAt: '', updatedAt: '',
  }

  it('sends game_update to both players on keep', async () => {
    const { manager, gameService } = getManager()
    gameService.decidePie.mockResolvedValue(pieGame)

    const c1 = makeClient(1, { currentGameId: 'game-1' })
    const c2 = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(c1)
    manager._injectClient(c2)

    await manager.handleMessage(1, { type: 'pie_decision', gameId: 'game-1', decision: 'keep' })

    const msgs1 = (c1.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs1.some((m: any) => m.type === 'game_update')).toBe(true)
    expect(msgs2.some((m: any) => m.type === 'game_update')).toBe(true)
  })

  it('sends game_update to both players on swap', async () => {
    const { manager, gameService } = getManager()
    gameService.decidePie.mockResolvedValue(pieGame)

    const c1 = makeClient(1, { currentGameId: 'game-1' })
    const c2 = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(c1)
    manager._injectClient(c2)

    await manager.handleMessage(1, { type: 'pie_decision', gameId: 'game-1', decision: 'swap' })

    expect(gameService.decidePie).toHaveBeenCalledWith('game-1', 'swap', 'tok-1')
    const msgs2 = (c2.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs2.some((m: any) => m.type === 'game_update')).toBe(true)
  })

  it('sends WRONG_GAME error when gameId does not match currentGameId', async () => {
    const { manager } = getManager()
    manager._injectClient(makeClient(1, { currentGameId: 'other-game' }))

    await manager.handleMessage(1, { type: 'pie_decision', gameId: 'game-1', decision: 'keep' })

    const msgs = (manager.getClient(1)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'WRONG_GAME')).toBe(true)
  })

  it('sends PIE_FAILED error when decidePie throws', async () => {
    const { manager, gameService } = getManager()
    gameService.decidePie.mockRejectedValue(new Error('Pie already decided'))

    manager._injectClient(makeClient(1, { currentGameId: 'game-1' }))

    await manager.handleMessage(1, { type: 'pie_decision', gameId: 'game-1', decision: 'keep' })

    const msgs = (manager.getClient(1)!.ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(msgs.some((m: any) => m.type === 'error' && m.code === 'PIE_FAILED')).toBe(true)
  })

  it('calls decidePie with the correct token', async () => {
    const { manager, gameService } = getManager()
    gameService.decidePie.mockResolvedValue(pieGame)

    manager._injectClient(makeClient(1, { currentGameId: 'game-1' }))
    manager._injectClient(makeClient(2, { currentGameId: 'game-1' }))

    await manager.handleMessage(1, { type: 'pie_decision', gameId: 'game-1', decision: 'keep' })

    expect(gameService.decidePie).toHaveBeenCalledWith('game-1', 'keep', 'tok-1')
  })
})

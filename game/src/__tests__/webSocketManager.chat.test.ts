import { describe, it, expect, vi, beforeEach } from 'vitest'
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

function createMockWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
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

function parseSent(ws: ReturnType<typeof createMockWs>, callIndex = 0) {
  return JSON.parse(ws.send.mock.calls[callIndex][0])
}

describe('WebSocketManager — chat_message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delivers the message to the opponent in the same game', async () => {
    const { manager } = getManager()
    const sender   = makeClient(1, { currentGameId: 'game-1' })
    const opponent = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(sender)
    manager._injectClient(opponent)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hello!' })

    expect(opponent.ws.send).toHaveBeenCalledTimes(1)
    const msg = parseSent(opponent.ws)
    expect(msg.type).toBe('chat_message')
    expect(msg.content).toBe('Hello!')
    expect(msg.senderId).toBe('1')
    expect(msg.senderName).toBe('player1')
    expect(msg.gameId).toBe('game-1')
    expect(typeof msg.timestamp).toBe('string')
  })

  it('does NOT echo the message back to the sender', async () => {
    const { manager } = getManager()
    const sender   = makeClient(1, { currentGameId: 'game-1' })
    const opponent = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(sender)
    manager._injectClient(opponent)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hello!' })

    expect(sender.ws.send).not.toHaveBeenCalled()
  })

  it('trims whitespace from content before delivering', async () => {
    const { manager } = getManager()
    const sender   = makeClient(1, { currentGameId: 'game-1' })
    const opponent = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(sender)
    manager._injectClient(opponent)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: '  hi there  ' })

    const msg = parseSent(opponent.ws)
    expect(msg.content).toBe('hi there')
  })

  it('sends WRONG_GAME error when the player is not in that game', async () => {
    const { manager } = getManager()
    const sender = makeClient(1, { currentGameId: 'game-other' })
    manager._injectClient(sender)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hello!' })

    expect(sender.ws.send).toHaveBeenCalledTimes(1)
    const msg = parseSent(sender.ws)
    expect(msg.type).toBe('error')
    expect(msg.code).toBe('WRONG_GAME')
  })

  it('sends WRONG_GAME error when the player has no active game', async () => {
    const { manager } = getManager()
    const sender = makeClient(1)
    manager._injectClient(sender)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hello!' })

    const msg = parseSent(sender.ws)
    expect(msg.type).toBe('error')
    expect(msg.code).toBe('WRONG_GAME')
  })

  it('silently ignores empty content (after trim)', async () => {
    const { manager } = getManager()
    const sender   = makeClient(1, { currentGameId: 'game-1' })
    const opponent = makeClient(2, { currentGameId: 'game-1' })
    manager._injectClient(sender)
    manager._injectClient(opponent)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: '   ' })

    expect(sender.ws.send).not.toHaveBeenCalled()
    expect(opponent.ws.send).not.toHaveBeenCalled()
  })

  it('does nothing when the opponent is not connected', async () => {
    const { manager } = getManager()
    const sender = makeClient(1, { currentGameId: 'game-1' })
    manager._injectClient(sender)

    // No exception thrown, no send to sender either
    await expect(
      manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hello?' })
    ).resolves.toBeUndefined()

    expect(sender.ws.send).not.toHaveBeenCalled()
  })

  it('does not deliver to a third client in a different game', async () => {
    const { manager } = getManager()
    const sender    = makeClient(1, { currentGameId: 'game-1' })
    const opponent  = makeClient(2, { currentGameId: 'game-1' })
    const spectator = makeClient(3, { currentGameId: 'game-2' })
    manager._injectClient(sender)
    manager._injectClient(opponent)
    manager._injectClient(spectator)

    await manager.handleMessage(1, { type: 'chat_message', gameId: 'game-1', content: 'Hi!' })

    expect(spectator.ws.send).not.toHaveBeenCalled()
    expect(opponent.ws.send).toHaveBeenCalledTimes(1)
  })
})

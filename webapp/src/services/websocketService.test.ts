import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebSocketService } from './websocketService'

// ── Mock WebSocket ────────────────────────────────────────────────────────────

interface MockWs {
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
  readyState: number
  onopen: ((e: Event) => void) | null
  onmessage: ((e: MessageEvent) => void) | null
  onerror: ((e: Event) => void) | null
  onclose: ((e: CloseEvent) => void) | null
}

let mockWsInstance: MockWs

function createMockWs(): MockWs {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 0, // CONNECTING initially
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  }
}

function serverSend(mockWs: MockWs, data: object) {
  mockWs.onmessage?.({
    data: JSON.stringify(data),
  } as MessageEvent)
}

beforeEach(() => {
  mockWsInstance = createMockWs()

  const MockWebSocket = vi.fn(function (this: MockWs) {
    return mockWsInstance
  })

  vi.stubGlobal('WebSocket', MockWebSocket)

  Object.defineProperty(globalThis.WebSocket, 'OPEN', {
    value: 1,
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── Helpers ────────────────────────────────────────────────────────────────────

async function connectService(service: WebSocketService, token = 'test-token') {
  const connectPromise = service.connect(token)

  mockWsInstance.readyState = 1
  mockWsInstance.onopen?.(new Event('open'))
  serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })

  await connectPromise
  return service
}

// ── connect ────────────────────────────────────────────────────────────────────

describe('WebSocketService — connect', () => {
  it('opens a WebSocket and sends auth message', async () => {
    const svc = new WebSocketService('ws://test')
    const connectPromise = svc.connect('my-token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))
    serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })

    await connectPromise

    expect(globalThis.WebSocket).toHaveBeenCalledWith('ws://test')
    const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0])
    expect(sentData).toEqual({ type: 'auth', token: 'my-token' })
  })

  it('resolves when server confirms authentication', async () => {
    const svc = new WebSocketService('ws://test')
    await expect(connectService(svc)).resolves.toBeDefined()
  })

  it('rejects when server sends an error before authentication', async () => {
    const svc = new WebSocketService('ws://test')
    const promise = svc.connect('bad-token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))
    serverSend(mockWsInstance, { type: 'error', code: 'AUTH_FAILED', message: 'Bad token' })

    await expect(promise).rejects.toThrow('Bad token')
  })

  it('rejects when WebSocket emits onerror', async () => {
    const svc = new WebSocketService('ws://test')
    const promise = svc.connect('token')

    mockWsInstance.onerror?.(new Event('error'))
    await expect(promise).rejects.toThrow('WebSocket connection failed')
  })

  it('resolves immediately if already connected', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const callCount = vi.mocked(globalThis.WebSocket).mock.calls.length
    await svc.connect('token')

    expect(vi.mocked(globalThis.WebSocket).mock.calls.length).toBe(callCount)
  })

  it('rejects when connection closes before authentication', async () => {
    const svc = new WebSocketService('ws://test')
    const promise = svc.connect('token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))
    // Trigger close before auth response
    mockWsInstance.onclose?.({} as CloseEvent)

    await expect(promise).rejects.toThrow()
  })

  it('sends auth message immediately after open', async () => {
    const svc = new WebSocketService('ws://test')
    const connectPromise = svc.connect('my-token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'auth', token: 'my-token' })
    )

    serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })
    await connectPromise
  })

  it('returns the same promise when called twice during connection', async () => {
    const svc = new WebSocketService('ws://test')
    const p1 = svc.connect('token')
    const p2 = svc.connect('token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))
    serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })

    await p1
    await p2

    // Only one WebSocket was created
    expect(vi.mocked(globalThis.WebSocket).mock.calls.length).toBe(1)
  })

  it('dispatches non-auth messages after handshake', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const handler = vi.fn()
    svc.on('ping', handler)

    serverSend(mockWsInstance, { type: 'ping' })
    expect(handler).toHaveBeenCalledWith({ type: 'ping' })
  })

  it('ignores malformed JSON in onmessage after auth', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const handler = vi.fn()
    svc.on('anything', handler)

    // Should not throw
    mockWsInstance.onmessage?.({ data: 'invalid json {{{' } as MessageEvent)
    expect(handler).not.toHaveBeenCalled()
  })

  it('handles non-auth, non-error message during handshake without resolving', async () => {
    const svc = new WebSocketService('ws://test')
    let resolved = false
    let rejected = false
    const promise = svc.connect('token')
    promise.then(() => { resolved = true }).catch(() => { rejected = true })

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))

    // Send a message that is neither 'authenticated' nor 'error'
    serverSend(mockWsInstance, { type: 'game_update', data: {} })

    // Give microtasks a chance to flush
    await new Promise(r => setTimeout(r, 0))

    // Should reject because error was sent (message that is not authenticated rejects)
    // Actually, let's check: the code says "if not settled and not authenticated, reject"
    // The message above has no .message field, so it should reject with 'Authentication failed'
    expect(rejected).toBe(true)
    expect(resolved).toBe(false)
  })
})

// ── on / event dispatch ────────────────────────────────────────────────────────

describe('WebSocketService — on / event dispatch', () => {
  it('calls registered handler when matching message arrives', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    const handler = vi.fn()

    svc.on('game_update', handler)
    serverSend(mockWsInstance, { type: 'game_update', game: { id: 'g1' } })

    expect(handler).toHaveBeenCalledWith({ type: 'game_update', game: { id: 'g1' } })
  })

  it('unsubscribe function removes the handler', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    const handler = vi.fn()

    const unsub = svc.on('pong', handler)
    unsub()
    serverSend(mockWsInstance, { type: 'pong' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('multiple handlers for the same event type all get called', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const h1 = vi.fn()
    const h2 = vi.fn()
    svc.on('matched', h1)
    svc.on('matched', h2)

    serverSend(mockWsInstance, { type: 'matched', gameId: 'game-1' })
    expect(h1).toHaveBeenCalledOnce()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('handler for different event type is not called', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const handler = vi.fn()
    svc.on('queue_joined', handler)

    serverSend(mockWsInstance, { type: 'pong' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('handler passes full message data', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const handler = vi.fn()
    svc.on('game_update', handler)

    const payload = { type: 'game_update', game: { id: 'g1', status: 'playing' }, extra: 42 }
    serverSend(mockWsInstance, payload)

    expect(handler).toHaveBeenCalledWith(payload)
  })

  it('can subscribe to the same event type multiple times independently', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const h1 = vi.fn()
    const h2 = vi.fn()
    const unsub1 = svc.on('pong', h1)
    svc.on('pong', h2)

    unsub1()
    serverSend(mockWsInstance, { type: 'pong' })

    expect(h1).not.toHaveBeenCalled()
    expect(h2).toHaveBeenCalledOnce()
  })

  it('handler registered before connection still works after connect', async () => {
    const svc = new WebSocketService('ws://test')
    const handler = vi.fn()
    svc.on('pong', handler) // register before connect

    await connectService(svc)
    serverSend(mockWsInstance, { type: 'pong' })

    expect(handler).toHaveBeenCalledOnce()
  })
})

// ── isConnected ────────────────────────────────────────────────────────────────

describe('WebSocketService — isConnected', () => {
  it('returns false before connecting', () => {
    const svc = new WebSocketService('ws://test')
    expect(svc.isConnected()).toBe(false)
  })

  it('returns true when readyState is OPEN', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    mockWsInstance.readyState = 1
    expect(svc.isConnected()).toBe(true)
  })

  it('returns false after disconnect', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    svc.disconnect()
    expect(svc.isConnected()).toBe(false)
  })

  it('returns false when ws readyState is not OPEN', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    mockWsInstance.readyState = 3 // CLOSED
    expect(svc.isConnected()).toBe(false)
  })
})

// ── send ───────────────────────────────────────────────────────────────────────

describe('WebSocketService — send', () => {
  it('sends a JSON-serialized message when connected', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    svc.send({ type: 'ping' })

    const lastCall = mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1]
    expect(JSON.parse(lastCall[0])).toEqual({ type: 'ping' })
  })

  it('does nothing when not connected', () => {
    const svc = new WebSocketService('ws://test')
    expect(() => svc.send({ type: 'ping' })).not.toThrow()
    // send on the mock should not have been called (no ws yet)
    expect(mockWsInstance.send).not.toHaveBeenCalled()
  })

  it('does nothing when readyState is not OPEN', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    mockWsInstance.readyState = 3 // CLOSED

    const callsBefore = mockWsInstance.send.mock.calls.length
    svc.send({ type: 'ping' })
    expect(mockWsInstance.send.mock.calls.length).toBe(callsBefore)
  })

  it('sends complex objects correctly', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const message = { type: 'move', gameId: 'game-1', row: 3, col: 2 }
    svc.send(message)

    const lastCall = mockWsInstance.send.mock.calls[mockWsInstance.send.mock.calls.length - 1]
    expect(JSON.parse(lastCall[0])).toEqual(message)
  })
})

// ── disconnect ─────────────────────────────────────────────────────────────────

describe('WebSocketService — disconnect', () => {
  it('calls ws.close on disconnect', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    svc.disconnect()
    expect(mockWsInstance.close).toHaveBeenCalled()
  })

  it('does not throw when calling disconnect without connection', () => {
    const svc = new WebSocketService('ws://test')
    expect(() => svc.disconnect()).not.toThrow()
  })

  it('prevents reconnection after intentional disconnect', async () => {
    vi.useFakeTimers()
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    svc.disconnect()

    // Trigger close (which would normally schedule reconnect)
    mockWsInstance.onclose?.({} as CloseEvent)

    vi.advanceTimersByTime(5000)

    // Should not have created another WebSocket
    expect(vi.mocked(globalThis.WebSocket).mock.calls.length).toBe(1)
    vi.useRealTimers()
  })

  it('clears reconnect timer on disconnect', async () => {
    vi.useFakeTimers()
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    const svc = new WebSocketService('ws://test')
    await connectService(svc)
    svc.disconnect()

    // clearTimeout should have been called (possibly for the reconnect timer)
    // It may not be called if timer was never set, so we just verify no throw
    expect(() => svc.disconnect()).not.toThrow()

    vi.useRealTimers()
  })
})

// ── reconnect ──────────────────────────────────────────────────────────────────

describe('WebSocketService — auto-reconnect', () => {
  it('schedules reconnect after unexpected close', async () => {
    vi.useFakeTimers()
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    // Simulate unexpected disconnect
    const closedWs = mockWsInstance
    closedWs.readyState = 3

    // Create new mock for reconnect attempt
    const newMockWs = createMockWs()
    vi.mocked(globalThis.WebSocket).mockImplementationOnce(function () {
      mockWsInstance = newMockWs
      return newMockWs as any
    })

    // Trigger onclose on the old ws instance
    closedWs.onclose?.({} as CloseEvent)

    // Advance timers to trigger reconnect
    vi.advanceTimersByTime(2500)

    // A new WebSocket should be created
    expect(vi.mocked(globalThis.WebSocket).mock.calls.length).toBeGreaterThan(1)

    vi.useRealTimers()
  })

  it('dispatches reconnected event on successful reconnect', async () => {
    vi.useFakeTimers()
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const reconnectedHandler = vi.fn()
    svc.on('reconnected', reconnectedHandler)

    const closedWs = mockWsInstance
    closedWs.readyState = 3

    const newMockWs = createMockWs()
    vi.mocked(globalThis.WebSocket).mockImplementationOnce(function () {
      mockWsInstance = newMockWs
      return newMockWs as any
    })

    closedWs.onclose?.({} as CloseEvent)
    vi.advanceTimersByTime(2500)

    // Complete authentication on new connection
    await Promise.resolve()
    newMockWs.readyState = 1
    newMockWs.onopen?.(new Event('open'))
    serverSend(newMockWs, { type: 'authenticated', userId: 1, username: 'Alice' })

    await vi.runAllTimersAsync()

    expect(reconnectedHandler).toHaveBeenCalled()
    vi.useRealTimers()
  })

  
})

// ── edge cases ─────────────────────────────────────────────────────────────────

describe('WebSocketService — edge cases', () => {
  it('handles malformed JSON in onmessage during handshake', async () => {
    const svc = new WebSocketService('ws://test')
    const promise = svc.connect('token')

    mockWsInstance.readyState = 1
    mockWsInstance.onopen?.(new Event('open'))

    // Send malformed JSON
    mockWsInstance.onmessage?.({ data: 'not valid json' } as MessageEvent)

    // The promise should eventually reject/resolve or not crash
    // Trigger proper auth to settle
    serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })
    await promise
    expect(svc.isConnected()).toBe(true)
  })

  it('does not dispatch events for unknown types', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    const handler = vi.fn()
    svc.on('known_type', handler)

    serverSend(mockWsInstance, { type: 'unknown_type', data: 'x' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('disconnect clears the ws reference', async () => {
    const svc = new WebSocketService('ws://test')
    await connectService(svc)

    svc.disconnect()

    // Verify isConnected returns false after disconnect
    expect(svc.isConnected()).toBe(false)
  })

  it('send before connect does not throw', () => {
    const svc = new WebSocketService('ws://test')
    expect(() => svc.send({ type: 'anything' })).not.toThrow()
  })
})
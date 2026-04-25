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
    readyState: 0, // CONNECTING inicialmente
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  }
}

/**
 * Simula que el servidor envía un mensaje al cliente
 */
function serverSend(mockWs: MockWs, data: object) {
  mockWs.onmessage?.({
    data: JSON.stringify(data),
  } as MessageEvent)
}

beforeEach(() => {
  mockWsInstance = createMockWs()

  // WebSocket must be stubbed as a proper constructor function (not an arrow
  // function) so that `new WebSocket(url)` works inside the service.
  const MockWebSocket = vi.fn(function (this: MockWs) {
    return mockWsInstance
  })

  vi.stubGlobal('WebSocket', MockWebSocket)

  // Define the OPEN constant so the service can check readyState === WebSocket.OPEN
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

  // Paso 1: Simular apertura de conexión
  mockWsInstance.readyState = 1
  mockWsInstance.onopen?.(new Event('open'))

  // Paso 2: Simular respuesta de autenticación exitosa
  serverSend(mockWsInstance, { type: 'authenticated', userId: 1, username: 'Alice' })

  await connectPromise
  return service
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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

    // No debería haber creado un nuevo objeto WebSocket
    expect(vi.mocked(globalThis.WebSocket).mock.calls.length).toBe(callCount)
  })
})

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
})

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
})
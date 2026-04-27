import { WS_URL } from '@/config/api'

type MessageHandler = (data: Record<string, any>) => void

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 5
/** How often to send app-level pings to detect a dead server connection (ms) */
const PING_INTERVAL_MS = 25_000
/** How long to wait for a pong before forcing a reconnect (ms) */
const PONG_TIMEOUT_MS = 8_000

/**
 * Wrapper ligero para el cliente WebSocket con reconexión automática.
 *
 * Heartbeat: sends { type: 'ping' } every PING_INTERVAL_MS.
 * If no { type: 'pong' } arrives within PONG_TIMEOUT_MS, the socket is
 * closed and the standard reconnect logic kicks in.
 *
 * session_replaced: when the server notifies us that another tab took over
 * this user's session, intentionalClose is set to true so we don't loop.
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private readonly handlers = new Map<string, Set<MessageHandler>>()
  private currentToken: string | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private connectionPromise: Promise<void> | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly url: string) {}

  /**
   * Abre la conexión y autentica con el JWT.
   * Resuelve cuando el servidor confirma con { type: 'authenticated' }.
   * Si ya está conectado, resuelve inmediatamente.
   */
  connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()

    // If there's an in-flight connection attempt, return its promise
    if (this.connectionPromise) return this.connectionPromise

    this.currentToken = token
    this.intentionalClose = false
    this.connectionPromise = this._doConnect(token)
    return this.connectionPromise
  }

  private _doConnect(token: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url)
      let settled = false

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true
          fn()
        }
      }

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }))
      }

      ws.onmessage = (event: MessageEvent) => {
        let msg: Record<string, any>
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (!settled) {
          if (msg.type === 'authenticated') {
            this.ws = ws
            this.reconnectAttempts = 0
            this._startPing()
            ws.onmessage = (e: MessageEvent) => {
              try {
                this.dispatch(JSON.parse(e.data))
              } catch {
                /* ignore parse errors */
              }
            }
            settle(resolve)
          } else {
            const errorMsg = (msg.message as string) ?? 'Authentication failed'
            settle(() => reject(new Error(errorMsg)))
            ws.close()
          }
          return
        }

        this.dispatch(msg)
      }

      ws.onerror = () => {
        settle(() => reject(new Error('WebSocket connection failed')))
      }

      ws.onclose = () => {
        settle(() => reject(new Error('Connection closed before authentication')))
        if (this.ws === ws) {
          this.ws = null
          this.connectionPromise = null
          this._stopPing()
          // Auto-reconnect only if not intentionally closed
          if (!this.intentionalClose && this.currentToken) {
            this._scheduleReconnect()
          }
        }
      }
    }).finally(() => {
      // Clear connection promise when settled (success or failure)
      // but only if ws is now open (success case keeps the ws)
      if (!this.ws) {
        this.connectionPromise = null
      }
    })
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.dispatch({ type: 'error', code: 'MAX_RECONNECT', message: 'Connection lost. Please refresh.' })
      return
    }

    this.reconnectAttempts++
    const delay = RECONNECT_DELAY_MS * Math.min(this.reconnectAttempts, 3)

    this.reconnectTimer = setTimeout(async () => {
      if (this.intentionalClose || !this.currentToken) return
      try {
        this.connectionPromise = this._doConnect(this.currentToken)
        await this.connectionPromise
        // Notify listeners that the connection was restored
        this.dispatch({ type: 'reconnected' })
      } catch {
        // _doConnect already schedules the next attempt via onclose
      }
    }, delay)
  }

  // ── Heartbeat ─────────────────────────────────────────────────────────────

  private _startPing(): void {
    this._stopPing()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return
      this.ws.send(JSON.stringify({ type: 'ping' }))
      this.pongTimeoutTimer = setTimeout(() => {
        this.ws?.close()
      }, PONG_TIMEOUT_MS)
    }, PING_INTERVAL_MS)
  }

  private _stopPing(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.pongTimeoutTimer !== null) {
      clearTimeout(this.pongTimeoutTimer)
      this.pongTimeoutTimer = null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  /** Cierra la conexión y limpia la referencia. */
  disconnect(): void {
    this.intentionalClose = true
    this.currentToken = null
    this.reconnectAttempts = 0
    this._stopPing()
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.connectionPromise = null
  }

  /** Envía un mensaje al servidor. Se ignora si no hay conexión. */
  send(message: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Se suscribe a un tipo de mensaje del servidor.
   * @returns Función para desuscribirse.
   */
  on(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
    return () => {
      this.handlers.get(type)?.delete(handler)
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private dispatch(message: Record<string, any>): void {
    // session_replaced: another tab took over — stop reconnecting.
    if (message.type === 'session_replaced') {
      this.intentionalClose = true
    }
    // pong: cancel the timeout that would force-close on no response.
    if (message.type === 'pong' && this.pongTimeoutTimer !== null) {
      clearTimeout(this.pongTimeoutTimer)
      this.pongTimeoutTimer = null
    }
    const type = message.type as string
    this.handlers.get(type)?.forEach((h) => h(message))
  }
}

export const wsService = new WebSocketService(WS_URL)

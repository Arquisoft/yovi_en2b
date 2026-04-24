import { WS_URL } from '@/config/api'

type MessageHandler = (data: Record<string, any>) => void

const RECONNECT_DELAY_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 5

/**
 * Wrapper ligero para el cliente WebSocket con reconexión automática.
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private readonly handlers = new Map<string, Set<MessageHandler>>()
  private currentToken: string | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private connectionPromise: Promise<void> | null = null

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

  /** Cierra la conexión y limpia la referencia. */
  disconnect(): void {
    this.intentionalClose = true
    this.currentToken = null
    this.reconnectAttempts = 0
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
    const type = message.type as string
    this.handlers.get(type)?.forEach((h) => h(message))
  }
}

export const wsService = new WebSocketService(WS_URL)
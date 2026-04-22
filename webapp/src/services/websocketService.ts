import { WS_URL } from '@/config/api'

type MessageHandler = (data: Record<string, any>) => void

/**
 * Wrapper ligero para el cliente WebSocket.
 * * - Gestiona la conexión única y la autenticación vía JWT.
 * - Enruta mensajes entrantes a sus respectivos listeners.
 * - Devuelve funciones de limpieza (unsubscribe) ideales para useEffect.
 */
export class WebSocketService {
  private ws: WebSocket | null = null
  private readonly handlers = new Map<string, Set<MessageHandler>>()

  constructor(private readonly url: string) {}

  /**
   * Abre la conexión y autentica con el JWT.
   * Resuelve cuando el servidor confirma con { type: 'authenticated' }.
   */
  connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve()

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

        // Flujo inicial de autenticación
        if (!settled) {
          if (msg.type === 'authenticated') {
            this.ws = ws
            // Reemplazamos el handler de mensaje por el dispatcher general
            ws.onmessage = (e: MessageEvent) => {
              try {
                this.dispatch(JSON.parse(e.data))
              } catch {
                /* Ignorar errores de parseo */
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
        if (this.ws === ws) this.ws = null
      }
    })
  }

  /** Cierra la conexión y limpia la referencia. */
  disconnect(): void {
    this.ws?.close()
    this.ws = null
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

// Exportamos una única instancia para toda la aplicación (Singleton)
export const wsService = new WebSocketService(WS_URL)
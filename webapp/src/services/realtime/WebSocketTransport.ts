import type { RealtimeEventType } from '@/types'
import type {
  RealtimeTransport,
  EventHandler,
  UnsubscribeFn,
  PollingResource,
} from './RealtimeTransport'

/**
 * WebSocket-based implementation of RealtimeTransport
 * This is a placeholder/stub for future implementation
 * 
 * When implemented, this will:
 * - Connect to a WebSocket server
 * - Subscribe to channels for games, rooms, chat
 * - Emit the same events as PollingTransport
 * - Handle reconnection logic
 */
export class WebSocketTransport implements RealtimeTransport {
  private wsUrl: string
  private ws: WebSocket | null = null
  private subscribers: Map<RealtimeEventType | '*', Set<EventHandler>> = new Map()
  private subscribedResources: Set<string> = new Set()

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl
  }

  connect(): void {
    if (this.ws) return
    
    this.ws = new WebSocket(this.wsUrl)
    
    this.ws.onopen = () => {
      console.log('WebSocket connected')
      // Resubscribe to resources
      for (const resource of this.subscribedResources) {
        this.ws?.send(JSON.stringify({ action: 'subscribe', resource }))
      }
    }
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e)
      }
    }
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.ws = null
      // Could implement reconnection logic here
    }
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
    this.subscribedResources.clear()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  subscribe<T>(
    eventType: RealtimeEventType,
    handler: EventHandler<T>
  ): UnsubscribeFn {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set())
    }
    
    this.subscribers.get(eventType)!.add(handler as EventHandler)
    
    return () => {
      this.subscribers.get(eventType)?.delete(handler as EventHandler)
    }
  }

  subscribeAll(handler: EventHandler): UnsubscribeFn {
    if (!this.subscribers.has('*')) {
      this.subscribers.set('*', new Set())
    }
    
    this.subscribers.get('*')!.add(handler)
    
    return () => {
      this.subscribers.get('*')?.delete(handler)
    }
  }

  startPolling(resource: PollingResource): void {
    const resourceKey = this.getResourceKey(resource)
    this.subscribedResources.add(resourceKey)
    
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify({ action: 'subscribe', resource: resourceKey }))
    }
  }

  stopPolling(resource: PollingResource): void {
    const resourceKey = this.getResourceKey(resource)
    this.subscribedResources.delete(resourceKey)
    
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify({ action: 'unsubscribe', resource: resourceKey }))
    }
  }

  async refresh(_resource: PollingResource): Promise<void> {
    // With WebSocket, data is pushed in real-time
    // This could send a request for immediate update if needed
  }

  private getResourceKey(resource: PollingResource): string {
    switch (resource.type) {
      case 'game':
        return `game:${resource.gameId}`
      case 'room':
        return `room:${resource.roomId}`
      case 'lobby':
        return 'lobby'
      case 'chat':
        return `chat:${resource.gameId}`
    }
  }

  private handleMessage(data: { type: RealtimeEventType; payload: unknown }): void {
    const event = {
      type: data.type,
      payload: data.payload,
      timestamp: Date.now(),
    }
    
    // Notify specific subscribers
    this.subscribers.get(data.type)?.forEach((handler) => handler(event))
    
    // Notify global subscribers
    this.subscribers.get('*')?.forEach((handler) => handler(event))
  }
}

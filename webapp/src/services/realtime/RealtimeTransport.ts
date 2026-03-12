import type { RealtimeEvent, RealtimeEventType } from '@/types'

export type EventHandler<T = unknown> = (event: RealtimeEvent<T>) => void
export type UnsubscribeFn = () => void

/**
 * Abstract interface for real-time transport
 * Can be implemented by PollingTransport or WebSocketTransport
 */
export interface RealtimeTransport {
  /**
   * Connect to the real-time service
   */
  connect(): void

  /**
   * Disconnect from the real-time service
   */
  disconnect(): void

  /**
   * Check if connected
   */
  isConnected(): boolean

  /**
   * Subscribe to a specific event type
   */
  subscribe<T>(
    eventType: RealtimeEventType,
    handler: EventHandler<T>
  ): UnsubscribeFn

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: EventHandler): UnsubscribeFn

  /**
   * Start polling/listening for a specific resource
   */
  startPolling(resource: PollingResource): void

  /**
   * Stop polling/listening for a specific resource
   */
  stopPolling(resource: PollingResource): void

  /**
   * Force an immediate refresh of a resource
   */
  refresh(resource: PollingResource): Promise<void>
}

/**
 * Polling resource types
 */
export type PollingResource =
  | { type: 'game'; gameId: string }
  | { type: 'room'; roomId: string }
  | { type: 'lobby' }
  | { type: 'chat'; gameId: string }

/**
 * Get a unique key for a polling resource
 */
export function getResourceKey(resource: PollingResource): string {
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

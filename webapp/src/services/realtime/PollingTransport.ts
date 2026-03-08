import type { RealtimeEvent, RealtimeEventType } from '@/types'
import type {
  RealtimeTransport,
  EventHandler,
  UnsubscribeFn,
  PollingResource,
} from './RealtimeTransport'
import { getResourceKey } from './RealtimeTransport'
import { gameService } from '@/services/gameService'

interface PollingConfig {
  defaultInterval: number
  hiddenTabInterval: number
}

interface PollingTask {
  resource: PollingResource
  intervalId: ReturnType<typeof setInterval> | null
  lastData: unknown
}

/**
 * Polling-based implementation of RealtimeTransport
 * Provides event-based API while using polling under the hood
 */
export class PollingTransport implements RealtimeTransport {
  private config: PollingConfig
  private connected = false
  private subscribers: Map<RealtimeEventType | '*', Set<EventHandler>> = new Map()
  private pollingTasks: Map<string, PollingTask> = new Map()
  private isTabVisible = true
  private visibilityHandler: (() => void) | null = null

  constructor(config: PollingConfig) {
    this.config = config
  }

  connect(): void {
    if (this.connected) return

    this.connected = true

    // Handle tab visibility
    this.visibilityHandler = () => {
      this.isTabVisible = !document.hidden
      this.adjustPollingIntervals()
    }

    document.addEventListener('visibilitychange', this.visibilityHandler)
  }

  disconnect(): void {
    this.connected = false

    // Clear all polling tasks
    for (const [, task] of this.pollingTasks) {
      if (task.intervalId) {
        clearInterval(task.intervalId)
      }
    }
    this.pollingTasks.clear()

    // Remove visibility listener
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
  }

  isConnected(): boolean {
    return this.connected
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
    if (!this.connected) {
      this.connect()
    }

    const key = getResourceKey(resource)

    if (this.pollingTasks.has(key)) {
      return // Already polling this resource
    }

    const task: PollingTask = {
      resource,
      intervalId: null,
      lastData: null,
    }

    this.pollingTasks.set(key, task)
    this.startPollingTask(key, task)
  }

  stopPolling(resource: PollingResource): void {
    const key = getResourceKey(resource)
    const task = this.pollingTasks.get(key)

    if (task?.intervalId) {
      clearInterval(task.intervalId)
    }

    this.pollingTasks.delete(key)
  }

  async refresh(resource: PollingResource): Promise<void> {
    await this.fetchResource(resource)
  }

  private startPollingTask(_key: string, task: PollingTask): void {
    const interval = this.isTabVisible
      ? this.config.defaultInterval
      : this.config.hiddenTabInterval

    // Initial fetch
    this.fetchResource(task.resource)

    // Set up interval
    task.intervalId = setInterval(() => {
      this.fetchResource(task.resource)
    }, interval)
  }

  private adjustPollingIntervals(): void {
    // Restart all polling tasks with new intervals
    for (const [key, task] of this.pollingTasks) {
      if (task.intervalId) {
        clearInterval(task.intervalId)
      }
      this.startPollingTask(key, task)
    }
  }

  private async fetchResource(resource: PollingResource): Promise<void> {
    try {
      const key = getResourceKey(resource)
      const task = this.pollingTasks.get(key)

      let data: unknown
      let eventType: RealtimeEventType

      switch (resource.type) {
        case 'game': {
          data = await gameService.getGameState(resource.gameId)
          eventType = 'gameUpdated'
          break
        }
        case 'room': {
          data = await gameService.getRoom(resource.roomId)
          eventType = 'roomUpdated'
          break
        }
        case 'lobby': {
          data = await gameService.getRooms()
          eventType = 'lobbyUpdated'
          break
        }
        case 'chat': {
          data = await gameService.getChatMessages(resource.gameId)
          eventType = 'chatMessageReceived'
          break
        }
      }

      // Only emit if data changed (simple JSON comparison)
      const dataStr = JSON.stringify(data)
      const lastDataStr = task ? JSON.stringify(task.lastData) : null

      if (dataStr !== lastDataStr) {
        if (task) {
          task.lastData = data
        }
        this.emit(eventType, data)
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }

  private emit<T>(type: RealtimeEventType, payload: T): void {
    const event: RealtimeEvent<T> = {
      type,
      payload,
      timestamp: Date.now(),
    }

    // Notify specific subscribers
    this.subscribers.get(type)?.forEach((handler) => handler(event))

    // Notify global subscribers
    this.subscribers.get('*')?.forEach((handler) => handler(event))
  }
}

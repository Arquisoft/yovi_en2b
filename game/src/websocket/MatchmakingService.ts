import type { QueueEntry } from './types'

/**
 * MatchmakingService manages the in-memory queue of players waiting for an
 * online opponent.  It has no WebSocket dependency and can be unit-tested
 * without a real server.  The caller is responsible for sending WS messages
 * after acting on the value returned by tryMatch().
 */
export class MatchmakingService {
  private readonly queue = new Map<number, QueueEntry>()

  /**
   * Add a player to the queue.
   * Silently replaces any previous entry for the same userId (e.g. on reconnect).
   */
  join(entry: QueueEntry): void {
    this.queue.set(entry.userId, entry)
  }

  /**
   * Remove a player from the queue.
   * @returns true if the player was in the queue, false otherwise.
   */
  leave(userId: number): boolean {
    return this.queue.delete(userId)
  }

  /**
   * If two or more players are waiting, dequeue and return the first pair.
   * Players are matched in insertion order (longest-waiting first).
   * @returns [player1, player2] or null when fewer than 2 players wait.
   */
  tryMatch(): [QueueEntry, QueueEntry] | null {
    if (this.queue.size < 2) return null

    const iter = this.queue.values()
    const p1 = iter.next().value as QueueEntry
    const p2 = iter.next().value as QueueEntry

    this.queue.delete(p1.userId)
    this.queue.delete(p2.userId)

    return [p1, p2]
  }

  /** Whether the given userId is currently in the queue */
  contains(userId: number): boolean {
    return this.queue.has(userId)
  }

  /** Current number of players waiting */
  size(): number {
    return this.queue.size
  }

  /** Remove all entries (used on server shutdown / tests) */
  clear(): void {
    this.queue.clear()
  }
}

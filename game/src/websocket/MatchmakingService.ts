import type { GameVariant } from '../types/game'
import type { QueueEntry } from './types'

/**
 * MatchmakingService manages the in-memory queue of players waiting for an
 * online opponent.  It has no WebSocket dependency and can be unit-tested
 * without a real server.  The caller is responsible for sending WS messages
 * after acting on the value returned by `tryMatch()`.
 *
 * ## Variant-aware design
 *
 * Players queue *for a specific game variant*; matching only pairs players
 * within the same queue.  Internally the service keeps one FIFO map per
 * variant — adding a new variant requires no code change here.
 *
 * Each user can be in at most one variant's queue at a time: re-joining a
 * different variant first removes the user from any existing queue.
 *
 * The variant-keyed structure is the simplest extension point for future
 * matchmaking policies (size-bucketed queues, ELO-aware pairing, etc.) — they
 * would slot in as alternative implementations of `tryMatch()` without
 * disturbing the public surface.
 */
export class MatchmakingService {
  private readonly queues = new Map<GameVariant, Map<number, QueueEntry>>()

  /**
   * Add `entry` to the queue for `variant`.
   * Silently replaces any previous entry for the same userId in the same
   * queue.  Also evicts the user from any other variant's queue — a player
   * can only wait for one variant at a time.
   */
  join(variant: GameVariant, entry: QueueEntry): void {
    this.leave(entry.userId)
    this.queueFor(variant).set(entry.userId, entry)
  }

  /**
   * Remove a player from whichever variant queue contains them.
   * @returns `true` if the player was found and removed.
   */
  leave(userId: number): boolean {
    let removed = false
    for (const queue of this.queues.values()) {
      if (queue.delete(userId)) removed = true
    }
    return removed
  }

  /**
   * If two or more players are waiting in `variant`'s queue, dequeue and
   * return the first pair.  Players are matched in insertion order
   * (longest-waiting first).
   * @returns `[player1, player2]` or `null` when fewer than 2 wait.
   */
  tryMatch(variant: GameVariant): [QueueEntry, QueueEntry] | null {
    const queue = this.queues.get(variant)
    if (!queue || queue.size < 2) return null

    const iter = queue.values()
    const p1 = iter.next().value as QueueEntry
    const p2 = iter.next().value as QueueEntry

    queue.delete(p1.userId)
    queue.delete(p2.userId)

    return [p1, p2]
  }

  /** Whether the user is currently waiting in any variant's queue. */
  contains(userId: number): boolean {
    for (const queue of this.queues.values()) {
      if (queue.has(userId)) return true
    }
    return false
  }

  /** Total number of players waiting across all variants. */
  size(): number {
    let total = 0
    for (const queue of this.queues.values()) total += queue.size
    return total
  }

  /** Number of players waiting for a specific variant. */
  sizeOf(variant: GameVariant): number {
    return this.queues.get(variant)?.size ?? 0
  }

  /** Remove all entries (used on server shutdown / tests). */
  clear(): void {
    this.queues.clear()
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private queueFor(variant: GameVariant): Map<number, QueueEntry> {
    let queue = this.queues.get(variant)
    if (!queue) {
      queue = new Map()
      this.queues.set(variant, queue)
    }
    return queue
  }
}

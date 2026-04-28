import { describe, it, expect, beforeEach } from 'vitest'
import { MatchmakingService } from '../websocket/MatchmakingService'
import type { QueueEntry } from '../websocket/types'
import type { GameVariant } from '../types/game'

/**
 * Helper para crear entradas de cola rápidamente.
 */
function makeEntry(userId: number, username = `player${userId}`): QueueEntry {
  return {
    userId,
    username,
    token: `token-${userId}`,
    joinedAt: Date.now(),
  }
}

const Y: GameVariant = 'y'
const WN: GameVariant = 'why-not'

describe('MatchmakingService', () => {
  let svc: MatchmakingService

  beforeEach(() => {
    svc = new MatchmakingService()
  })

  describe('join', () => {
    it('adds player to a variant queue', () => {
      svc.join(Y, makeEntry(1))
      expect(svc.size()).toBe(1)
      expect(svc.sizeOf(Y)).toBe(1)
      expect(svc.contains(1)).toBe(true)
    })

    it('replaces existing entry for same userId in same queue', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, { ...makeEntry(1), username: 'newname' })
      expect(svc.sizeOf(Y)).toBe(1)
    })

    it('moves a user across queues when joining a different variant', () => {
      svc.join(Y, makeEntry(1))
      svc.join(WN, makeEntry(1))
      expect(svc.sizeOf(Y)).toBe(0)
      expect(svc.sizeOf(WN)).toBe(1)
      expect(svc.contains(1)).toBe(true)
    })

    it('multiple players added independently', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.join(Y, makeEntry(3))
      expect(svc.sizeOf(Y)).toBe(3)
    })
  })

  describe('leave', () => {
    it('returns true when player was in any queue', () => {
      svc.join(Y, makeEntry(1))
      expect(svc.leave(1)).toBe(true)
      expect(svc.size()).toBe(0)
    })

    it('returns false when player was not in any queue', () => {
      expect(svc.leave(99)).toBe(false)
    })

    it('does not affect other players in the same queue', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.leave(1)
      expect(svc.contains(2)).toBe(true)
    })

    it('does not affect players in other queues', () => {
      svc.join(Y, makeEntry(1))
      svc.join(WN, makeEntry(2))
      svc.leave(1)
      expect(svc.contains(2)).toBe(true)
      expect(svc.sizeOf(WN)).toBe(1)
    })
  })

  describe('tryMatch', () => {
    it('returns null when the requested variant queue is empty', () => {
      expect(svc.tryMatch(Y)).toBeNull()
    })

    it('returns null with only one player in that variant', () => {
      svc.join(Y, makeEntry(1))
      expect(svc.tryMatch(Y)).toBeNull()
    })

    it('returns pair when two players are waiting for the same variant', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      const result = svc.tryMatch(Y)

      expect(result).not.toBeNull()
      const [p1, p2] = result!
      expect([p1.userId, p2.userId].sort()).toEqual([1, 2])
    })

    it('removes matched players from the queue', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.tryMatch(Y)
      expect(svc.sizeOf(Y)).toBe(0)
    })

    it('returns oldest waiters first (insertion order)', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.join(Y, makeEntry(3))

      const result = svc.tryMatch(Y)
      expect(result![0].userId).toBe(1)
      expect(result![1].userId).toBe(2)
      expect(svc.sizeOf(Y)).toBe(1)
      expect(svc.contains(3)).toBe(true)
    })

    it('preserves remaining players after match', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.join(Y, makeEntry(3))
      svc.tryMatch(Y)
      expect(svc.sizeOf(Y)).toBe(1)
      expect(svc.contains(3)).toBe(true)
    })

    it('can match multiple pairs sequentially', () => {
      for (let i = 1; i <= 4; i++) svc.join(Y, makeEntry(i))

      expect(svc.tryMatch(Y)).not.toBeNull()
      expect(svc.tryMatch(Y)).not.toBeNull()
      expect(svc.tryMatch(Y)).toBeNull()
    })

    it('returned entries contain correct data', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))

      const [r1, r2] = svc.tryMatch(Y)!
      expect(r1.token).toBe('token-1')
      expect(r2.token).toBe('token-2')
    })

    // ── Cross-variant isolation ───────────────────────────────────────────
    //
    // Players queueing for different variants must never be paired with each
    // other; otherwise WhY Not? players would suddenly find themselves in a
    // standard Y game (or worse).

    it('does not pair players from different variants', () => {
      svc.join(Y, makeEntry(1))
      svc.join(WN, makeEntry(2))

      expect(svc.tryMatch(Y)).toBeNull()
      expect(svc.tryMatch(WN)).toBeNull()
    })

    it('matches only within the requested variant when both queues are filled', () => {
      svc.join(Y, makeEntry(1))
      svc.join(Y, makeEntry(2))
      svc.join(WN, makeEntry(3))
      svc.join(WN, makeEntry(4))

      const yPair = svc.tryMatch(Y)
      const wnPair = svc.tryMatch(WN)

      expect([yPair![0].userId, yPair![1].userId].sort()).toEqual([1, 2])
      expect([wnPair![0].userId, wnPair![1].userId].sort()).toEqual([3, 4])
    })
  })

  describe('contains', () => {
    it('returns false for unknown userId', () => {
      expect(svc.contains(42)).toBe(false)
    })

    it('returns true after join in any variant', () => {
      svc.join(WN, makeEntry(5))
      expect(svc.contains(5)).toBe(true)
    })

    it('returns false after leave', () => {
      svc.join(Y, makeEntry(5))
      svc.leave(5)
      expect(svc.contains(5)).toBe(false)
    })
  })

  describe('size and sizeOf', () => {
    it('size sums across variants', () => {
      svc.join(Y, makeEntry(1))
      svc.join(WN, makeEntry(2))
      expect(svc.size()).toBe(2)
      expect(svc.sizeOf(Y)).toBe(1)
      expect(svc.sizeOf(WN)).toBe(1)
    })

    it('sizeOf returns 0 for an empty variant queue', () => {
      expect(svc.sizeOf(Y)).toBe(0)
      expect(svc.sizeOf(WN)).toBe(0)
    })
  })

  describe('clear', () => {
    it('empties every variant queue', () => {
      svc.join(Y, makeEntry(1))
      svc.join(WN, makeEntry(2))
      svc.clear()
      expect(svc.size()).toBe(0)
    })
  })
})

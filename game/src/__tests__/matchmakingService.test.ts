import { describe, it, expect, beforeEach } from 'vitest'
import { MatchmakingService } from '../websocket/MatchmakingService'
import type { QueueEntry } from '../websocket/types'

/**
 * Helper para crear entradas de cola rápidamente
 */
function makeEntry(userId: number, username = `player${userId}`): QueueEntry {
  return {
    userId,
    username,
    token: `token-${userId}`,
    joinedAt: Date.now()
  }
}

describe('MatchmakingService', () => {
  let svc: MatchmakingService

  beforeEach(() => {
    svc = new MatchmakingService()
  })

  describe('join', () => {
    it('adds player to queue', () => {
      svc.join(makeEntry(1))
      expect(svc.size()).toBe(1)
      expect(svc.contains(1)).toBe(true)
    })

    it('replacing existing entry for same userId', () => {
      const e1 = makeEntry(1)
      const e2 = { ...makeEntry(1), username: 'newname' }
      svc.join(e1)
      svc.join(e2)
      expect(svc.size()).toBe(1)
    })

    it('multiple players added independently', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.join(makeEntry(3))
      expect(svc.size()).toBe(3)
    })
  })

  describe('leave', () => {
    it('returns true when player was in queue', () => {
      svc.join(makeEntry(1))
      expect(svc.leave(1)).toBe(true)
      expect(svc.size()).toBe(0)
    })

    it('returns false when player was not in queue', () => {
      expect(svc.leave(99)).toBe(false)
    })

    it('does not affect other players', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.leave(1)
      expect(svc.contains(2)).toBe(true)
    })
  })

  describe('tryMatch', () => {
    it('returns null when queue is empty', () => {
      expect(svc.tryMatch()).toBeNull()
    })

    it('returns null with only one player', () => {
      svc.join(makeEntry(1))
      expect(svc.tryMatch()).toBeNull()
    })

    it('returns pair when two players are waiting', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      const result = svc.tryMatch()
      
      expect(result).not.toBeNull()
      const [p1, p2] = result!
      expect([p1.userId, p2.userId].sort()).toEqual([1, 2])
    })

    it('removes matched players from queue', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.tryMatch()
      expect(svc.size()).toBe(0)
    })

    it('returns oldest waiters first (insertion order)', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.join(makeEntry(3))
      
      const result = svc.tryMatch()
      expect(result![0].userId).toBe(1)
      expect(result![1].userId).toBe(2)
      expect(svc.size()).toBe(1)
      expect(svc.contains(3)).toBe(true)
    })

    it('preserves remaining players after match', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.join(makeEntry(3))
      svc.tryMatch()
      expect(svc.size()).toBe(1)
      expect(svc.contains(3)).toBe(true)
    })

    it('can match multiple pairs sequentially', () => {
      for (let i = 1; i <= 4; i++) svc.join(makeEntry(i))
      
      expect(svc.tryMatch()).not.toBeNull()
      expect(svc.tryMatch()).not.toBeNull()
      expect(svc.tryMatch()).toBeNull()
    })

    it('returned entries contain correct data', () => {
      const e1 = makeEntry(1)
      const e2 = makeEntry(2)
      svc.join(e1)
      svc.join(e2)
      
      const [r1, r2] = svc.tryMatch()!
      expect(r1.token).toBe('token-1')
      expect(r2.token).toBe('token-2')
    })
  })

  describe('contains', () => {
    it('returns false for unknown userId', () => {
      expect(svc.contains(42)).toBe(false)
    })

    it('returns true after join', () => {
      svc.join(makeEntry(5))
      expect(svc.contains(5)).toBe(true)
    })

    it('returns false after leave', () => {
      svc.join(makeEntry(5))
      svc.leave(5)
      expect(svc.contains(5)).toBe(false)
    })
  })

  describe('clear', () => {
    it('empties the queue', () => {
      svc.join(makeEntry(1))
      svc.join(makeEntry(2))
      svc.clear()
      expect(svc.size()).toBe(0)
    })
  })
})
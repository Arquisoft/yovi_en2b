// users/__tests__/RankingService.test.ts
import { RankingService } from '../services/RankingService'
import { GameMode } from '../types/ranking'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppDataSource } from '../config/database'
import { MatchRecord } from '../entities/MatchRecord'

// Mock AppDataSource so tests run without a real DB
vi.mock('../config/database', () => ({
  AppDataSource: {
    getRepository: vi.fn(),
  },
}))

function makeQueryBuilder(rawRows: any[]) {
  const qb: any = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue(rawRows),
  }
  return qb
}

describe('RankingService', () => {
  describe('getRankingByMode', () => {
    it('returns empty array for unknown game mode', async () => {
      const result = await RankingService.getRankingByMode('unknown' as GameMode)
      expect(result).toEqual([])
    })

    it('returns empty array for pve-easy when no wins exist', async () => {
      const qb = makeQueryBuilder([])
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-easy')
      expect(result).toEqual([])
    })

    it('returns ranking for pve-easy mode with correct shape', async () => {
      const qb = makeQueryBuilder([
        { username: 'PlayerOne', wins: '42' },
        { username: 'PlayerTwo', wins: '38' },
      ])
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-easy')
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerOne', wins: 42 })
      expect(result[1]).toEqual({ rank: 2, username: 'PlayerTwo', wins: 38 })
    })

    it('returns ranking for pve-medium mode', async () => {
      const qb = makeQueryBuilder([
        { username: 'PlayerTwo', wins: '29' },
        { username: 'PlayerOne', wins: '24' },
      ])
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-medium')
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerTwo', wins: 29 })
    })

    it('returns ranking for pve-hard mode', async () => {
      const qb = makeQueryBuilder([
        { username: 'PlayerFive', wins: '11' },
      ])
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-hard')
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerFive', wins: 11 })
    })

    it('assigns sequential rank values starting from 1', async () => {
      const rows = [
        { username: 'A', wins: '10' },
        { username: 'B', wins: '8' },
        { username: 'C', wins: '5' },
      ]
      const qb = makeQueryBuilder(rows)
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-easy')
      result.forEach((entry, index) => {
        expect(entry.rank).toBe(index + 1)
      })
    })

    it('converts wins string to number', async () => {
      const qb = makeQueryBuilder([{ username: 'X', wins: '7' }])
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      const result = await RankingService.getRankingByMode('pve-easy')
      expect(typeof result[0].wins).toBe('number')
      expect(result[0].wins).toBe(7)
    })

    it('filters by game_mode in the query', async () => {
      const qb = makeQueryBuilder([])
      const andWhereSpy = vi.spyOn(qb, 'andWhere').mockReturnThis()
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      await RankingService.getRankingByMode('pve-hard')

      const modeCall = andWhereSpy.mock.calls.find(
        (args) => typeof args[0] === 'string' && args[0].includes('game_mode')
      )
      expect(modeCall).toBeDefined()
      expect(modeCall![1]).toEqual({ mode: 'pve-hard' })
    })

    it('filters by result = win in the query', async () => {
      const qb = makeQueryBuilder([])
      const whereSpy = vi.spyOn(qb, 'where').mockReturnThis()
      vi.mocked(AppDataSource.getRepository).mockReturnValue({
        createQueryBuilder: vi.fn().mockReturnValue(qb),
      } as any)

      await RankingService.getRankingByMode('pve-easy')

      const winCall = whereSpy.mock.calls.find(
        (args) => typeof args[0] === 'string' && args[0].includes('result')
      )
      expect(winCall).toBeDefined()
      expect(winCall![1]).toEqual({ result: 'win' })
    })

    it('returns entries with correct shape for all valid modes', async () => {
      const modes: GameMode[] = ['pve-easy', 'pve-medium', 'pve-hard']
      for (const mode of modes) {
        const qb = makeQueryBuilder([{ username: 'TestUser', wins: '5' }])
        vi.mocked(AppDataSource.getRepository).mockReturnValue({
          createQueryBuilder: vi.fn().mockReturnValue(qb),
        } as any)

        const result = await RankingService.getRankingByMode(mode)
        result.forEach((entry) => {
          expect(entry).toHaveProperty('rank')
          expect(entry).toHaveProperty('username')
          expect(entry).toHaveProperty('wins')
          expect(typeof entry.rank).toBe('number')
          expect(typeof entry.username).toBe('string')
          expect(typeof entry.wins).toBe('number')
        })
      }
    })
  })
})
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { statsService } from './statsService'

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('StatsService', () => {
  describe('getMatchHistory', () => {
    it('returns array of match records on success', async () => {
      const records = [
        { id: '1', opponentName: 'Bot', result: 'win', durationSeconds: 120, playedAt: '2024-01-01T00:00:00.000Z' },
        { id: '2', opponentName: 'Alice', result: 'loss', durationSeconds: 300, playedAt: '2024-01-02T00:00:00.000Z' },
      ]
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => records,
      } as Response)

      const result = await statsService.getMatchHistory('my-token')

      expect(result).toHaveLength(2)
      expect(result[0].result).toBe('win')
      expect(result[1].opponentName).toBe('Alice')
    })

    it('sends Authorization header and calls /stats/history', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

      await statsService.getMatchHistory('my-token')

      const [url, options] = vi.mocked(fetch).mock.calls[0]
      expect(String(url)).toContain('/stats/history')
      expect((options?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
    })

    it('returns empty array when user has no match history', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response)

      const result = await statsService.getMatchHistory('my-token')
      expect(result).toEqual([])
    })

    it('throws using data.message when present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Token expired' }),
      } as Response)

      await expect(statsService.getMatchHistory('bad-token')).rejects.toThrow('Token expired')
    })

    it('throws using data.error as fallback when message is absent', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      await expect(statsService.getMatchHistory('bad-token')).rejects.toThrow('Unauthorized')
    })

    it('throws generic message when response body has no known error field', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)

      await expect(statsService.getMatchHistory('bad-token')).rejects.toThrow('Request failed')
    })
  })

  describe('getWinrate', () => {
    it('returns stats data with overall and recent winrates', async () => {
      const statsData = {
        overall: { wins: 10, losses: 5 },
        recent: { wins: 3, losses: 2 },
      }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => statsData,
      } as Response)

      const result = await statsService.getWinrate('my-token')

      expect(result.overall.wins).toBe(10)
      expect(result.overall.losses).toBe(5)
      expect(result.recent.wins).toBe(3)
    })

    it('sends Authorization header and calls /stats/winrate', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overall: { wins: 0, losses: 0 }, recent: { wins: 0, losses: 0 } }),
      } as Response)

      await statsService.getWinrate('my-token')

      const [url, options] = vi.mocked(fetch).mock.calls[0]
      expect(String(url)).toContain('/stats/winrate')
      expect((options?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
    })

    it('returns zero counts for a new user', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ overall: { wins: 0, losses: 0 }, recent: { wins: 0, losses: 0 } }),
      } as Response)

      const result = await statsService.getWinrate('my-token')
      expect(result.overall.wins).toBe(0)
      expect(result.overall.losses).toBe(0)
    })

    it('throws when the request fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Forbidden' }),
      } as Response)

      await expect(statsService.getWinrate('bad-token')).rejects.toThrow('Forbidden')
    })
  })
})

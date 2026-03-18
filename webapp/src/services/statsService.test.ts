// webapp/src/services/statsService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { statsService } from './statsService'

const mockHistory = [
  { id: '1', opponentName: 'Bot (medium)', result: 'win', durationSeconds: 142, playedAt: new Date().toISOString() },
  { id: '2', opponentName: 'PlayerTwo', result: 'loss', durationSeconds: 87, playedAt: new Date().toISOString() },
]

const mockStats = {
  overall: { wins: 8, losses: 4 },
  recent: { wins: 3, losses: 2 },
}

describe('statsService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getMatchHistory', () => {
    it('returns match history on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response)

      const result = await statsService.getMatchHistory('mock-token')
      expect(result).toEqual(mockHistory)
    })

    it('sends Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response)

      await statsService.getMatchHistory('my-token')

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const options = callArgs[1] as RequestInit
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
    })

    it('calls the correct endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockHistory,
      } as Response)

      await statsService.getMatchHistory('mock-token')

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('/stats/history')
    })

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      await expect(statsService.getMatchHistory('bad-token')).rejects.toThrow()
    })
  })

  describe('getWinrate', () => {
    it('returns winrate data on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as Response)

      const result = await statsService.getWinrate('mock-token')
      expect(result).toEqual(mockStats)
      expect(result.overall).toHaveProperty('wins')
      expect(result.overall).toHaveProperty('losses')
      expect(result.recent).toHaveProperty('wins')
      expect(result.recent).toHaveProperty('losses')
    })

    it('sends Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as Response)

      await statsService.getWinrate('my-token')

      const callArgs = vi.mocked(fetch).mock.calls[0]
      const options = callArgs[1] as RequestInit
      expect((options.headers as Record<string, string>)['Authorization']).toBe('Bearer my-token')
    })

    it('calls the correct endpoint', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockStats,
      } as Response)

      await statsService.getWinrate('mock-token')

      const url = vi.mocked(fetch).mock.calls[0][0] as string
      expect(url).toContain('/stats/winrate')
    })

    it('throws on non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      await expect(statsService.getWinrate('bad-token')).rejects.toThrow()
    })
  })
})

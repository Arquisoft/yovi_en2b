// webapp/src/services/rankingService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rankingService } from './rankingService'

describe('rankingService', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('calls the correct endpoint for pve-easy', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ rank: 1, username: 'PlayerOne', wins: 42 }],
    } as Response)

    const result = await rankingService.getRankingByMode('mock-token', 'pve-easy')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ranking/pve-easy'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    )
    expect(result[0].username).toBe('PlayerOne')
  })

  it('calls the correct endpoint for pve-hard', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ rank: 1, username: 'PlayerFive', wins: 11 }],
    } as Response)

    await rankingService.getRankingByMode('mock-token', 'pve-hard')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ranking/pve-hard'),
      expect.anything()
    )
  })

  it('throws when response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response)

    await expect(rankingService.getRankingByMode('bad-token', 'pve-easy'))
      .rejects.toThrow('Unauthorized')
  })
})
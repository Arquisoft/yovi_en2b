// users/__tests__/RankingController.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RankingController } from '../src/controllers/RankingController'
import { RankingService } from '../src/services/RankingService'

vi.mock('../src/services/RankingService', () => ({
  RankingService: {
    getRankingByMode: vi.fn(),
  },
}))

const mockRanking = [
  { rank: 1, username: 'PlayerOne', wins: 42 },
  { rank: 2, username: 'PlayerTwo', wins: 38 },
]

const mockRes = () => {
  const res: any = {}
  res.json = vi.fn().mockReturnValue(res)
  res.status = vi.fn().mockReturnValue(res)
  return res
}

describe('RankingController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(RankingService.getRankingByMode).mockResolvedValue(mockRanking)
  })

  it('returns ranking for pve-easy', async () => {
    const req = { params: { mode: 'pve-easy' } } as any
    const res = mockRes()
    await RankingController.getRankingByMode(req, res)
    expect(RankingService.getRankingByMode).toHaveBeenCalledWith('pve-easy')
    expect(res.json).toHaveBeenCalledWith(mockRanking)
  })

  it('returns ranking for pve-medium', async () => {
    const req = { params: { mode: 'pve-medium' } } as any
    const res = mockRes()
    await RankingController.getRankingByMode(req, res)
    expect(RankingService.getRankingByMode).toHaveBeenCalledWith('pve-medium')
    expect(res.json).toHaveBeenCalledWith(mockRanking)
  })

  it('returns ranking for pve-hard', async () => {
    const req = { params: { mode: 'pve-hard' } } as any
    const res = mockRes()
    await RankingController.getRankingByMode(req, res)
    expect(RankingService.getRankingByMode).toHaveBeenCalledWith('pve-hard')
    expect(res.json).toHaveBeenCalledWith(mockRanking)
  })

  it('returns 400 for invalid mode', async () => {
    const req = { params: { mode: 'invalid' } } as any
    const res = mockRes()
    await RankingController.getRankingByMode(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid game mode' })
  })

  it('returns 500 on service error', async () => {
    vi.mocked(RankingService.getRankingByMode).mockRejectedValue(new Error('DB error'))
    const req = { params: { mode: 'pve-easy' } } as any
    const res = mockRes()
    await RankingController.getRankingByMode(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'DB error' })
  })
})
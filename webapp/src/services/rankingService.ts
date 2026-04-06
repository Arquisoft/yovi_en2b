// webapp/src/services/rankingService.ts

import type { RankingEntry, RankingMode } from '@/types'
import { USERS_API_URL } from '@/config/api'

class RankingService {
  constructor(private baseUrl: string) {}

  private async request<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed')
    }
    return data
  }

  async getRankingByMode(token: string, mode: RankingMode): Promise<RankingEntry[]> {
    return this.request(`/ranking/${mode}`, token)
  }
}

export const rankingService = new RankingService(USERS_API_URL)
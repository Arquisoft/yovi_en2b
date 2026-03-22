// webapp/src/services/rankingService.ts

import type { RankingEntry, RankingMode } from '@/types'

const API_BASE_URL = 'https://api.micrati.com/users/api'

class RankingService {
  private async request<T>(endpoint: string, token: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

export const rankingService = new RankingService()
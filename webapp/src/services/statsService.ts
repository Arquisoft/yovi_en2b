// webapp/src/services/statsService.ts
import type { MatchRecord, StatsData } from '@/types'
import { USERS_API_URL } from '@/config/api'

class StatsService {
  constructor(private readonly baseUrl: string) { }

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

  async getMatchHistory(token: string): Promise<MatchRecord[]> {
    return this.request('/stats/history', token)
  }

  async getWinrate(token: string): Promise<StatsData> {
    return this.request('/stats/winrate', token)
  }
}

export const statsService = new StatsService(USERS_API_URL)

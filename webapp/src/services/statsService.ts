// webapp/src/services/statsService.ts
import type { MatchRecord, StatsData } from '@/types'

//const API_BASE_URL = "http://api.localhost/users/api"
const API_BASE_URL = 'https://api.micrati.com/users/api'

class StatsService {
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

  async getMatchHistory(token: string): Promise<MatchRecord[]> {
    return this.request('/stats/history', token)
  }

  async getWinrate(token: string): Promise<StatsData> {
    return this.request('/stats/winrate', token)
  }
}

export const statsService = new StatsService()

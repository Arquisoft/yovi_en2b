// users/src/services/RankingService.ts

import { GameMode, RankingEntry } from '../types/ranking'
import { AppDataSource } from '../config/database'
import { MatchRecord } from '../entities/MatchRecord'
import { User } from '../entities/User'

export class RankingService {
  /**
   * Returns the top 10 players for a given game mode, ordered by wins descending.
   * Only counts wins (result = 'win') for the specified game_mode.
   */
  static async getRankingByMode(mode: GameMode): Promise<RankingEntry[]> {
    const validModes: GameMode[] = ['pve-easy', 'pve-medium', 'pve-hard']
    if (!validModes.includes(mode)) return []

    const rows: { username: string; wins: string }[] = await AppDataSource
      .getRepository(MatchRecord)
      .createQueryBuilder('m')
      .select('u.username', 'username')
      .addSelect('COUNT(*)', 'wins')
      .innerJoin(User, 'u', 'u.id = m.user_id')
      .where('m.result = :result', { result: 'win' })
      .andWhere('m.game_mode = :mode', { mode })
      .andWhere('u.is_active = :active', { active: true })
      .groupBy('u.username')
      .orderBy('wins', 'DESC')
      .limit(10)
      .getRawMany()

    return rows.map((row, index) => ({
      rank: index + 1,
      username: row.username,
      wins: Number(row.wins),
    }))
  }
}
// users/src/services/RankingService.ts

import { AppDataSource } from '../config/database'
import { MatchRecord } from '../entities/MatchRecord'
import { GameMode, RankingEntry } from '../types/ranking'

const VALID_MODES: Set<GameMode> = new Set(['pve-easy', 'pve-medium', 'pve-hard'])

export class RankingService {
  /**
   * Returns the top 10 players for a given game mode ordered by wins descending.
   * Groups by username and counts wins.
   */
  static async getRankingByMode(mode: GameMode): Promise<RankingEntry[]> {
    if (!VALID_MODES.has(mode)) return []

    const repo = AppDataSource.getRepository(MatchRecord)

    const rows: { username: string; wins: string }[] = await repo
      .createQueryBuilder('m')
      .select('u.username', 'username')
      .addSelect('COUNT(*)', 'wins')
      .innerJoin('m.user', 'u')
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
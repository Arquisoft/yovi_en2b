// users/src/services/StatsService.ts
import { AppDataSource } from '../config/database'
import { MatchRecord as MatchRecordEntity } from '../entities/MatchRecord'

const repo = () => AppDataSource.getRepository(MatchRecordEntity)

export class StatsService {
  /**
   * Returns the full match history for a user, ordered by date descending.
   */
  static async getMatchHistory(userId: number) {
    return repo().find({
      where: { userId },
      order: { playedAt: 'DESC' },
    })
  }

  /**
   * Returns overall and recent (last 20) winrate for a user.
   */
  static async getWinrate(userId: number) {
    const toWinrate = async (qb: any) => {
      const rows = await qb.getRawMany()
      const wins = Number(rows.find((r: any) => r.result === 'win')?.count ?? 0)
      const losses = Number(rows.find((r: any) => r.result === 'loss')?.count ?? 0)
      return { wins, losses, total: wins + losses }
    }

    const base = () =>
      repo()
        .createQueryBuilder('m')
        .select('m.result', 'result')
        .addSelect('COUNT(*)', 'count')
        .where('m.user_id = :userId', { userId })
        .groupBy('m.result')

    const recentSubquery = repo()
      .createQueryBuilder('m')
      .select('m.result', 'result')
      .addSelect('COUNT(*)', 'count')
      .innerJoin(
        (qb) =>
          qb
            .select('sub.id', 'id')
            .from(MatchRecordEntity, 'sub')
            .where('sub.user_id = :userId', { userId })
            .orderBy('sub.played_at', 'DESC')
            .limit(20),
        'recent',
        'recent.id = m.id'
      )
      .groupBy('m.result')

    return {
      overall: await toWinrate(base()),
      recent: await toWinrate(recentSubquery),
    }
  }

  static async saveMatchRecord(data: {
    userId: number
    opponentName: string
    result: 'win' | 'loss'
    durationSeconds: number
    gameMode?: string | null
  }) {
    const record = repo().create(data)
    return repo().save(record)
  }
}
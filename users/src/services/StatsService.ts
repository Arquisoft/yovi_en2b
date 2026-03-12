// users/src/services/StatsService.ts
import { MatchRecord, StatsData } from '../types/stats';

// TODO (DB): importar AppDataSource y la entidad MatchRecord cuando esté lista
// import { AppDataSource } from '../config/database';
// import { MatchRecord as MatchRecordEntity } from '../entities/MatchRecord';

export class StatsService {
  /**
   * Returns the full match history for a user.
   * TODO (DB): replace mock with a real query, e.g.:
   *   const repo = AppDataSource.getRepository(MatchRecordEntity);
   *   return repo.find({ where: { userId }, order: { playedAt: 'DESC' } });
   */
  static async getMatchHistory(userId: number): Promise<MatchRecord[]> {
    // MOCK — remove when DB is ready
    return [
      {
        id: '1',
        opponentName: 'Bot (medium)',
        result: 'win',
        durationSeconds: 142,
        playedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      },
      {
        id: '2',
        opponentName: 'PlayerTwo',
        result: 'loss',
        durationSeconds: 87,
        playedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: '3',
        opponentName: 'Bot (hard)',
        result: 'win',
        durationSeconds: 210,
        playedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      },
    ];
  }

  /**
   * Returns overall and recent (last 20) winrate for a user.
   * TODO (DB): replace mock with real aggregation queries, e.g.:
   *   SELECT
   *     COUNT(*) FILTER (WHERE result = 'win') AS wins,
   *     COUNT(*) FILTER (WHERE result = 'loss') AS losses
   *   FROM match_records WHERE user_id = $userId;
   *
   *   For recent: add ORDER BY played_at DESC LIMIT 20 as a subquery.
   */
  static async getWinrate(userId: number): Promise<StatsData> {
    // MOCK — remove when DB is ready
    return {
      overall: { wins: 8, losses: 4 },
      recent: { wins: 3, losses: 2 },
    };
  }
}

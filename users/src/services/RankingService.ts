// users/src/services/RankingService.ts

import { GameMode, RankingEntry } from '../types/ranking'

// TODO (DB): importar AppDataSource y la entidad MatchRecord cuando esté lista
// import { AppDataSource } from '../config/database';
// import { MatchRecord } from '../entities/MatchRecord';

export class RankingService {
  /**
   * Returns the top players for a given game mode, ordered by wins descending.
   * TODO (DB): replace mock with a real query, e.g.:
   *   const repo = AppDataSource.getRepository(MatchRecord);
   *   return repo
   *     .createQueryBuilder('m')
   *     .select('u.username', 'username')
   *     .addSelect('COUNT(*)', 'wins')
   *     .innerJoin('m.user', 'u')
   *     .where('m.result = :result', { result: 'win' })
   *     .andWhere('m.gameMode = :mode', { mode })
   *     .groupBy('u.username')
   *     .orderBy('wins', 'DESC')
   *     .limit(10)
   *     .getRawMany();
   */
  static async getRankingByMode(mode: GameMode): Promise<RankingEntry[]> {
    // Helper to avoid repeating the object structure keys

    const createMock = (data: [string, number][]): RankingEntry[] => 
      data.map(([username, wins], index) => ({ rank: index + 1, username, wins }));

    const mockData: Record<GameMode, RankingEntry[]> = {
      'pve-easy': createMock([['PlayerOne', 42], ['PlayerTwo', 38], ['PlayerThree', 31], ['PlayerFour', 27], ['PlayerFive', 19]]),
      'pve-medium': createMock([['PlayerTwo', 29], ['PlayerOne', 24], ['PlayerFive', 18], ['PlayerThree', 12], ['PlayerFour', 9]]),
      'pve-hard': createMock([['PlayerFive', 11], ['PlayerTwo', 8], ['PlayerOne', 5], ['PlayerFour', 3], ['PlayerThree', 1]])
    };

    return mockData[mode] ?? [];
  }
}
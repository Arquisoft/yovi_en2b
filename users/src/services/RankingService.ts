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
    // MOCK — remove when DB is ready
    const mockData: Record<GameMode, RankingEntry[]> = {
      'pve-easy': [
        { rank: 1, username: 'PlayerOne',   wins: 42 },
        { rank: 2, username: 'PlayerTwo',   wins: 38 },
        { rank: 3, username: 'PlayerThree', wins: 31 },
        { rank: 4, username: 'PlayerFour',  wins: 27 },
        { rank: 5, username: 'PlayerFive',  wins: 19 },
      ],
      'pve-medium': [
        { rank: 1, username: 'PlayerTwo',   wins: 29 },
        { rank: 2, username: 'PlayerOne',   wins: 24 },
        { rank: 3, username: 'PlayerFive',  wins: 18 },
        { rank: 4, username: 'PlayerThree', wins: 12 },
        { rank: 5, username: 'PlayerFour',  wins: 9  },
      ],
      'pve-hard': [
        { rank: 1, username: 'PlayerFive',  wins: 11 },
        { rank: 2, username: 'PlayerTwo',   wins: 8  },
        { rank: 3, username: 'PlayerOne',   wins: 5  },
        { rank: 4, username: 'PlayerFour',  wins: 3  },
        { rank: 5, username: 'PlayerThree', wins: 1  },
      ],
    }

    return mockData[mode] ?? []
  }
}
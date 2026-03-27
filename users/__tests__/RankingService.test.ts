
// users/__tests__/RankingService.test.ts
import { RankingService } from '../src/services/RankingService';
import { GameMode, RankingEntry } from '../src/types/ranking';
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('RankingService', () => {

  describe('getRankingByMode', () => {

    it('should return ranking for pve-easy mode', async () => {
      const result = await RankingService.getRankingByMode('pve-easy');

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerOne', wins: 42 });
      expect(result[1]).toEqual({ rank: 2, username: 'PlayerTwo', wins: 38 });
    });

    it('should return ranking for pve-medium mode', async () => {
      const result = await RankingService.getRankingByMode('pve-medium');

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerTwo', wins: 29 });
      expect(result[1]).toEqual({ rank: 2, username: 'PlayerOne', wins: 24 });
    });

    it('should return ranking for pve-hard mode', async () => {
      const result = await RankingService.getRankingByMode('pve-hard');

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({ rank: 1, username: 'PlayerFive', wins: 11 });
      expect(result[1]).toEqual({ rank: 2, username: 'PlayerTwo', wins: 8 });
    });

    it('should assign correct rank values starting from 1', async () => {
      const modes: GameMode[] = ['pve-easy', 'pve-medium', 'pve-hard'];

      for (const mode of modes) {
        const result = await RankingService.getRankingByMode(mode);
        result.forEach((entry, index) => {
          expect(entry.rank).toBe(index + 1);
        });
      }
    });

    it('should return entries ordered by wins descending', async () => {
      const modes: GameMode[] = ['pve-easy', 'pve-medium', 'pve-hard'];

      for (const mode of modes) {
        const result = await RankingService.getRankingByMode(mode);
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].wins).toBeGreaterThanOrEqual(result[i + 1].wins);
        }
      }
    });

    it('should return empty array for unknown game mode', async () => {
      const result = await RankingService.getRankingByMode('unknown' as GameMode);
      expect(result).toEqual([]);
    });

    it('should return entries with the correct shape', async () => {
      const result = await RankingService.getRankingByMode('pve-easy');

      result.forEach(entry => {
        expect(entry).toHaveProperty('rank');
        expect(entry).toHaveProperty('username');
        expect(entry).toHaveProperty('wins');
        expect(typeof entry.rank).toBe('number');
        expect(typeof entry.username).toBe('string');
        expect(typeof entry.wins).toBe('number');
      });
    });
  });
});
// users/src/types/stats.ts
export interface MatchRecord {
  id: string;
  opponentName: string;
  result: 'win' | 'loss';
  durationSeconds: number;
  playedAt: string; // ISO string
}

export interface WinrateStat {
  wins: number;
  losses: number;
}

export interface StatsData {
  overall: WinrateStat;
  recent: WinrateStat;  // last 20 games
}

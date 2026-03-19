// webapp/src/types/stats.ts
// Añadir al final de webapp/src/types/index.ts (o importar desde aquí)
export interface MatchRecord {
  id: string
  opponentName: string
  result: 'win' | 'loss'
  durationSeconds: number
  playedAt: string
}

export interface WinrateStat {
  wins: number
  losses: number
}

export interface StatsData {
  overall: WinrateStat
  recent: WinrateStat
}

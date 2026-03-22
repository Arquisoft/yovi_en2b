// webapp/src/types/ranking.ts
// Añadir al final de webapp/src/types/index.ts

export type RankingMode = 'pve-easy' | 'pve-medium' | 'pve-hard'

export interface RankingEntry {
  rank: number
  username: string
  wins: number
}
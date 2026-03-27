// users/src/types/ranking.ts

export type GameMode = 'pve-easy' | 'pve-medium' | 'pve-hard'

export interface RankingEntry {
  rank: number
  username: string
  wins: number
}

export interface RankingByMode {
  mode: GameMode
  entries: RankingEntry[]
}
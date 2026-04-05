import type { GameInfo } from '@/types'

/**
 * Available games in the platform
 */
export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: 'game-y',
    name: 'Game Y',
    description:
      'A strategic connection game played on a triangular hexagonal board.',
    thumbnail: '/images/game-y-thumbnail-v1.png',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: true,
  },
  {
    id: 'other-game1',
    name: 'Other Game 1',
    description:
      'A mock game with just to fill the grid display',
    thumbnail: '/other-game-thumbnail.svg',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: false,
  },
  {
    id: 'other-game2',
    name: 'Other Game 2',
    description:
      'A mock game with just to fill the grid display',
    thumbnail: '/other-game-thumbnail.svg',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: false,
  },
]

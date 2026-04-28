import type { GameInfo } from '@/types'

/**
 * Available games in the platform.
 * `name` and `description` are i18n keys resolved via t() at the consumption point.
 */
export const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: 'game-y',
    name: 'variants.game-y.name',
    description: 'variants.game-y.description',
    thumbnail: '/images/game-y-thumbnail-v1.png',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: true,
  },
  {
    id: 'game-why-not',
    name: 'variants.game-why-not.name',
    description: 'variants.game-why-not.description',
    thumbnail: '/images/game-y-thumbnail-v1.png',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: true,
  },
  {
    id: 'other-game1',
    name: 'variants.other-game1.name',
    description: 'variants.other-game1.description',
    thumbnail: '/other-game-thumbnail.svg',
    minPlayers: 1,
    maxPlayers: 2,
    isAvailable: false,
  },
]

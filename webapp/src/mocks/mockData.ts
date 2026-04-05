import type {
  GameInfo,
  GameState,
  ChatMessage,
  BoardSize,
  GameConfig,
  Player,
} from '@/types'
import { createEmptyBoard } from '@/utils/gameY'
import { generateId } from '@/utils'

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

/**
 * Create a mock game state
 */
export function createMockGameState(
  config: GameConfig,
  player1: Player,
  player2: Player
): GameState {
  const now = new Date().toISOString()

  return {
    id: generateId(),
    config,
    status: 'playing',
    board: createEmptyBoard(config.boardSize),
    players: {
      player1,
      player2,
    },
    currentTurn: 'player1',
    moves: [],
    winner: null,
    timer: config.timerEnabled && config.timerSeconds
      ? {
        player1RemainingMs: config.timerSeconds * 1000,
        player2RemainingMs: config.timerSeconds * 1000,
        activePlayer: 'player1',
        lastSyncTimestamp: Date.now(),
      }
      : null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Create mock chat messages
 */
export function createMockChatMessages(gameId: string): ChatMessage[] {
  return [
    {
      id: 'msg-1',
      gameId,
      senderId: 'system',
      senderName: 'System',
      content: 'Game started. Good luck!',
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
  ]
}

/**
 * Bot move calculation (simple random for now)
 */
export function calculateBotMove(
  board: import('@/types').BoardCell[][],
  size: BoardSize
): { row: number; col: number } | null {
  const emptyCells: { row: number; col: number }[] = []

  for (let row = 0; row < size; row++) {
    for (let col = 0; col <= row; col++) {
      if (board[row][col].owner === null) {
        emptyCells.push({ row, col })
      }
    }
  }

  if (emptyCells.length === 0) return null

  return emptyCells[Math.floor(Math.random() * emptyCells.length)]
}

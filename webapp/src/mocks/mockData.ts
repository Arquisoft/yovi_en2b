import type {
  GameInfo,
  GameState,
  RoomSummary,
  Room,
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
    thumbnail: '/game-y-thumbnail.svg',
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
 * Mock room data for lobby
 */
export const MOCK_ROOMS: RoomSummary[] = [
  {
    id: 'room-1',
    name: 'Casual Match',
    host: { id: 'user-1', username: 'StrategyMaster' },
    boardSize: 9,
    timerSeconds: 600,
    isPrivate: false,
    playerCount: 1,
    maxPlayers: 2,
    status: 'waiting',
    createdAt: new Date(Date.now() - 120000).toISOString(),
  },
  {
    id: 'room-2',
    name: 'Quick Game',
    host: { id: 'user-2', username: 'HexChampion' },
    boardSize: 7,
    timerSeconds: 300,
    isPrivate: false,
    playerCount: 1,
    maxPlayers: 2,
    status: 'waiting',
    createdAt: new Date(Date.now() - 60000).toISOString(),
  },
  {
    id: 'room-3',
    name: 'Pro Match',
    host: { id: 'user-3', username: 'YoviPro' },
    boardSize: 12,
    timerSeconds: 900,
    isPrivate: false,
    playerCount: 2,
    maxPlayers: 2,
    status: 'playing',
    createdAt: new Date(Date.now() - 300000).toISOString(),
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
 * Create a mock room
 */
export function createMockRoom(
  config: GameConfig,
  host: Player
): Room {
  return {
    id: generateId(),
    name: config.roomName || 'Game Room',
    host: { id: host.id, username: host.name },
    boardSize: config.boardSize,
    timerSeconds: config.timerSeconds,
    isPrivate: config.isPrivate || false,
    playerCount: 1,
    maxPlayers: 2,
    status: 'waiting',
    createdAt: new Date().toISOString(),
    players: [host],
    inviteCode: config.isPrivate ? generateInviteCode() : undefined,
  }
}

/**
 * Generate a random invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
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

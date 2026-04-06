import type {
  GameInfo,
  GameState,
  GameConfig,
  ChatMessage,
  PlayerColor,
} from '@/types'
import { AVAILABLE_GAMES } from '@/mocks/mockData'
import { generateId } from '@/utils'

const GAME_API_BASE = 'http://api.localhost/game/api'

class GameService {
  private baseUrl: string
  private chatMessages = new Map<string, ChatMessage[]>()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async getAvailableGames(): Promise<GameInfo[]> {
    return AVAILABLE_GAMES
  }

  async createGame(config: GameConfig, token?: string, guestId?: string): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/games`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ config, ...(guestId ? { guestId } : {}) }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to create game' }))
      throw new Error(err.error || `Failed to create game: ${response.status}`)
    }
    return response.json()
  }

  async getGameState(gameId: string): Promise<GameState | null> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Failed to get game state: ${response.status}`)
    return response.json()
  }

  async playMove(
    gameId: string,
    row: number,
    col: number,
    player: PlayerColor,
    token?: string,
  ): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ row, col, player }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to play move' }))
      throw new Error(err.error || `Failed to play move: ${response.status}`)
    }
    return response.json()
  }

  async surrender(gameId: string, player: PlayerColor, token?: string): Promise<GameState> {
    const response = await fetch(`${this.baseUrl}/games/${gameId}/surrender`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ player }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to surrender' }))
      throw new Error(err.error || `Failed to surrender: ${response.status}`)
    }
    return response.json()
  }

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(gameId) ?? []
  }

  async sendChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    content: string,
  ): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: generateId(),
      gameId,
      senderId,
      senderName,
      content,
      timestamp: new Date().toISOString(),
    }
    const messages = this.chatMessages.get(gameId) ?? []
    messages.push(message)
    this.chatMessages.set(gameId, messages)
    return message
  }
}

export const gameService = new GameService(GAME_API_BASE)

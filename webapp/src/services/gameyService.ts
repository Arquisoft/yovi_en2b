import type {
  GameInfo,
  GameState,
  GameConfig,
  RoomSummary,
  Room,
  ChatMessage,
  Move,
  Player,
  PlayerColor,
} from '@/types'
import {
  AVAILABLE_GAMES,
  MOCK_ROOMS,
  createMockGameState,
  createMockRoom,
  createMockChatMessages,
} from '@/mocks/mockData'
import { delay, generateId } from '@/utils'
import { applyMove, checkWinner, getOppositePlayer, isValidMove } from '@/utils/gameY'
import { boardToYEN, coordsToRowCol } from '@/utils/yen'

const API_BASE_URL = 'http://api.localhost/gamey/v1'
// const API_BASE_URL = 'https://api.micrati.com/gamey/v1'

const BOT_MOVE_TIMEOUT_MS = 30_000
const BOT_POLL_INTERVAL_MS = 50

class GameService {
  private baseUrl: string
  private games = new Map<string, GameState>()
  private rooms = new Map<string, Room>()
  private chatMessages = new Map<string, ChatMessage[]>()
  private mockRooms: RoomSummary[] = [...MOCK_ROOMS]

  private gameTokens = new Map<string, string>()

  private humanPlayerColors = new Map<string, PlayerColor>()

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async getAvailableGames(): Promise<GameInfo[]> {
    await delay(200)
    return AVAILABLE_GAMES
  }

  async createGame(config: GameConfig, currentUser: Player): Promise<GameState> {
    await delay(300)

    const [player1, player2] = this.buildPlayers(config, currentUser)
    const game = createMockGameState(config, player1, player2)

    this.games.set(game.id, game)
    this.chatMessages.set(game.id, createMockChatMessages(game.id))

    if (config.mode === 'pve') {
      const humanColor: PlayerColor = player1.isBot ? 'player2' : 'player1'
      this.humanPlayerColors.set(game.id, humanColor)
    }

    if (this.isBotTurn(game)) {
      this.executeBotMove(game.id)
    }

    this.startTimerCheck(game.id)
    return game
  }

  private startTimerCheck(gameId: string): void {
    const interval = setInterval(() => {
      const game = this.games.get(gameId)

      if (!game || game.status !== 'playing' || !game.timer) {
        clearInterval(interval)
        return
      }

      const now = Date.now()
      const elapsed = now - game.timer.lastSyncTimestamp
      const active = game.timer.activePlayer

      if (!active) {
        clearInterval(interval)
        return
      }

      const remaining = active === 'player1'
        ? game.timer.player1RemainingMs - elapsed
        : game.timer.player2RemainingMs - elapsed

      if (remaining <= 0) {
        const winner = active === 'player1' ? 'player2' : 'player1'
        const finished: GameState = {
          ...game,
          status: 'finished',
          winner,
          timer: { ...game.timer, activePlayer: null },
          updatedAt: new Date().toISOString(),
        }
        this.games.set(gameId, finished)
        clearInterval(interval)

         const token = this.gameTokens.get(gameId)
        if (token) {
          this.saveMatchRecord(finished, token)
        }
      }
    }, 500)
  }

  /**
   * Get current game state
   */
  async getGameState(gameId: string): Promise<GameState | null> {
    return this.games.get(gameId) ?? null
  }

  async playMove(
    gameId: string,
    row: number,
    col: number,
    player: PlayerColor,
    token?: string,
  ): Promise<GameState> {
    const game = this.games.get(gameId)
    if (!game) throw new Error('Game not found')
    if (game.status !== 'playing') throw new Error('Game is not active')
    if (game.currentTurn !== player) throw new Error('Not your turn')
    if (!isValidMove(game.board, row, col)) throw new Error('Invalid move')

    // Persist the token so executeBotMove can use it later
    if (token) {
      this.gameTokens.set(gameId, token)
    }

    const now = Date.now()
    const updatedTimer = this.computeUpdatedTimer(game, player, now)
    const move: Move = { row, col, player, timestamp: now }
    const newBoard = applyMove(game.board, move)
    const winner = checkWinner(newBoard, game.config.boardSize) ?? this.timedOutPlayer(updatedTimer)
    const nextTurn = getOppositePlayer(player)

    const updatedGame: GameState = {
      ...game,
      board: newBoard,
      moves: [...game.moves, move],
      currentTurn: nextTurn,
      winner,
      status: winner ? 'finished' : 'playing',
      timer: updatedTimer
        ? { ...updatedTimer, activePlayer: winner ? null : nextTurn, lastSyncTimestamp: now }
        : null,
      updatedAt: new Date().toISOString(),
    }

    this.games.set(gameId, updatedGame)

    if (!winner && updatedGame.config.mode === 'pve' && this.isBotTurn(updatedGame)) {
      this.executeBotMove(gameId)
    }

    if (updatedGame.status === 'finished') {
      const effectiveToken = token ?? this.gameTokens.get(gameId)
      if (effectiveToken) {
        await this.saveMatchRecord(updatedGame, effectiveToken)
      }
    }

    return updatedGame
  }

  async waitForBotMove(gameId: string, afterMovesCount: number): Promise<GameState | null> {
    const deadline = Date.now() + BOT_MOVE_TIMEOUT_MS

    while (Date.now() < deadline) {
      const game = this.games.get(gameId)
      if (!game) return null
      if (game.moves.length > afterMovesCount || game.status === 'finished') return game
      await new Promise((resolve) => setTimeout(resolve, BOT_POLL_INTERVAL_MS))
    }

    return this.games.get(gameId) ?? null
  }

  async surrender(gameId: string, player: PlayerColor, token?: string): Promise<GameState> {
    await delay(100)

    const game = this.games.get(gameId)
    if (!game) throw new Error('Game not found')

    const updatedGame: GameState = {
      ...game,
      status: 'finished',
      winner: getOppositePlayer(player),
      timer: game.timer ? { ...game.timer, activePlayer: null } : null,
      updatedAt: new Date().toISOString(),
    }

    this.games.set(gameId, updatedGame)

    if (token) await this.saveMatchRecord(updatedGame, token)

    return updatedGame
  }

  async getRooms(): Promise<RoomSummary[]> {
    await delay(200)

    const createdRooms: RoomSummary[] = Array.from(this.rooms.values())
      .filter((r) => !r.isPrivate)
      .map(({ id, name, host, boardSize, timerSeconds, isPrivate, playerCount, maxPlayers, status, createdAt }) => ({
        id, name, host, boardSize, timerSeconds, isPrivate, playerCount, maxPlayers, status, createdAt,
      }))

    return [...createdRooms, ...this.mockRooms]
  }

  async getRoom(roomId: string): Promise<Room | null> {
    await delay(100)
    return this.rooms.get(roomId) ?? null
  }

  async createRoom(config: GameConfig, host: Player): Promise<Room> {
    await delay(300)
    const room = createMockRoom(config, host)
    this.rooms.set(room.id, room)
    return room
  }

  async joinRoom(roomId: string, player: Player): Promise<Room> {
    await delay(200)

    const room = this.rooms.get(roomId)
    if (!room) throw new Error('Room not found')
    if (room.playerCount >= room.maxPlayers) throw new Error('Room is full')

    const updatedRoom: Room = {
      ...room,
      playerCount: room.playerCount + 1,
      players: [...room.players, { ...player, color: 'player2' }],
      status: room.playerCount + 1 >= room.maxPlayers ? 'playing' : 'waiting',
    }

    this.rooms.set(roomId, updatedRoom)
    return updatedRoom
  }

  async startGameFromRoom(roomId: string): Promise<GameState> {
    await delay(200)

    const room = this.rooms.get(roomId)
    if (!room) throw new Error('Room not found')
    if (room.players.length < 2) throw new Error('Not enough players')

    const config: GameConfig = {
      mode: 'pvp-online',
      boardSize: room.boardSize,
      timerEnabled: !!room.timerSeconds,
      timerSeconds: room.timerSeconds,
      roomName: room.name,
      isPrivate: room.isPrivate,
    }

    const game = createMockGameState(config, room.players[0], room.players[1])
    this.games.set(game.id, game)
    this.chatMessages.set(game.id, createMockChatMessages(game.id))
    this.rooms.set(roomId, { ...room, status: 'playing' })

    this.startTimerCheck(game.id)
    return game
  }

  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    await delay(100)
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

  private buildPlayers(config: GameConfig, currentUser: Player): [Player, Player] {
    const botName = `Bot (${config.botLevel ?? 'medium'})`

    if (config.mode === 'pve') {
      const bot: Player = { id: 'bot', name: botName, color: 'player1', isBot: true }
      if (config.playerColor === 'player2') {
        return [{ ...bot, color: 'player1' }, { ...currentUser, color: 'player2' }]
      }
      return [{ ...currentUser, color: 'player1' }, { ...bot, color: 'player2' }]
    }

    if (config.mode === 'pvp-local') {
      return [
        { id: 'local-p1', name: 'Player 1', color: 'player1', isLocal: true },
        { id: 'local-p2', name: 'Player 2', color: 'player2', isLocal: true },
      ]
    }

    return [
      { ...currentUser, color: 'player1' },
      { id: 'waiting', name: 'Waiting...', color: 'player2' },
    ]
  }

  private isBotTurn(game: GameState): boolean {
    const player = game.currentTurn === 'player1' ? game.players.player1 : game.players.player2
    return player.isBot === true
  }

  private computeUpdatedTimer(game: GameState, player: PlayerColor, now: number) {
    if (!game.timer) return null

    const timer = { ...game.timer }
    if (timer.activePlayer !== player) return timer

    const elapsed = now - timer.lastSyncTimestamp
    if (player === 'player1') {
      timer.player1RemainingMs = Math.max(0, timer.player1RemainingMs - elapsed)
    } else {
      //NOSONAR
      timer.player2RemainingMs = Math.max(0, timer.player2RemainingMs - elapsed)
    }

    return timer
  }

  private timedOutPlayer(timer: ReturnType<typeof this.computeUpdatedTimer>): PlayerColor | null {
    if (!timer) return null
    if (timer.player1RemainingMs === 0) return 'player2'
    if (timer.player2RemainingMs === 0) return 'player1'
    return null
  }

  private async executeBotMove(gameId: string): Promise<void> {
    const game = this.games.get(gameId)
    if (!game || game.status !== 'playing') return

    const botOpensGame = game.moves.length === 0 && this.isBotTurn(game)
    if (botOpensGame) await delay(250)

    // Retrieve the stored token so the finishing bot move can save the record
    const token = this.gameTokens.get(gameId)

    try {
      const yen = boardToYEN(game.board, game.config.boardSize, game.currentTurn)
      const response = await fetch(`${this.baseUrl}/ybot/choose/minimax_bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(yen),
      })

      if (!response.ok) throw new Error(`Bot API error: ${response.status}`)

      const data: { coords: { x: number; y: number; z: number } } = await response.json()
      const { row, col } = coordsToRowCol(data.coords, game.config.boardSize)

      await this.playMove(gameId, row, col, game.currentTurn, token)
    } catch (e) {
      console.error('Bot move failed:', e)
    }
  }

  private async saveMatchRecord(game: GameState, token: string): Promise<void> {
    if (!game.winner) return

    const durationSeconds = Math.floor(
      (new Date(game.updatedAt).getTime() - new Date(game.createdAt).getTime()) / 1000,
    )

    // Determine which player is the human and which is the opponent.
    // For pve we stored this when the game was created; fall back to player1 for pvp modes.
    const humanColor = this.humanPlayerColors.get(game.id) ?? 'player1'
    const opponentPlayer = humanColor === 'player1' ? game.players.player2 : game.players.player1
    const result: 'win' | 'loss' = game.winner === humanColor ? 'win' : 'loss'

    try {
      await fetch('http://api.localhost/users/api/stats/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          opponentName: opponentPlayer.name,
          result,
          durationSeconds,
        }),
      })
    } catch (e) {
      console.error('Failed to save match record:', e)
    }
  }
}

export const gameService = new GameService(API_BASE_URL)
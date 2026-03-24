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
  //calculateBotMove,
} from '@/mocks/mockData'
import { delay, generateId } from '@/utils'
import { applyMove, checkWinner, getOppositePlayer, isValidMove } from '@/utils/gameY'
import { boardToYEN, coordsToRowCol } from '@/utils/yen'

const API_BASE_URL = "http://api.localhost/gamey/v1";
// const API_BASE_URL =  "https://api.micrati.com/gamey/v1";

/**
 * Mock game service
 * Simulates API calls with async behavior
 * Ready to be replaced with real API calls later
 */
class GameService {
  private baseUrl: string
  private games: Map<string, GameState> = new Map()
  private rooms: Map<string, Room> = new Map()
  private chatMessages: Map<string, ChatMessage[]> = new Map()
  private mockRooms: RoomSummary[] = [...MOCK_ROOMS]

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  /**
   * Get list of available games
   */
  async getAvailableGames(): Promise<GameInfo[]> {
    await delay(200)
    return AVAILABLE_GAMES
  }

  /**
   * Create a new game
   */
  async createGame(config: GameConfig, currentUser: Player): Promise<GameState> {
    await delay(300)

    let player1: Player
    let player2: Player

    if (config.mode === 'pve') {
      if (config.playerColor === 'player2') {
        player1 = {
          id: 'bot',
          name: `Bot (${config.botLevel || 'medium'})`,
          color: 'player1',
          isBot: true,
        }
        player2 = { ...currentUser, color: 'player2' }
      } else {
        player1 = { ...currentUser, color: 'player1' }
        player2 = {
          id: 'bot',
          name: `Bot (${config.botLevel || 'medium'})`,
          color: 'player2',
          isBot: true,
        }
      }
    } else if (config.mode === 'pvp-local') {
      player1 = {
        id: 'local-p1',
        name: 'Player 1',
        color: 'player1',
        isLocal: true,
      }
      player2 = {
        id: 'local-p2',
        name: 'Player 2',
        color: 'player2',
        isLocal: true,
      }
    } else {
      // PvP online - will be handled through room system
      player1 = { ...currentUser, color: 'player1' }
      player2 = {
        id: 'waiting',
        name: 'Waiting...',
        color: 'player2',
      }
    }

    const game = createMockGameState(config, player1, player2)
    this.games.set(game.id, game)
    this.chatMessages.set(game.id, createMockChatMessages(game.id))

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
    }
  }, 500)
  }



  /**
   * Get current game state
   */
  async getGameState(gameId: string): Promise<GameState | null> {
    //await delay(100)
    return this.games.get(gameId) || null
  }

  /**
   * Play a move
   */
  async playMove(
    gameId: string,
    row: number,
    col: number,
    player: PlayerColor,
    token?: string
  ): Promise<GameState> {
    const game = this.games.get(gameId)
    if (!game) throw new Error('Game not found')
    if (game.status !== 'playing') throw new Error('Game is not active')
    if (game.currentTurn !== player) throw new Error('Not your turn')
    if (!isValidMove(game.board, row, col)) throw new Error('Invalid move')

    const now = Date.now()

    // Descuenta el tiempo real transcurrido desde la última jugada
    // lastSyncTimestamp marca cuándo empezó a correr el turno del jugador activo
    let updatedTimer = game.timer ? { ...game.timer } : null
    if (updatedTimer && updatedTimer.activePlayer === player) {
      const elapsed = now - updatedTimer.lastSyncTimestamp

      if (player === 'player1') {
        updatedTimer.player1RemainingMs = Math.max(0, updatedTimer.player1RemainingMs - elapsed)
      } else {
        updatedTimer.player2RemainingMs = Math.max(0, updatedTimer.player2RemainingMs - elapsed)
      }
    }

    const move: Move = {
      row,
      col,
      player,
      timestamp: now,
    }

    const newBoard = applyMove(game.board, move)
    const winner = checkWinner(newBoard, game.config.boardSize)

    // Comprobar si algún jugador se ha quedado sin tiempo
    const outOfTime =
      updatedTimer?.player1RemainingMs === 0
        ? 'player2'  // player1 se quedó sin tiempo → gana player2
        : updatedTimer?.player2RemainingMs === 0
          ? 'player1'
          : null

    const finalWinner = winner ?? outOfTime ?? null

    const updatedGame: GameState = {
      ...game,
      board: newBoard,
      moves: [...game.moves, move],
      currentTurn: getOppositePlayer(player),
      winner: finalWinner,
      status: finalWinner ? 'finished' : 'playing',
      timer: updatedTimer
        ? {
          ...updatedTimer,
          activePlayer: finalWinner ? null : getOppositePlayer(player),
          lastSyncTimestamp: now,  // <-- resetea el reloj para el siguiente turno
        }
        : null,
      updatedAt: new Date().toISOString(),
    }

    this.games.set(gameId, updatedGame)

    if (
      !finalWinner &&
      updatedGame.config.mode === 'pve' &&
      this.isBotTurn(updatedGame)
    ) {
      this.scheduleBotMove(gameId)
    }

    if (updatedGame.status === 'finished' && token) {
      await this.saveMatchRecord(updatedGame, token);
    }

    return updatedGame
  }


  /**
   * Check if it's the bot's turn
   */
  private isBotTurn(game: GameState): boolean {
    const currentPlayer = game.currentTurn === 'player1'
      ? game.players.player1
      : game.players.player2
    return currentPlayer.isBot === true
  }

  // /**
  //  * Schedule a bot move after a delay
  //  */
  // private scheduleBotMove(gameId: string): void {
  //   setTimeout(async () => {
  //     const game = this.games.get(gameId)
  //     if (!game || game.status !== 'playing') return

  //     const botMove = calculateBotMove(game.board, game.config.boardSize)
  //     if (botMove) {
  //       await this.playMove(gameId, botMove.row, botMove.col, game.currentTurn)
  //     }
  //   }, 100 + Math.random() * 1000) // Random delay
  // }

  // En GameService
  private scheduleBotMove(gameId: string): void {
    setTimeout(async () => {
      const game = this.games.get(gameId)
      if (!game || game.status !== 'playing') return

      try {
        const yen = boardToYEN(game.board, game.config.boardSize, game.currentTurn)

        const response = await fetch(`${this.baseUrl}${'/ybot/choose/minimax_bot'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(yen),
        })

        if (!response.ok) throw new Error(`Bot API error: ${response.status}`)

        const data: { coords: { x: number; y: number; z: number } } = await response.json()
        const { row, col } = coordsToRowCol(data.coords, game.config.boardSize)

        await this.playMove(gameId, row, col, game.currentTurn)

      } catch (e) {
        console.error('Bot move failed:', e)
      }
    })
  }

  /**
   * Surrender the game
   */
  async surrender(gameId: string, player: PlayerColor, token?:string): Promise<GameState> {
    await delay(100)

    const game = this.games.get(gameId)
    if (!game) throw new Error('Game not found')

    const winner = getOppositePlayer(player)

    const updatedGame: GameState = {
      ...game,
      status: 'finished',
      winner,
      timer: game.timer
        ? { ...game.timer, activePlayer: null }
        : null,
      updatedAt: new Date().toISOString(),
    }

    this.games.set(gameId, updatedGame)

    if (token) {
    await this.saveMatchRecord(updatedGame, token);
  }
    return updatedGame
  }

  /**
   * Get list of public rooms
   */
  async getRooms(): Promise<RoomSummary[]> {
    await delay(200)

    // Combine mock rooms with created rooms
    const createdRooms: RoomSummary[] = Array.from(this.rooms.values())
      .filter((r) => !r.isPrivate)
      .map((r) => ({
        id: r.id,
        name: r.name,
        host: r.host,
        boardSize: r.boardSize,
        timerSeconds: r.timerSeconds,
        isPrivate: r.isPrivate,
        playerCount: r.playerCount,
        maxPlayers: r.maxPlayers,
        status: r.status,
        createdAt: r.createdAt,
      }))

    return [...createdRooms, ...this.mockRooms]
  }

  /**
   * Get a specific room
   */
  async getRoom(roomId: string): Promise<Room | null> {
    await delay(100)
    return this.rooms.get(roomId) || null
  }

  /**
   * Create a new room
   */
  async createRoom(config: GameConfig, host: Player): Promise<Room> {
    await delay(300)

    const room = createMockRoom(config, host)
    this.rooms.set(room.id, room)
    return room
  }

  /**
   * Join a room
   */
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

  /**
   * Start game from room
   */
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

    const game = createMockGameState(
      config,
      room.players[0],
      room.players[1]
    )

    this.games.set(game.id, game)
    this.chatMessages.set(game.id, createMockChatMessages(game.id))

    // Update room status
    this.rooms.set(roomId, { ...room, status: 'playing' })

    this.startTimerCheck(game.id)
    return game
  }

  private async saveMatchRecord(game: GameState, token: string): Promise<void> {
      if (!game.winner) return;

      // Determinar si el jugador autenticado ganó o perdió
      // Asumimos que el usuario autenticado siempre es player1 en PvE
      const result = game.winner === 'player1' ? 'win' : 'loss';
      const opponent = game.players.player2;
      const durationSeconds = Math.floor(
        (new Date(game.updatedAt).getTime() - new Date(game.createdAt).getTime()) / 1000
      );

      try {
       await fetch(`http://api.localhost/users/api/stats/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            opponentName: opponent.name,
            result,
            durationSeconds,
          }),
        });

        

      } catch (e) {
        console.error('Failed to save match record:', e);
      }
  }

  /**
   * Get chat messages for a game
   */
  async getChatMessages(gameId: string): Promise<ChatMessage[]> {
    await delay(100)
    return this.chatMessages.get(gameId) || []
  }

  /**
   * Send a chat message
   */
  async sendChatMessage(
    gameId: string,
    senderId: string,
    senderName: string,
    content: string
  ): Promise<ChatMessage> {
    //await delay(100)

    const message: ChatMessage = {
      id: generateId(),
      gameId,
      senderId,
      senderName,
      content,
      timestamp: new Date().toISOString(),
    }

    const messages = this.chatMessages.get(gameId) || []
    messages.push(message)
    this.chatMessages.set(gameId, messages)

    return message
  }
}

export const gameService = new GameService(API_BASE_URL)

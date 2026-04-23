import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Server } from 'http'
import jwt from 'jsonwebtoken'
import { MatchmakingService } from './MatchmakingService'
import type { ClientMessage, ConnectedClient, ServerMessage } from './types'
import { GameService } from '../services/GameService'

const JWT_SECRET = process.env.JWT_SECRET || 'please_dont_tell_anyone'
const USERS_PUBLIC_URL = process.env.USERS_PUBLIC_URL || 'http://localhost:3000'

/** Grace period after disconnect before the game is abandoned (ms) */
const DISCONNECT_GRACE_MS = 30_000

/**
 * WebSocketManager is the central hub for all real-time online multiplayer
 * communication.  It:
 *  - Attaches a ws.Server to the existing HTTP server
 *  - Handles authentication (JWT), matchmaking, move relay, and surrender
 *  - Broadcasts game-state updates to the opponent after each move/surrender
 *  - Implements a 30-second reconnect grace period on disconnect
 */
export class WebSocketManager {
  private readonly wss: WebSocketServer
  private readonly clients = new Map<number, ConnectedClient>()
  private readonly matchmaking = new MatchmakingService()
  private readonly gameService: GameService

  constructor(server: Server, gameService?: GameService) {
    this.gameService = gameService ?? new GameService()
    this.wss = new WebSocketServer({ server, path: '/ws' })

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req)
    })
  }

  // ── Connection lifecycle ───────────────────────────────────────────────────

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    let authenticatedUserId: number | null = null

    ws.on('message', async (raw: Buffer) => {
      try {
        const message: ClientMessage = JSON.parse(raw.toString())

        if (message.type === 'auth') {
          authenticatedUserId = await this.handleAuth(ws, message.token)
          return
        }

        if (authenticatedUserId === null) {
          this.sendTo(ws, { type: 'error', code: 'NOT_AUTHENTICATED', message: 'Send auth first' })
          return
        }

        await this.handleMessage(authenticatedUserId, message)
      } catch {
        this.sendTo(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Invalid JSON' })
      }
    })

    ws.on('close', () => {
      if (authenticatedUserId !== null) {
        this.handleDisconnect(authenticatedUserId)
      }
    })

    ws.on('error', () => {
      if (authenticatedUserId !== null) {
        this.handleDisconnect(authenticatedUserId)
      }
    })
  }

  // ── Authentication ─────────────────────────────────────────────────────────

  private async handleAuth(ws: WebSocket, token: string): Promise<number | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string }

      // If the player is reconnecting during a grace period, restore the client
      const existing = this.clients.get(decoded.id)
      if (existing?.disconnectedAt !== undefined) {
        existing.ws = ws
        existing.disconnectedAt = undefined
        existing.token = token

        // Notify the opponent that the player is back
        if (existing.currentGameId) {
          this.broadcastToOpponent(decoded.id, { type: 'opponent_reconnected' })
        }

        this.sendTo(ws, { type: 'authenticated', userId: decoded.id, username: decoded.username })
        return decoded.id
      }

      const client: ConnectedClient = {
        ws,
        userId: decoded.id,
        username: decoded.username,
        token,
        inQueue: false,
      }
      this.clients.set(decoded.id, client)

      this.sendTo(ws, { type: 'authenticated', userId: decoded.id, username: decoded.username })
      return decoded.id
    } catch {
      this.sendTo(ws, { type: 'error', code: 'AUTH_FAILED', message: 'Invalid or expired token' })
      return null
    }
  }

  // ── Message dispatch ───────────────────────────────────────────────────────

  /** Exposed for testing — callers can drive the handler without a real socket */
  async handleMessage(userId: number, message: ClientMessage): Promise<void> {
    const client = this.clients.get(userId)
    if (!client) return

    switch (message.type) {
      case 'ping':
        this.sendTo(client.ws, { type: 'pong' })
        break

      case 'join_game':
        // Restaurar currentGameId cuando el cliente navega a la página del juego
        client.currentGameId = message.gameId
        break
    
      case 'leave_game':
        if (client.currentGameId === message.gameId) {
          client.currentGameId = undefined
        }
        break

      case 'join_queue':
        await this.handleJoinQueue(client)
        break

      case 'leave_queue':
        this.handleLeaveQueue(client)
        break

      case 'move':
        await this.handleMove(client, message.gameId, message.row, message.col)
        break

      case 'surrender':
        await this.handleSurrender(client, message.gameId)
        break

      default:
        this.sendTo(client.ws, { type: 'error', code: 'UNKNOWN_MESSAGE', message: 'Unknown message type' })
    }
  }

  // ── Queue ──────────────────────────────────────────────────────────────────

  private async handleJoinQueue(client: ConnectedClient): Promise<void> {
    if (client.inQueue) return
    if (client.currentGameId) {
      this.sendTo(client.ws, { type: 'error', code: 'IN_GAME', message: 'Finish your current game first' })
      return
    }

    this.matchmaking.join({
      userId: client.userId,
      username: client.username,
      token: client.token,
      joinedAt: Date.now(),
    })
    client.inQueue = true

    this.sendTo(client.ws, { type: 'queue_joined', queueSize: this.matchmaking.size() })

    // Try to pair this player with another waiter
    await this.tryMatch()
  }

  private handleLeaveQueue(client: ConnectedClient): void {
    if (!client.inQueue) return
    this.matchmaking.leave(client.userId)
    client.inQueue = false
    this.sendTo(client.ws, { type: 'queue_left' })
  }

  private async tryMatch(): Promise<void> {
    const pair = this.matchmaking.tryMatch()
    if (!pair) return

    const [entry1, entry2] = pair
    const client1 = this.clients.get(entry1.userId)
    const client2 = this.clients.get(entry2.userId)

    if (!client1 || !client2) {
      // One player disconnected before matching — re-queue the surviving one
      if (client1) this.matchmaking.join(entry1)
      if (client2) this.matchmaking.join(entry2)
      return
    }

    client1.inQueue = false
    client2.inQueue = false

    try {
      const config = {
        mode: 'pvp-online' as const,
        boardSize: 11 as const,
        timerEnabled: true,
        timerSeconds: 600,
      }
      const game = await this.gameService.createGame(
        config,
        entry1.userId,
        entry1.username,
        entry1.token,
      )

      // Persist both player IDs on the game
      await this.gameService.setPlayer2Id(game.id, entry2.userId, entry2.username)

      client1.currentGameId = game.id
      client2.currentGameId = game.id

      this.sendTo(client1.ws, {
        type: 'matched',
        gameId: game.id,
        opponentName: entry2.username,
        playerColor: 'player1',
        opponentId: entry2.userId,
      })
      this.sendTo(client2.ws, {
        type: 'matched',
        gameId: game.id,
        opponentName: entry1.username,
        playerColor: 'player2',
        opponentId: entry1.userId,
      })
    } catch (err) {
      console.error('Failed to create online game:', err)
      // Return both players to the queue
      this.matchmaking.join(entry1)
      this.matchmaking.join(entry2)
      if (client1) this.sendTo(client1.ws, { type: 'error', code: 'MATCH_FAILED', message: 'Could not create game, retrying' })
      if (client2) this.sendTo(client2.ws, { type: 'error', code: 'MATCH_FAILED', message: 'Could not create game, retrying' })
    }
  }

  // ── Game events ────────────────────────────────────────────────────────────

  private async handleMove(
  client: ConnectedClient,
  gameId: string,
  row: number,
  col: number,
  ): Promise<void> {
    if (client.currentGameId !== gameId) {
      this.sendTo(client.ws, { type: 'error', code: 'WRONG_GAME', message: 'Not your current game' })
      return
    }

    try {
      const playerColor = await this.getPlayerColor(client.userId, gameId)
      const game = await this.gameService.playMove(gameId, row, col, playerColor, client.token)

      this.sendToUser(client.userId, { type: 'game_update', game })
      this.broadcastToOpponent(client.userId, { type: 'game_update', game })

      if (game.status === 'finished') {
        this.clearGame(client.userId)
      }
    } catch (err: any) {
      this.sendTo(client.ws, { type: 'error', code: 'MOVE_FAILED', message: err.message ?? 'Move failed' })
    }
  }

  private async handleSurrender(client: ConnectedClient, gameId: string): Promise<void> {
    if (client.currentGameId !== gameId) {
      this.sendTo(client.ws, { type: 'error', code: 'WRONG_GAME', message: 'Not your current game' })
      return
    }

    try {
      const playerColor = await this.getPlayerColor(client.userId, gameId)
      const game = await this.gameService.surrender(gameId, playerColor, client.token)

      this.sendToUser(client.userId, { type: 'game_update', game })
      this.broadcastToOpponent(client.userId, { type: 'game_update', game })
      this.clearGame(client.userId)
    } catch (err: any) {
      this.sendTo(client.ws, { type: 'error', code: 'SURRENDER_FAILED', message: err.message ?? 'Surrender failed' })
    }
  }

  // ── Disconnect / reconnect ─────────────────────────────────────────────────

  private handleDisconnect(userId: number): void {
    const client = this.clients.get(userId)
    if (!client) return

    if (client.inQueue) {
      this.matchmaking.leave(userId)
      client.inQueue = false
    }

    if (client.currentGameId) {
      client.disconnectedAt = Date.now()
      this.broadcastToOpponent(userId, { type: 'opponent_disconnected', gracePeriodMs: DISCONNECT_GRACE_MS })

      // After grace period, abandon the game if the player hasn't reconnected
      setTimeout(async () => {
        const c = this.clients.get(userId)
        if (!c?.disconnectedAt) return // reconnected, do nothing

        if (c.currentGameId) {
          try {
            const playerColor = await this.getPlayerColor(userId, c.currentGameId)
            const game = await this.gameService.surrender(c.currentGameId, playerColor, undefined)
            this.broadcastToOpponent(userId, { type: 'game_update', game })
          } catch { /* ignore */ }
        }
        this.clients.delete(userId)
      }, DISCONNECT_GRACE_MS)
    } else {
      this.clients.delete(userId)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private clearGame(userId: number): void {
    const client = this.clients.get(userId)
    if (!client?.currentGameId) return

    const gameId = client.currentGameId

    // Limpiar a todos los clientes que estén en esta partida
    for (const [, c] of this.clients) {
      if (c.currentGameId === gameId) {
        c.currentGameId = undefined
      }
    }
  }

  private broadcastToOpponent(userId: number, message: ServerMessage): void {
    const client = this.clients.get(userId)
    if (!client?.currentGameId) return

    for (const [id, c] of this.clients) {
      if (id !== userId && c.currentGameId === client.currentGameId) {
        this.sendTo(c.ws, message)
        return
      }
    }
  }

  private isOpponent(userId: number, otherId: number): boolean {
    const c1 = this.clients.get(userId)
    const c2 = this.clients.get(otherId)
    return !!(c1?.currentGameId && c1.currentGameId === c2?.currentGameId)
  }

  private sendToUser(userId: number, message: ServerMessage): void {
    const client = this.clients.get(userId)
    if (client) this.sendTo(client.ws, message)
  }

  private sendTo(ws: { readyState: number; send: (data: string) => void }, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  private async getPlayerColor(userId: number, gameId: string): Promise<'player1' | 'player2'> {
    const state = await this.gameService.getGame(gameId)
    if (!state) throw new Error('Game not found')
    if (String(state.players.player1.id) === String(userId)) return 'player1'
    return 'player2'
  }

  // ── Public accessors (used in tests) ──────────────────────────────────────

  getClient(userId: number): ConnectedClient | undefined {
    return this.clients.get(userId)
  }

  getConnectedCount(): number {
    return this.clients.size
  }

  getQueueSize(): number {
    return this.matchmaking.size()
  }

  /** Inject a pre-built client (used in unit tests without a real socket) */
  _injectClient(client: ConnectedClient): void {
    this.clients.set(client.userId, client)
  }

  close(): void {
    this.wss.close()
  }
}

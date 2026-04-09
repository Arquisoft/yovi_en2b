import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Game } from '../entities/Game';
import { GameMove } from '../entities/GameMove';
import {
  createEmptyBoard,
  applyMove,
  checkWinner,
  isValidMove,
  getOppositePlayer,
} from '../utils/gameY';
import { getBotMove, getBotPieOpening, getBotPieDecision } from './BotService';
import type {
  GameConfig,
  GameState,
  PieDecision,
  Player,
  PlayerColor,
  TimerState,
  Move,
  BotLevel,
} from '../types/game';

const USERS_PUBLIC_URL = process.env.USERS_PUBLIC_URL || 'http://localhost:3000';

export class GameService {
  private gameRepo: Repository<Game>;
  private moveRepo: Repository<GameMove>;

  constructor() {
    this.gameRepo = AppDataSource.getRepository(Game);
    this.moveRepo = AppDataSource.getRepository(GameMove);
  }

  async createGame(config: GameConfig, userId: number | null, username: string, token?: string, guestId?: string): Promise<GameState> {
    const [player1, player2] = this.buildPlayers(config, userId, username, guestId);
    const board = createEmptyBoard(config.boardSize);
    const timerState = config.timerEnabled && config.timerSeconds
      ? this.buildTimerState(config.timerSeconds)
      : null;

    const game = this.gameRepo.create({
      player1Id: userId,
      config,
      status: 'playing',
      phase: 'playing',
      boardState: board,
      players: { player1, player2 },
      currentTurn: 'player1',
      winner: null,
      timerState,
    });
    await this.gameRepo.save(game);

    // If bot goes first (PvE with bot as player1)
    if (config.mode === 'pve' && player1.isBot) {
      return this.applyBotMove(game, [], config.botLevel ?? 'medium', token);
    }

    return this.toGameState(game, []);
  }

  async getGame(gameId: string): Promise<GameState | null> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) return null;
    const moves = await this.moveRepo.find({
      where: { game: { id: gameId } },
      order: { playedAt: 'ASC' },
    });
    return this.toGameState(game, moves);
  }

  async playMove(
    gameId: string,
    row: number,
    col: number,
    player: PlayerColor,
    token?: string
  ): Promise<GameState> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    this.assertPlayMoveValid(game, row, col, player);

    const moves = await this.moveRepo.find({
      where: { game: { id: gameId } },
      order: { playedAt: 'ASC' },
    });

    const now = Date.now();
    const updatedTimer = this.computeUpdatedTimer(game.timerState, player, now);
    const timedOutWinner = this.timedOutWinner(updatedTimer);

    const moveRecord = this.moveRepo.create({
      game,
      playerColor: player,
      rowIndex: row,
      colIndex: col,
      moveTimestamp: now,
    });
    await this.moveRepo.save(moveRecord);

    const moveObj: Move = { row, col, player, timestamp: now };
    const newBoard = applyMove(game.boardState, moveObj);
    const boardWinner = checkWinner(newBoard, game.config.boardSize);
    const winner = boardWinner ?? timedOutWinner;
    const nextTurn = getOppositePlayer(player);

    game.boardState = newBoard;
    game.currentTurn = nextTurn;
    game.winner = winner;
    game.status = winner ? 'finished' : 'playing';
    game.timerState = this.computePostMoveTimer(updatedTimer, winner, nextTurn, now);

    // Enter pie-decision phase after the first move when Pie Rule is enabled.
    // The timer is paused (activePlayer set to null) during the decision.
    const allMoves = [...moves, moveRecord];
    const isPieDecisionTrigger =
      !winner &&
      game.config.pieRule === true &&
      allMoves.length === 1; // only one move has been played

    if (isPieDecisionTrigger) {
      game.phase = 'pie-decision';
      if (game.timerState) {
        game.timerState = { ...game.timerState, activePlayer: null };
      }
      await this.gameRepo.save(game);

      // If the deciding player (P2) is a bot, resolve the pie decision
      // automatically in the same request so the human never waits.
      const botPlayer = this.getPveBot(game);
      if (botPlayer?.color === nextTurn) {
        const decision = await getBotPieDecision(
          game.boardState,
          game.config.boardSize,
          nextTurn,
          game.config.botLevel ?? 'medium',
        );
        return this.decidePie(gameId, decision, token);
      }

      return this.toGameState(game, allMoves);
    }

    await this.gameRepo.save(game);

    if (game.status === 'finished' && token) {
      await this.recordMatch(game, token).catch((e) =>
        console.error('Failed to record match:', e)
      );
    }

    const botPlayer = this.getPveBot(game);
    if (!winner && botPlayer?.color === nextTurn) {
      return this.applyBotMove(game, allMoves, game.config.botLevel ?? 'medium', token);
    }

    return this.toGameState(game, allMoves);
  }

  async surrender(gameId: string, player: PlayerColor, token?: string): Promise<GameState> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    if (game.status !== 'playing') throw Object.assign(new Error('Game is not active'), { status: 409 });

    const winner = getOppositePlayer(player);
    game.status = 'finished';
    game.winner = winner;
    game.timerState = game.timerState
      ? { ...game.timerState, activePlayer: null }
      : null;
    await this.gameRepo.save(game);

    const moves = await this.moveRepo.find({
      where: { game: { id: gameId } },
      order: { playedAt: 'ASC' },
    });

    if (token) {
      await this.recordMatch(game, token).catch((e) =>
        console.error('Failed to record match:', e)
      );
    }

    return this.toGameState(game, moves);
  }

  // --- Private helpers ---

  private assertPlayMoveValid(game: Game | null, row: number, col: number, player: PlayerColor): asserts game is Game {
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    if (game.status !== 'playing') throw Object.assign(new Error('Game is not active'), { status: 409 });
    if ((game.phase ?? 'playing') === 'pie-decision') throw Object.assign(new Error('Waiting for Pie Rule decision'), { status: 409 });
    if (game.currentTurn !== player) throw Object.assign(new Error('Not your turn'), { status: 409 });
    if (!isValidMove(game.boardState, row, col)) throw Object.assign(new Error('Invalid move'), { status: 409 });
  }

  private computePostMoveTimer(timer: TimerState | null, winner: PlayerColor | null, nextTurn: PlayerColor, now: number): TimerState | null {
    if (!timer) return null;
    return { ...timer, activePlayer: winner ? null : nextTurn, lastSyncTimestamp: now };
  }

  private getPveBot(game: Game): Player | undefined {
    if (game.config.mode !== 'pve') return undefined;
    return game.players.player1.isBot ? game.players.player1 : game.players.player2;
  }

  private async applyBotMove(
    game: Game,
    existingMoves: GameMove[],
    botLevel: BotLevel,
    token?: string
  ): Promise<GameState> {
    try {
      const usePieOpening =
        game.config.pieRule === true && existingMoves.length === 0;
      const { row, col } = usePieOpening
        ? await getBotPieOpening(
          game.boardState,
          game.config.boardSize,
          game.currentTurn,
          botLevel
        )
        : await getBotMove(
          game.boardState,
          game.config.boardSize,
          game.currentTurn,
          botLevel
        );

      if (!isValidMove(game.boardState, row, col)) {
        console.error('Bot returned invalid move, skipping');
        return this.toGameState(game, existingMoves);
      }

      const now = Date.now();
      const updatedTimer = this.computeUpdatedTimer(game.timerState, game.currentTurn, now);
      const timedOutWinner = this.timedOutWinner(updatedTimer);

      const moveRecord = this.moveRepo.create({
        game,
        playerColor: game.currentTurn,
        rowIndex: row,
        colIndex: col,
        moveTimestamp: now,
      });
      await this.moveRepo.save(moveRecord);

      const moveObj: Move = { row, col, player: game.currentTurn, timestamp: now };
      const newBoard = applyMove(game.boardState, moveObj);
      const boardWinner = checkWinner(newBoard, game.config.boardSize);
      const winner = boardWinner ?? timedOutWinner;
      const nextTurn = getOppositePlayer(game.currentTurn);

      game.boardState = newBoard;
      game.currentTurn = nextTurn;
      game.winner = winner;
      game.status = winner ? 'finished' : 'playing';
      game.timerState = updatedTimer
        ? { ...updatedTimer, activePlayer: winner ? null : nextTurn, lastSyncTimestamp: now }
        : null;

      const allMoves = [...existingMoves, moveRecord];

      // If this bot move is the very first move and pie rule is on, enter pie-decision.
      const isPieDecisionTrigger =
        !winner &&
        game.config.pieRule === true &&
        allMoves.length === 1;

      if (isPieDecisionTrigger) {
        game.phase = 'pie-decision';
        if (game.timerState) {
          game.timerState = { ...game.timerState, activePlayer: null };
        }
        await this.gameRepo.save(game);
        return this.toGameState(game, allMoves);
      }

      await this.gameRepo.save(game);

      if (game.status === 'finished' && token) {
        await this.recordMatch(game, token).catch((e) =>
          console.error('Failed to record match:', e)
        );
      }

      return this.toGameState(game, allMoves);
    } catch (e) {
      console.error('Bot move failed:', e);
      return this.toGameState(game, existingMoves);
    }
  }

  private buildPlayers(config: GameConfig, userId: number | null, username: string, guestId?: string): [Player, Player] {
    const botName = `Bot (${config.botLevel ?? 'medium'})`;
    const humanId = guestId ?? (userId !== null ? String(userId) : 'guest');

    if (config.mode === 'pve') {
      const bot: Player = { id: 'bot', name: botName, color: 'player1', isBot: true };
      if (config.playerColor === 'player2') {
        return [
          { ...bot, color: 'player1' },
          { id: humanId, name: username, color: 'player2' },
        ];
      }
      return [
        { id: humanId, name: username, color: 'player1' },
        { ...bot, color: 'player2' },
      ];
    }

    if (config.mode === 'pvp-local') {
      return [
        { id: 'local-p1', name: 'Player 1', color: 'player1', isLocal: true },
        { id: 'local-p2', name: 'Player 2', color: 'player2', isLocal: true },
      ];
    }

    return [
      { id: humanId, name: username, color: 'player1' },
      { id: 'waiting', name: 'Waiting...', color: 'player2' },
    ];
  }

  private buildTimerState(timerSeconds: number): TimerState {
    const ms = timerSeconds * 1000;
    return {
      player1RemainingMs: ms,
      player2RemainingMs: ms,
      activePlayer: 'player1',
      lastSyncTimestamp: Date.now(),
    };
  }

  private computeUpdatedTimer(
    timer: TimerState | null,
    player: PlayerColor,
    now: number
  ): TimerState | null {
    if (!timer) return null;
    const updated = { ...timer };
    if (updated.activePlayer !== player) return updated;
    const elapsed = now - updated.lastSyncTimestamp;
    if (player === 'player1') {
      updated.player1RemainingMs = Math.max(0, updated.player1RemainingMs - elapsed);
    } else {
      updated.player2RemainingMs = Math.max(0, updated.player2RemainingMs - elapsed);
    }
    return updated;
  }

  private timedOutWinner(timer: TimerState | null): PlayerColor | null {
    if (!timer) return null;
    if (timer.player1RemainingMs === 0) return 'player2';
    if (timer.player2RemainingMs === 0) return 'player1';
    return null;
  }

  private async recordMatch(game: Game, token: string): Promise<void> {
    if (!game.winner) return;

    const humanPlayer =
      game.players.player1.isBot ? game.players.player2 : game.players.player1;

    if (humanPlayer.isLocal) return; // pvp-local: no record

    const opponentPlayer =
      game.players.player1.id === humanPlayer.id
        ? game.players.player2
        : game.players.player1;

    const result = game.winner === humanPlayer.color ? 'win' : 'loss';
    const durationSeconds = Math.floor(
      (game.updatedAt.getTime() - game.createdAt.getTime()) / 1000
    );

    await fetch(`${USERS_PUBLIC_URL}/api/stats/record`, {
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
    });
  }

  async decidePie(gameId: string, decision: PieDecision, token?: string): Promise<GameState> {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) throw Object.assign(new Error('Game not found'), { status: 404 });
    if ((game.phase ?? 'playing') !== 'pie-decision') {
      throw Object.assign(new Error('Game is not in Pie Rule decision phase'), { status: 409 });
    }

    const moves = await this.moveRepo.find({
      where: { game: { id: gameId } },
      order: { playedAt: 'ASC' },
    });

    if (decision === 'swap') {
      // The first stone changes colour: player1 (Blue) → player2 (Red).
      // Player identities and colours do NOT change; only the stone ownership flips.
      // After the swap player1 (Blue) plays next — they get to respond to losing their stone.
      const firstMove = moves[0];
      game.boardState = game.boardState.map(row =>
        row.map(cell =>
          cell.row === firstMove.rowIndex && cell.col === firstMove.colIndex
            ? { ...cell, owner: 'player2' }
            : cell
        )
      );
      game.currentTurn = 'player1';
    }
    // keep: currentTurn is already 'player2' (set after the first move), nothing to change.

    game.phase = 'playing';
    // Resume timer pointing at whoever plays next.
    if (game.timerState) {
      game.timerState = {
        ...game.timerState,
        activePlayer: game.currentTurn,
        lastSyncTimestamp: Date.now(),
      };
    }
    await this.gameRepo.save(game);

    // In PvE, after a swap the bot may now be the current player.
    const botPlayer = this.getPveBot(game);
    if (botPlayer?.color === game.currentTurn) {
      return this.applyBotMove(game, moves, game.config.botLevel ?? 'medium', token);
    }

    return this.toGameState(game, moves);
  }

  private toGameState(game: Game, moves: GameMove[]): GameState {
    return {
      id: game.id,
      config: game.config,
      status: game.status,
      phase: game.phase ?? 'playing',
      board: game.boardState,
      players: game.players,
      currentTurn: game.currentTurn,
      moves: moves.map((m) => ({
        row: m.rowIndex,
        col: m.colIndex,
        player: m.playerColor,
        timestamp: Number(m.moveTimestamp),
      })),
      winner: game.winner,
      timer: game.timerState,
      createdAt: game.createdAt.toISOString(),
      updatedAt: game.updatedAt.toISOString(),
    };
  }
}

import type { BoardCell, BoardSize, BotLevel, PieDecision, PlayerColor } from '../types/game';
import {
  createEmptyBoard,
  getNeighbors as getYNeighbors,
  checkWinner as checkYWinner,
  applyMove as applyYMove,
  isValidMove as isYValidMove,
} from '../utils/gameY';
import { boardToYEN, coordsToRowCol } from '../utils/yen';
import type { GameRules } from './GameRules';

// EASY shares `random_bot` with the Y variant — uniform random play is
// independent of the win condition, so duplicating it for misère would add
// no value. MEDIUM and HARD route to misère-aware minimax bots.
const BOT_IDS: Record<BotLevel, string> = {
  easy: 'random_bot',
  medium: 'whynot_fast_bot',
  hard: 'whynot_smart_bot',
};

export class WhyNotGameRules implements GameRules {
  readonly variant = 'why-not' as const;
  readonly supportsPieRule = true;

  createBoard(size: number): BoardCell[][] {
    return createEmptyBoard(size as BoardSize);
  }

  isValidMove(board: BoardCell[][], row: number, col: number): boolean {
    return isYValidMove(board, row, col);
  }

  applyMove(board: BoardCell[][], row: number, col: number, player: PlayerColor): BoardCell[][] {
    return applyYMove(board, { row, col, player, timestamp: 0 });
  }

  getNeighbors(row: number, col: number, size: number): Array<{ row: number; col: number }> {
    return getYNeighbors(row, col, size as BoardSize);
  }

  checkWinner(board: BoardCell[][], size: number): PlayerColor | null {
    const yWinner = checkYWinner(board, size as BoardSize);
    if (yWinner === null) return null;
    // In WhY Not?, connecting all 3 sides is a loss → return the opponent
    return yWinner === 'player1' ? 'player2' : 'player1';
  }

  botMoveEndpoint(level: BotLevel): string {
    return `/v1/whynot/choose/${BOT_IDS[level]}`;
  }

  botPieOpeningEndpoint(level: BotLevel): string {
    return `/v1/whynot/pie-opening/${BOT_IDS[level]}`;
  }

  botPieDecideEndpoint(level: BotLevel): string {
    return `/v1/whynot/pie-decide/${BOT_IDS[level]}`;
  }

  serializeBoardForBot(board: BoardCell[][], currentTurn: PlayerColor, size: number): unknown {
    return boardToYEN(board, size, currentTurn);
  }

  deserializeBotMove(response: unknown, boardSize: number): { row: number; col: number } {
    if (
      typeof response !== 'object' ||
      response === null ||
      !('coords' in response)
    ) {
      throw new Error('Bot move response missing "coords" field');
    }
    const { coords } = response as { coords: { x: number; y: number; z: number } };
    return coordsToRowCol(coords, boardSize);
  }

  deserializeBotPieDecision(response: unknown): PieDecision {
    if (
      typeof response !== 'object' ||
      response === null ||
      !('decision' in response)
    ) {
      throw new Error('Bot pie-decision response missing "decision" field');
    }
    const { decision } = response as { decision: string };
    if (decision !== 'keep' && decision !== 'swap') {
      throw new Error(`Invalid pie decision value: "${decision}"`);
    }
    return decision;
  }
}

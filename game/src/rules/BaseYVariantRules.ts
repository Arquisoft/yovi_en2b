import type { BoardCell, BoardSize, BotLevel, GameVariant, PieDecision, PlayerColor } from '../types/game';
import {
  createEmptyBoard,
  getNeighbors as getYNeighbors,
  applyMove as applyYMove,
  isValidMove as isYValidMove,
} from '../utils/gameY';
import { boardToYEN, coordsToRowCol } from '../utils/yen';
import type { GameRules } from './GameRules';

export abstract class BaseYVariantRules implements GameRules {
  abstract readonly variant: GameVariant;
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

  abstract checkWinner(board: BoardCell[][], size: number): PlayerColor | null;

  abstract botMoveEndpoint(level: BotLevel): string;
  abstract botPieOpeningEndpoint(level: BotLevel): string;
  abstract botPieDecideEndpoint(level: BotLevel): string;

  serializeBoardForBot(board: BoardCell[][], currentTurn: PlayerColor, size: number): unknown {
    return boardToYEN(board, size, currentTurn);
  }

  deserializeBotMove(response: unknown, boardSize: number): { row: number; col: number } {
    if (typeof response !== 'object' || response === null || !('coords' in response)) {
      throw new Error('Bot move response missing "coords" field');
    }
    const { coords } = response as { coords: { x: number; y: number; z: number } };
    return coordsToRowCol(coords, boardSize);
  }

  deserializeBotPieDecision(response: unknown): PieDecision {
    if (typeof response !== 'object' || response === null || !('decision' in response)) {
      throw new Error('Bot pie-decision response missing "decision" field');
    }
    const { decision } = response as { decision: string };
    if (decision !== 'keep' && decision !== 'swap') {
      throw new Error(`Invalid pie decision value: "${decision}"`);
    }
    return decision;
  }
}

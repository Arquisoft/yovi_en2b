import { boardToYEN, coordsToRowCol } from '../utils/yen';
import type { BoardCell, BoardSize, BotLevel, PieDecision, PlayerColor } from '../types/game';

const RUST_INTERNAL_URL = process.env.RUST_INTERNAL_URL || 'http://localhost:4000';

function botIdFromLevel(level: BotLevel): string {
  if (level === 'hard') return 'smart_bot';
  if (level === 'medium') return 'fast_bot';
  return 'random_bot';
}

export async function getBotMove(
  board: BoardCell[][],
  boardSize: BoardSize,
  currentTurn: PlayerColor,
  botLevel: BotLevel
): Promise<{ row: number; col: number }> {
  const yen = boardToYEN(board, boardSize, currentTurn);
  const botId = botIdFromLevel(botLevel);

  const response = await fetch(`${RUST_INTERNAL_URL}/v1/ybot/choose/${botId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(yen),
  });

  if (!response.ok) {
    throw new Error(`Bot API error: ${response.status}`);
  }

  const data = await response.json() as { coords: { x: number; y: number; z: number } };
  return coordsToRowCol(data.coords, boardSize);
}

/**
 * Asks the Rust bot engine for a pie-rule-aware opening move.
 *
 * When the bot goes first and pie rule is on, it should pick a balanced
 * opening (not the strongest cell) to avoid being swapped. This calls
 * `choose_pie_opening()` on the Rust side instead of `choose_move()`.
 */
export async function getBotPieOpening(
  board: BoardCell[][],
  boardSize: BoardSize,
  currentTurn: PlayerColor,
  botLevel: BotLevel
): Promise<{ row: number; col: number }> {
  const yen = boardToYEN(board, boardSize, currentTurn);
  const botId = botIdFromLevel(botLevel);

  const response = await fetch(`${RUST_INTERNAL_URL}/v1/ybot/pie-opening/${botId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(yen),
  });

  if (!response.ok) {
    throw new Error(`Bot pie-opening API error: ${response.status}`);
  }

  const data = await response.json() as { coords: { x: number; y: number; z: number } };
  return coordsToRowCol(data.coords, boardSize);
}

/**
 * Asks the Rust bot engine whether to keep or swap under the Pie Rule.
 *
 * The board should contain exactly one stone (placed by the opponent) and
 * `currentTurn` must indicate the bot (the deciding side).
 */
export async function getBotPieDecision(
  board: BoardCell[][],
  boardSize: BoardSize,
  currentTurn: PlayerColor,
  botLevel: BotLevel
): Promise<PieDecision> {
  const yen = boardToYEN(board, boardSize, currentTurn);
  const botId = botIdFromLevel(botLevel);

  const response = await fetch(`${RUST_INTERNAL_URL}/v1/ybot/pie-decide/${botId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(yen),
  });

  if (!response.ok) {
    throw new Error(`Bot pie-decide API error: ${response.status}`);
  }

  const data = await response.json() as { decision: 'keep' | 'swap' };
  return data.decision as PieDecision;
}

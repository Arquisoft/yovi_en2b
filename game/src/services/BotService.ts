import type { BoardCell, BotLevel, PieDecision, PlayerColor } from '../types/game';
import type { GameRules } from '../rules/GameRules';

const RUST_INTERNAL_URL = process.env.RUST_INTERNAL_URL || 'http://localhost:4000';

async function postToEngine(endpoint: string, body: unknown): Promise<unknown> {
  const response = await fetch(`${RUST_INTERNAL_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Bot engine error on ${endpoint}: HTTP ${response.status}`);
  }

  return response.json();
}

export async function getBotMove(
  rules: GameRules,
  board: BoardCell[][],
  boardSize: number,
  currentTurn: PlayerColor,
  botLevel: BotLevel,
): Promise<{ row: number; col: number }> {
  const body = rules.serializeBoardForBot(board, currentTurn, boardSize);
  const data = await postToEngine(rules.botMoveEndpoint(botLevel), body);
  return rules.deserializeBotMove(data, boardSize);
}

export async function getBotPieOpening(
  rules: GameRules,
  board: BoardCell[][],
  boardSize: number,
  currentTurn: PlayerColor,
  botLevel: BotLevel,
): Promise<{ row: number; col: number }> {
  const body = rules.serializeBoardForBot(board, currentTurn, boardSize);
  const data = await postToEngine(rules.botPieOpeningEndpoint(botLevel), body);
  return rules.deserializeBotMove(data, boardSize);
}

export async function getBotPieDecision(
  rules: GameRules,
  board: BoardCell[][],
  boardSize: number,
  currentTurn: PlayerColor,
  botLevel: BotLevel,
): Promise<PieDecision> {
  const body = rules.serializeBoardForBot(board, currentTurn, boardSize);
  const data = await postToEngine(rules.botPieDecideEndpoint(botLevel), body);
  return rules.deserializeBotPieDecision(data);
}

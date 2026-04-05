import { boardToYEN, coordsToRowCol } from '../utils/yen';
import type { BoardCell, BoardSize, BotLevel, PlayerColor } from '../types/game';

const RUST_ENGINE_URL = process.env.RUST_ENGINE_URL || 'http://localhost:4000';

function botIdFromLevel(level: BotLevel): string {
  return level === 'hard' ? 'minimax_bot' : 'random_bot';
}

export async function getBotMove(
  board: BoardCell[][],
  boardSize: BoardSize,
  currentTurn: PlayerColor,
  botLevel: BotLevel
): Promise<{ row: number; col: number }> {
  const yen = boardToYEN(board, boardSize, currentTurn);
  const botId = botIdFromLevel(botLevel);

  const response = await fetch(`${RUST_ENGINE_URL}/v1/ybot/choose/${botId}`, {
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

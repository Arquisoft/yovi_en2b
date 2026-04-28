import type { BoardCell, BoardSize, BotLevel, PlayerColor } from '../types/game';
import { checkWinner as checkYWinner } from '../utils/gameY';
import { BaseYVariantRules } from './BaseYVariantRules';

// EASY shares `random_bot` with the Y variant — uniform random play is
// independent of the win condition, so duplicating it for misère adds no value.
const BOT_IDS: Record<BotLevel, string> = {
  easy: 'random_bot',
  medium: 'whynot_fast_bot',
  hard: 'whynot_smart_bot',
};

export class WhyNotGameRules extends BaseYVariantRules {
  readonly variant = 'why-not' as const;

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
}

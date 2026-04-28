import type { BoardCell, BoardSize, BotLevel, PlayerColor } from '../types/game';
import { checkWinner as checkYWinner } from '../utils/gameY';
import { BaseYVariantRules } from './BaseYVariantRules';

const BOT_IDS: Record<BotLevel, string> = {
  easy: 'random_bot',
  medium: 'fast_bot',
  hard: 'smart_bot',
};

export class YGameRules extends BaseYVariantRules {
  readonly variant = 'y' as const;

  checkWinner(board: BoardCell[][], size: number): PlayerColor | null {
    return checkYWinner(board, size as BoardSize);
  }

  botMoveEndpoint(level: BotLevel): string {
    return `/v1/ybot/choose/${BOT_IDS[level]}`;
  }

  botPieOpeningEndpoint(level: BotLevel): string {
    return `/v1/ybot/pie-opening/${BOT_IDS[level]}`;
  }

  botPieDecideEndpoint(level: BotLevel): string {
    return `/v1/ybot/pie-decide/${BOT_IDS[level]}`;
  }
}

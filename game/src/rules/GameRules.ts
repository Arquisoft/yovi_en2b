import type { BoardCell, BotLevel, GameVariant, PieDecision, PlayerColor } from '../types/game';

/**
 * Encapsulates all game-specific logic for a single variant (Y, WhY Not?, Hex, …).
 *
 * GameService and BotService are game-agnostic: they obtain a GameRules instance
 * from the registry and delegate every variant-specific operation here.
 */
export interface GameRules {
  /** Stable identifier matching the GameVariant type. */
  readonly variant: GameVariant;

  /** Whether this variant supports the Pie Rule opening swap. */
  readonly supportsPieRule: boolean;

  // ── Board lifecycle ──────────────────────────────────────────────────────────

  /** Creates a fresh empty board for the given side length. */
  createBoard(size: number): BoardCell[][];

  /** Returns true only when (row, col) names an empty, in-bounds cell. */
  isValidMove(board: BoardCell[][], row: number, col: number): boolean;

  /**
   * Returns a new board (immutable) with `player`'s stone placed at (row, col).
   * The caller is responsible for checking isValidMove first.
   */
  applyMove(board: BoardCell[][], row: number, col: number, player: PlayerColor): BoardCell[][];

  /** Returns the up-to-6 hexagonally adjacent in-bounds cells. */
  getNeighbors(row: number, col: number, size: number): Array<{ row: number; col: number }>;

  // ── Win detection ────────────────────────────────────────────────────────────

  /**
   * Returns the winner if the current board state is terminal, otherwise null.
   * Must be fast enough to call after every move.
   */
  checkWinner(board: BoardCell[][], size: number): PlayerColor | null;

  // ── Bot integration ──────────────────────────────────────────────────────────

  /** Path fragment appended to RUST_INTERNAL_URL for a standard move request. */
  botMoveEndpoint(level: BotLevel): string;

  /** Path fragment for a pie-rule opening move request. */
  botPieOpeningEndpoint(level: BotLevel): string;

  /** Path fragment for a pie-rule keep/swap decision request. */
  botPieDecideEndpoint(level: BotLevel): string;

  /**
   * Serializes the current board state into the format expected by the bot
   * engine for this variant (e.g. YEN for Y / WhY Not?).
   */
  serializeBoardForBot(board: BoardCell[][], currentTurn: PlayerColor, size: number): unknown;

  /**
   * Parses the bot engine's move response and returns row/col coordinates.
   * Throws if the response does not have the expected shape.
   */
  deserializeBotMove(response: unknown, boardSize: number): { row: number; col: number };

  /**
   * Parses the bot engine's pie-decision response.
   * Throws if the response does not have the expected shape or value.
   */
  deserializeBotPieDecision(response: unknown): PieDecision;
}

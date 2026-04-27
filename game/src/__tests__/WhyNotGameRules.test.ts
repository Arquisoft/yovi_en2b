import { describe, it, expect } from 'vitest';
import { WhyNotGameRules } from '../rules/WhyNotGameRules';

describe('WhyNotGameRules', () => {
  const rules = new WhyNotGameRules();

  // ── variant & supportsPieRule ────────────────────────────────────
  describe('metadata', () => {
    it('variant is "why-not"', () => {
      expect(rules.variant).toBe('why-not');
    });

    it('supportsPieRule is true', () => {
      expect(rules.supportsPieRule).toBe(true);
    });
  });

  // ── createBoard ──────────────────────────────────────────────────
  describe('createBoard', () => {
    it('creates a board with the given number of rows', () => {
      expect(rules.createBoard(5)).toHaveLength(5);
    });

    it('row i has exactly i+1 cells (triangular shape)', () => {
      const board = rules.createBoard(5);
      board.forEach((row, i) => {
        expect(row).toHaveLength(i + 1);
      });
    });

    it('all cells start with null owner', () => {
      rules.createBoard(4).flat().forEach(cell => {
        expect(cell.owner).toBeNull();
      });
    });

    it('cell coordinates match their position', () => {
      const board = rules.createBoard(3);
      expect(board[0][0]).toMatchObject({ row: 0, col: 0 });
      expect(board[2][2]).toMatchObject({ row: 2, col: 2 });
    });
  });

  // ── isValidMove ──────────────────────────────────────────────────
  describe('isValidMove', () => {
    it('returns true for an empty cell', () => {
      expect(rules.isValidMove(rules.createBoard(5), 0, 0)).toBe(true);
    });

    it('returns false for an occupied cell', () => {
      const board = rules.applyMove(rules.createBoard(5), 0, 0, 'player1');
      expect(rules.isValidMove(board, 0, 0)).toBe(false);
    });

    it('returns false for a row out of bounds', () => {
      expect(rules.isValidMove(rules.createBoard(5), 5, 0)).toBe(false);
    });

    it('returns false for col > row (violates triangular constraint)', () => {
      expect(rules.isValidMove(rules.createBoard(5), 1, 2)).toBe(false);
    });
  });

  // ── applyMove ────────────────────────────────────────────────────
  describe('applyMove', () => {
    it('places the given player stone on the target cell', () => {
      const newBoard = rules.applyMove(rules.createBoard(5), 2, 1, 'player1');
      expect(newBoard[2][1].owner).toBe('player1');
    });

    it('does not mutate the original board', () => {
      const board = rules.createBoard(5);
      rules.applyMove(board, 0, 0, 'player1');
      expect(board[0][0].owner).toBeNull();
    });
  });

  // ── getNeighbors ─────────────────────────────────────────────────
  describe('getNeighbors', () => {
    it('apex cell (0,0) has 2 neighbors', () => {
      expect(rules.getNeighbors(0, 0, 5)).toHaveLength(2);
    });

    it('an interior cell has 6 neighbors', () => {
      expect(rules.getNeighbors(2, 1, 5)).toHaveLength(6);
    });

    it('all returned neighbors are in-bounds', () => {
      for (const n of rules.getNeighbors(2, 1, 5)) {
        expect(n.row).toBeGreaterThanOrEqual(0);
        expect(n.col).toBeGreaterThanOrEqual(0);
        expect(n.col).toBeLessThanOrEqual(n.row);
      }
    });
  });

  // ── checkWinner — INVERTED: who connects 3 sides LOSES ───────────
  describe('checkWinner', () => {
    it('returns null on an empty board', () => {
      expect(rules.checkWinner(rules.createBoard(4), 4)).toBeNull();
    });

    it('returns player1 when player2 connects all 3 sides (player2 loses)', () => {
      // player2 connects left column apex→bottom (touches all 3 sides)
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 0, 0, 'player2'); // sides 0 and 1
      board = rules.applyMove(board, 1, 0, 'player2'); // side 0
      board = rules.applyMove(board, 2, 0, 'player2'); // side 0
      board = rules.applyMove(board, 3, 0, 'player2'); // sides 0 and 2
      expect(rules.checkWinner(board, 4)).toBe('player1');
    });

    it('returns player2 when player1 connects all 3 sides (player1 loses)', () => {
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 0, 0, 'player1');
      board = rules.applyMove(board, 1, 0, 'player1');
      board = rules.applyMove(board, 2, 0, 'player1');
      board = rules.applyMove(board, 3, 0, 'player1');
      expect(rules.checkWinner(board, 4)).toBe('player2');
    });

    it('returns null when only 2 sides are connected', () => {
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 1, 0, 'player1'); // side 0 only
      board = rules.applyMove(board, 2, 0, 'player1'); // side 0 only
      expect(rules.checkWinner(board, 4)).toBeNull();
    });

    it('does not confuse player stones when only player2 connects all 3 sides', () => {
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 0, 0, 'player2');
      board = rules.applyMove(board, 1, 0, 'player2');
      board = rules.applyMove(board, 2, 0, 'player2');
      board = rules.applyMove(board, 3, 0, 'player2');
      board = rules.applyMove(board, 3, 1, 'player1'); // isolated stone
      expect(rules.checkWinner(board, 4)).toBe('player1');
    });
  });

  // ── bot endpoints ────────────────────────────────────────────────
  describe('botMoveEndpoint', () => {
    // EASY shares the variant-agnostic random_bot with the Y variant.
    it('returns shared random_bot path for easy', () => {
      expect(rules.botMoveEndpoint('easy')).toBe('/v1/whynot/choose/random_bot');
    });

    it('returns whynot fast_bot path for medium', () => {
      expect(rules.botMoveEndpoint('medium')).toBe('/v1/whynot/choose/whynot_fast_bot');
    });

    it('returns whynot smart_bot path for hard', () => {
      expect(rules.botMoveEndpoint('hard')).toBe('/v1/whynot/choose/whynot_smart_bot');
    });
  });

  describe('botPieOpeningEndpoint', () => {
    it('returns correct pie-opening path for each level', () => {
      expect(rules.botPieOpeningEndpoint('easy')).toBe('/v1/whynot/pie-opening/random_bot');
      expect(rules.botPieOpeningEndpoint('medium')).toBe('/v1/whynot/pie-opening/whynot_fast_bot');
      expect(rules.botPieOpeningEndpoint('hard')).toBe('/v1/whynot/pie-opening/whynot_smart_bot');
    });
  });

  describe('botPieDecideEndpoint', () => {
    it('returns correct pie-decide path for each level', () => {
      expect(rules.botPieDecideEndpoint('easy')).toBe('/v1/whynot/pie-decide/random_bot');
      expect(rules.botPieDecideEndpoint('medium')).toBe('/v1/whynot/pie-decide/whynot_fast_bot');
      expect(rules.botPieDecideEndpoint('hard')).toBe('/v1/whynot/pie-decide/whynot_smart_bot');
    });
  });

  // ── serializeBoardForBot ──────────────────────────────────────────
  describe('serializeBoardForBot', () => {
    it('produces an object with the correct board size', () => {
      const yen = rules.serializeBoardForBot(rules.createBoard(5), 'player1', 5) as Record<string, unknown>;
      expect(yen['size']).toBe(5);
    });

    it('encodes player1 stones as B in the layout string', () => {
      let board = rules.createBoard(5);
      board = rules.applyMove(board, 0, 0, 'player1');
      const yen = rules.serializeBoardForBot(board, 'player2', 5) as Record<string, unknown>;
      expect((yen['layout'] as string).startsWith('B')).toBe(true);
    });

    it('encodes player2 stones as R in the layout string', () => {
      let board = rules.createBoard(5);
      board = rules.applyMove(board, 1, 0, 'player2');
      const yen = rules.serializeBoardForBot(board, 'player1', 5) as Record<string, unknown>;
      expect(yen['layout'] as string).toContain('R');
    });

    it('encodes player1 turn as 0', () => {
      const yen = rules.serializeBoardForBot(rules.createBoard(5), 'player1', 5) as Record<string, unknown>;
      expect(yen['turn']).toBe(0);
    });

    it('encodes player2 turn as 1', () => {
      const yen = rules.serializeBoardForBot(rules.createBoard(5), 'player2', 5) as Record<string, unknown>;
      expect(yen['turn']).toBe(1);
    });
  });

  // ── deserializeBotMove ────────────────────────────────────────────
  describe('deserializeBotMove', () => {
    it('converts barycentric coords to row/col correctly', () => {
      expect(rules.deserializeBotMove({ coords: { x: 3, y: 1, z: 0 } }, 5)).toEqual({ row: 1, col: 1 });
    });

    it('throws when response is not an object', () => {
      expect(() => rules.deserializeBotMove(null, 5)).toThrow();
    });

    it('throws when coords field is missing', () => {
      expect(() => rules.deserializeBotMove({ notCoords: {} }, 5)).toThrow();
    });
  });

  // ── deserializeBotPieDecision ─────────────────────────────────────
  describe('deserializeBotPieDecision', () => {
    it('returns "keep" when decision is keep', () => {
      expect(rules.deserializeBotPieDecision({ decision: 'keep' })).toBe('keep');
    });

    it('returns "swap" when decision is swap', () => {
      expect(rules.deserializeBotPieDecision({ decision: 'swap' })).toBe('swap');
    });

    it('throws when response is not an object', () => {
      expect(() => rules.deserializeBotPieDecision(null)).toThrow();
    });

    it('throws when decision field is missing', () => {
      expect(() => rules.deserializeBotPieDecision({ other: 'keep' })).toThrow();
    });

    it('throws when decision value is invalid', () => {
      expect(() => rules.deserializeBotPieDecision({ decision: 'invalid' })).toThrow();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { YGameRules } from '../rules/YGameRules';

describe('YGameRules', () => {
  const rules = new YGameRules();

  // ── variant & supportsPieRule ────────────────────────────────────
  describe('metadata', () => {
    it('variant is "y"', () => {
      expect(rules.variant).toBe('y');
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

    it('cell coordinates match their position in the array', () => {
      const board = rules.createBoard(3);
      expect(board[0][0]).toMatchObject({ row: 0, col: 0 });
      expect(board[1][1]).toMatchObject({ row: 1, col: 1 });
      expect(board[2][2]).toMatchObject({ row: 2, col: 2 });
    });
  });

  // ── isValidMove ──────────────────────────────────────────────────
  describe('isValidMove', () => {
    it('returns true for an empty cell', () => {
      const board = rules.createBoard(5);
      expect(rules.isValidMove(board, 0, 0)).toBe(true);
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

    it('returns false for negative row', () => {
      expect(rules.isValidMove(rules.createBoard(5), -1, 0)).toBe(false);
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

    it('leaves all other cells unchanged', () => {
      const newBoard = rules.applyMove(rules.createBoard(5), 0, 0, 'player1');
      expect(newBoard[1][0].owner).toBeNull();
      expect(newBoard[2][2].owner).toBeNull();
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

    it('bottom-left corner has 2 neighbors', () => {
      // offsets (-1,-1) and (0,-1) go out of bounds (col<0), (1,0) and (1,1) exceed size
      expect(rules.getNeighbors(4, 0, 5)).toHaveLength(2);
    });

    it('bottom-right corner has 2 neighbors', () => {
      // offsets (-1,0) and (0,1) go out of col<=row bound, (1,0) and (1,1) exceed size
      expect(rules.getNeighbors(4, 4, 5)).toHaveLength(2);
    });

    it('all returned neighbors are in-bounds', () => {
      const size = 5;
      for (const n of rules.getNeighbors(2, 1, size)) {
        expect(n.row).toBeGreaterThanOrEqual(0);
        expect(n.row).toBeLessThan(size);
        expect(n.col).toBeGreaterThanOrEqual(0);
        expect(n.col).toBeLessThanOrEqual(n.row);
      }
    });
  });

  // ── checkWinner ──────────────────────────────────────────────────
  describe('checkWinner', () => {
    it('returns null on an empty board', () => {
      expect(rules.checkWinner(rules.createBoard(4), 4)).toBeNull();
    });

    it('detects player1 win when left-side column connects apex to bottom', () => {
      // The left column (col=0) touches side 0 throughout; the apex (0,0) also
      // touches side 1. The bottom row also touches side 2.
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 0, 0, 'player1'); // sides 0 and 1
      board = rules.applyMove(board, 1, 0, 'player1'); // side 0
      board = rules.applyMove(board, 2, 0, 'player1'); // side 0
      board = rules.applyMove(board, 3, 0, 'player1'); // sides 0 and 2
      expect(rules.checkWinner(board, 4)).toBe('player1');
    });

    it('returns null when only 2 sides are connected', () => {
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 1, 0, 'player1'); // side 0 only
      board = rules.applyMove(board, 2, 0, 'player1'); // side 0 only
      // No connection to apex (side 1) or bottom row (side 2)
      expect(rules.checkWinner(board, 4)).toBeNull();
    });

    it('detects player2 win', () => {
      let board = rules.createBoard(4);
      board = rules.applyMove(board, 0, 0, 'player2');
      board = rules.applyMove(board, 1, 0, 'player2');
      board = rules.applyMove(board, 2, 0, 'player2');
      board = rules.applyMove(board, 3, 0, 'player2');
      expect(rules.checkWinner(board, 4)).toBe('player2');
    });

    it('does not confuse player1 stones with player2 stones', () => {
      let board = rules.createBoard(4);
      // Player1 connects all 3 sides
      board = rules.applyMove(board, 0, 0, 'player1');
      board = rules.applyMove(board, 1, 0, 'player1');
      board = rules.applyMove(board, 2, 0, 'player1');
      board = rules.applyMove(board, 3, 0, 'player1');
      // Player2 has isolated stones
      board = rules.applyMove(board, 3, 1, 'player2');
      expect(rules.checkWinner(board, 4)).toBe('player1');
    });
  });

  // ── bot endpoints ────────────────────────────────────────────────
  describe('botMoveEndpoint', () => {
    it('returns random_bot path for easy', () => {
      expect(rules.botMoveEndpoint('easy')).toBe('/v1/ybot/choose/random_bot');
    });

    it('returns fast_bot path for medium', () => {
      expect(rules.botMoveEndpoint('medium')).toBe('/v1/ybot/choose/fast_bot');
    });

    it('returns smart_bot path for hard', () => {
      expect(rules.botMoveEndpoint('hard')).toBe('/v1/ybot/choose/smart_bot');
    });
  });

  describe('botPieOpeningEndpoint', () => {
    it('returns correct pie-opening path for each level', () => {
      expect(rules.botPieOpeningEndpoint('easy')).toBe('/v1/ybot/pie-opening/random_bot');
      expect(rules.botPieOpeningEndpoint('medium')).toBe('/v1/ybot/pie-opening/fast_bot');
      expect(rules.botPieOpeningEndpoint('hard')).toBe('/v1/ybot/pie-opening/smart_bot');
    });
  });

  describe('botPieDecideEndpoint', () => {
    it('returns correct pie-decide path for each level', () => {
      expect(rules.botPieDecideEndpoint('easy')).toBe('/v1/ybot/pie-decide/random_bot');
      expect(rules.botPieDecideEndpoint('medium')).toBe('/v1/ybot/pie-decide/fast_bot');
      expect(rules.botPieDecideEndpoint('hard')).toBe('/v1/ybot/pie-decide/smart_bot');
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
      // boardSize=5, x=3 → row = 5-1-3 = 1; y=1 → col=1
      expect(rules.deserializeBotMove({ coords: { x: 3, y: 1, z: 0 } }, 5)).toEqual({ row: 1, col: 1 });
    });

    it('maps apex coords (x=size-1, y=0) to (row=0, col=0)', () => {
      expect(rules.deserializeBotMove({ coords: { x: 4, y: 0, z: 0 } }, 5)).toEqual({ row: 0, col: 0 });
    });

    it('maps bottom-left corner (x=0, y=0) to (row=size-1, col=0)', () => {
      expect(rules.deserializeBotMove({ coords: { x: 0, y: 0, z: 4 } }, 5)).toEqual({ row: 4, col: 0 });
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

    it('throws when decision value is neither keep nor swap', () => {
      expect(() => rules.deserializeBotPieDecision({ decision: 'invalid' })).toThrow();
    });
  });
});

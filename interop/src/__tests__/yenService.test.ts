// ──────────────────────────────────────────────────────────────────────────────
// __tests__/yenService.test.ts
//
// Unit tests for every exported function in services/yenService.ts.
//
// WHY these tests matter:
//   yenService is the only place in the TypeScript codebase that touches the
//   YEN coordinate math.  It is a direct port of gamey/src/core/coord.rs.
//   If any function here is wrong, every move validation and bot-reply
//   application will silently corrupt the board.  These tests are therefore
//   the most critical in the suite.
//
// Strategy: pure unit tests, zero I/O, zero mocks.  The functions are
// deterministic math — test them with known inputs and expected outputs
// derived manually from the coord.rs formulae.
// ──────────────────────────────────────────────────────────────────────────────

import {
  coordsToIndex,
  indexToCoords,
  layoutToRows,
  rowsToLayout,
  cellAt,
  applyMove,
  tokenForTurn,
  nextTurnIndex,
  emptyYEN,
  advanceTurn,
  validateHumanMove,
} from '../services/yenService';

// ── coordsToIndex ─────────────────────────────────────────────────────────────
//
// The triangular board of size 4 has these flat indices:
//
//      0          ← row 0 (1 cell)
//     1 2         ← row 1 (2 cells)
//    3 4 5        ← row 2 (3 cells)
//   6 7 8 9       ← row 3 (4 cells)
//
// Barycentric: x=3,y=0,z=0 is the top cell (index 0).
//              x=0,y=0,z=3 is the bottom-left (index 6).
//              x=0,y=3,z=0 is the bottom-right (index 9).

describe('coordsToIndex', () => {
  it('maps top corner (x=3,y=0,z=0) → index 0 on a size-4 board', () => {
    expect(coordsToIndex({ x: 3, y: 0, z: 0 }, 4)).toBe(0);
  });

  it('maps bottom-left corner (x=0,y=0,z=3) → index 6', () => {
    expect(coordsToIndex({ x: 0, y: 0, z: 3 }, 4)).toBe(6);
  });

  it('maps bottom-right corner (x=0,y=3,z=0) → index 9', () => {
    expect(coordsToIndex({ x: 0, y: 3, z: 0 }, 4)).toBe(9);
  });

  it('maps centre-left cell (x=1,y=1,z=1) → index 4', () => {
    // row = (4-1) - 1 = 2, rowStart = 2*3/2 = 3, index = 3+1 = 4
    expect(coordsToIndex({ x: 1, y: 1, z: 1 }, 4)).toBe(4);
  });

  it('works correctly for a size-2 board', () => {
    // size 2: top cell x=1,y=0,z=0 → index 0
    expect(coordsToIndex({ x: 1, y: 0, z: 0 }, 2)).toBe(0);
    // x=0,y=1,z=0 → row=(2-1)-0=1, rowStart=1, index=1+1=2
    expect(coordsToIndex({ x: 0, y: 1, z: 0 }, 2)).toBe(2);
  });
});

// ── indexToCoords ─────────────────────────────────────────────────────────────
// These are the inverse of the coordsToIndex tests above.

describe('indexToCoords', () => {
  it('maps index 0 → top corner {x:3,y:0,z:0} on size 4', () => {
    expect(indexToCoords(0, 4)).toEqual({ x: 3, y: 0, z: 0 });
  });

  it('maps index 6 → bottom-left {x:0,y:0,z:3}', () => {
    expect(indexToCoords(6, 4)).toEqual({ x: 0, y: 0, z: 3 });
  });

  it('maps index 9 → bottom-right {x:0,y:3,z:0}', () => {
    expect(indexToCoords(9, 4)).toEqual({ x: 0, y: 3, z: 0 });
  });

  it('is the inverse of coordsToIndex for all cells on a size-4 board', () => {
    // There are 1+2+3+4 = 10 cells on a size-4 board.
    for (let i = 0; i < 10; i++) {
      const coords = indexToCoords(i, 4);
      expect(coordsToIndex(coords, 4)).toBe(i);
    }
  });
});

// ── layoutToRows / rowsToLayout ───────────────────────────────────────────────

describe('layoutToRows', () => {
  it('splits a layout string on "/" into row strings', () => {
    expect(layoutToRows('B/.B/RBB')).toEqual(['B', '.B', 'RBB']);
  });

  it('handles a single-cell board (size 1)', () => {
    expect(layoutToRows('.')).toEqual(['.']);
  });
});

describe('rowsToLayout', () => {
  it('joins rows back into a layout string', () => {
    expect(rowsToLayout(['B', '.B', 'RBB'])).toBe('B/.B/RBB');
  });

  it('is the inverse of layoutToRows', () => {
    const original = './../.../....';
    expect(rowsToLayout(layoutToRows(original))).toBe(original);
  });
});

// ── cellAt ────────────────────────────────────────────────────────────────────

describe('cellAt', () => {
  // Board: "./.. " — size 2, index 0='.' index 1='.' index 2='.'
  //   "./.." → ['.', '..']
  it('reads the correct character at each index for a size-2 board', () => {
    const layout = './.B';
    expect(cellAt(layout, 2, 0)).toBe('.');
    expect(cellAt(layout, 2, 1)).toBe('.');
    expect(cellAt(layout, 2, 2)).toBe('B');
  });

  it('throws when index is out of bounds', () => {
    expect(() => cellAt('.', 1, 5)).toThrow();
  });
});

// ── applyMove ─────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('places a token on an empty cell and returns the updated layout', () => {
    // Size 2 empty board: "./.."
    // Place 'B' at top cell: coords {x:1,y:0,z:0} → index 0
    const result = applyMove('./../..', { x: 2, y: 0, z: 0 }, 'B', 3);
    // Row 0 becomes 'B', rest unchanged
    expect(result.startsWith('B')).toBe(true);
  });

  it('places the token at a mid-board position correctly', () => {
    // Size 3 empty board: "./../...."  wait - size 3 = "./../..."
    // Place 'R' at index 2 (row 1, col 1) → coords indexToCoords(2,3)
    const layout = './../...';
    const coords = indexToCoords(2, 3); // row=1, col=1 → x=1,y=1,z=0
    const result = applyMove(layout, coords, 'R', 3);
    expect(cellAt(result, 3, 2)).toBe('R');
    // All other cells remain unchanged
    expect(cellAt(result, 3, 0)).toBe('.');
    expect(cellAt(result, 3, 1)).toBe('.');
    expect(cellAt(result, 3, 3)).toBe('.');
  });

  it('throws when attempting to place on an occupied cell', () => {
    // 'B' already at top cell
    expect(() =>
      applyMove('B/../...', { x: 2, y: 0, z: 0 }, 'R', 3)
    ).toThrow(/already occupied/);
  });
});

// ── tokenForTurn ─────────────────────────────────────────────────────────────

describe('tokenForTurn', () => {
  it('returns B for turn 0', () => {
    expect(tokenForTurn(0)).toBe('B');
  });

  it('returns R for turn 1', () => {
    expect(tokenForTurn(1)).toBe('R');
  });
});

// ── nextTurnIndex ─────────────────────────────────────────────────────────────

describe('nextTurnIndex', () => {
  it("returns 1 (R's turn) after B plays", () => {
    expect(nextTurnIndex('B')).toBe(1);
  });

  it("returns 0 (B's turn) after R plays", () => {
    expect(nextTurnIndex('R')).toBe(0);
  });
});

// ── emptyYEN ──────────────────────────────────────────────────────────────────

describe('emptyYEN', () => {
  it('builds a size-3 empty board correctly', () => {
    const yen = emptyYEN(3);
    expect(yen.size).toBe(3);
    expect(yen.turn).toBe(0);
    expect(yen.players).toEqual(['B', 'R']);
    expect(yen.layout).toBe('./../...');
  });

  it('builds a size-4 empty board with correct layout', () => {
    const yen = emptyYEN(4);
    expect(yen.layout).toBe('./../.../....');
  });

  it('contains only dots (no pieces placed)', () => {
    const yen = emptyYEN(4);
    expect(yen.layout.replace(/[/.]/g, '')).toBe('');
  });
});

// ── advanceTurn ───────────────────────────────────────────────────────────────

describe('advanceTurn', () => {
  it('advances from B (turn=0) to R (turn=1)', () => {
    const yen = emptyYEN(3);        // turn = 0
    const next = advanceTurn(yen);
    expect(next.turn).toBe(1);
  });

  it('advances from R (turn=1) back to B (turn=0)', () => {
    const yen = { ...emptyYEN(3), turn: 1 };
    const next = advanceTurn(yen);
    expect(next.turn).toBe(0);
  });

  it('does not mutate the original YEN', () => {
    const yen = emptyYEN(3);
    advanceTurn(yen);
    expect(yen.turn).toBe(0);
  });
});

// ── validateHumanMove ─────────────────────────────────────────────────────────
//
// This is the most security-critical function: it must catch any attempt by
// the client to cheat (place multiple pieces, remove pieces, change tokens).

describe('validateHumanMove', () => {
  const size = 3;
  const empty = './../...'; // size-3 empty board

  it('accepts a valid single placement of B at the top cell', () => {
    const proposed = 'B/../...';
    const coords = validateHumanMove(empty, proposed, 'B', size);
    // Top cell is index 0 → coords {x:2,y:0,z:0}
    expect(coords).toEqual({ x: 2, y: 0, z: 0 });
  });

  it('accepts a valid single placement of R at index 2', () => {
    const proposed = './../R..';
    expect(() =>
      validateHumanMove(empty, proposed, 'R', size)
    ).not.toThrow();
  });

  it('rejects placing 2 tokens at once', () => {
    const proposed = 'B/../B..';   // two B tokens placed
    expect(() =>
      validateHumanMove(empty, proposed, 'B', size)
    ).toThrow(/exactly 1/);
  });

  it('rejects placing 0 tokens (no change)', () => {
    expect(() =>
      validateHumanMove(empty, empty, 'B', size)
    ).toThrow(/exactly 1/);
  });

  it('rejects placing the wrong token', () => {
    const proposed = 'R/../...';   // B's turn but placed R
    expect(() =>
      validateHumanMove(empty, proposed, 'B', size)
    ).toThrow(/expected token 'B'/i);
  });

  it('rejects overwriting an occupied cell', () => {
    const withB = 'B/../...';
    const overwrite = 'R/../...';  // trying to replace B with R
    expect(() =>
      validateHumanMove(withB, overwrite, 'R', size)
    ).toThrow(/already occupied/);
  });

  it('rejects a layout with a different number of rows', () => {
    const wrongRows = 'B/..';      // missing 3rd row
    expect(() =>
      validateHumanMove(empty, wrongRows, 'B', size)
    ).toThrow(/row count mismatch/);
  });

  it('rejects a layout where a row has the wrong length', () => {
    const wrongLen = './../....';  // last row has 4 chars instead of 3
    expect(() =>
      validateHumanMove(empty, wrongLen, 'B', size)
    ).toThrow(/length mismatch/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// __tests__/yenService.test.ts
//
// Unit tests for services/yenService.ts.
// Only the three functions the play API actually needs are tested:
//   applyMove   — place the bot's coords onto a layout string
//   emptyYEN    — build a blank board (used as test fixture)
//   isValidYEN  — structural validation of an incoming position object
// ──────────────────────────────────────────────────────────────────────────────

import { applyMove, emptyYEN, isValidYEN } from '../services/yenService';

// ── applyMove ─────────────────────────────────────────────────────────────────

describe('applyMove', () => {
  it('places a token at the top cell of a size-3 board', () => {
    // Top cell: x=2, y=0, z=0  →  row=0, index=0
    const result = applyMove('./../...', { x: 2, y: 0, z: 0 }, 'B', 3);
    expect(result).toBe('B/../...');
  });

  it('places a token at the bottom-left cell of a size-3 board', () => {
    // Bottom-left: x=0, y=0, z=2  →  row=2, index=3
    const result = applyMove('./../...', { x: 0, y: 0, z: 2 }, 'R', 3);
    expect(result).toBe('./../R..');
  });

  it('places a token at the bottom-right cell of a size-3 board', () => {
    // Bottom-right: x=0, y=2, z=0  →  row=2, index=5
    const result = applyMove('./../...', { x: 0, y: 2, z: 0 }, 'B', 3);
    expect(result).toBe('./../..B');
  });

  it('does not mutate any other cell when placing a token', () => {
    const before = './../...';
    const result = applyMove(before, { x: 2, y: 0, z: 0 }, 'B', 3);
    // Every cell except index 0 must remain '.'
    const changed = result.replace(/[/]/g, '').split('');
    const unchanged = before.replace(/[/]/g, '').split('');
    for (let i = 1; i < unchanged.length; i++) {
      expect(changed[i]).toBe('.');
    }
  });

  it('works correctly on a size-4 board', () => {
    // Place R at bottom-right of size-4: x=0, y=3, z=0  →  row=3, index=9
    const result = applyMove('./../.../....', { x: 0, y: 3, z: 0 }, 'R', 4);
    expect(result).toBe('./../.../...R');
  });

  it('throws when the target cell is already occupied', () => {
    expect(() =>
      applyMove('B/../...', { x: 2, y: 0, z: 0 }, 'R', 3)
    ).toThrow(/already occupied/);
  });
});

// ── emptyYEN ──────────────────────────────────────────────────────────────────

describe('emptyYEN', () => {
  it('builds a size-3 empty board', () => {
    const yen = emptyYEN(3);
    expect(yen.size).toBe(3);
    expect(yen.turn).toBe(0);
    expect(yen.players).toEqual(['B', 'R']);
    expect(yen.layout).toBe('./../...');
  });

  it('builds a size-4 empty board', () => {
    expect(emptyYEN(4).layout).toBe('./../.../....');
  });

  it('contains only dots (no pieces placed)', () => {
    expect(emptyYEN(5).layout.replace(/[/.]/g, '')).toBe('');
  });
});

// ── isValidYEN ────────────────────────────────────────────────────────────────

describe('isValidYEN', () => {
  const valid = emptyYEN(3);

  it('accepts a well-formed size-3 empty board', () => {
    expect(isValidYEN(valid)).toBe(true);
  });

  it('accepts a board with tokens already placed', () => {
    expect(isValidYEN({ size: 3, turn: 1, players: ['B', 'R'], layout: 'B/../...' })).toBe(true);
  });

  it('accepts turn = 1', () => {
    expect(isValidYEN({ ...valid, turn: 1 })).toBe(true);
  });

  it('accepts a size-1 board', () => {
    expect(isValidYEN({ size: 1, turn: 0, players: ['B', 'R'], layout: '.' })).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidYEN(null)).toBe(false);
  });

  it('rejects a plain string', () => {
    expect(isValidYEN('B/../...')).toBe(false);
  });

  it('rejects when size is missing', () => {
    const { size, ...rest } = valid;
    expect(isValidYEN(rest)).toBe(false);
  });

  it('rejects when size is 0', () => {
    expect(isValidYEN({ ...valid, size: 0 })).toBe(false);
  });

  it('rejects when size is a float', () => {
    expect(isValidYEN({ ...valid, size: 3.5 })).toBe(false);
  });

  it('rejects when turn is 2', () => {
    expect(isValidYEN({ ...valid, turn: 2 })).toBe(false);
  });

  it('rejects when turn is a string', () => {
    expect(isValidYEN({ ...valid, turn: 'B' })).toBe(false);
  });

  it('rejects when players is empty', () => {
    expect(isValidYEN({ ...valid, players: [] })).toBe(false);
  });

  it('rejects when layout is missing', () => {
    const { layout, ...rest } = valid;
    expect(isValidYEN(rest)).toBe(false);
  });

  it('rejects when layout has wrong row count for the declared size', () => {
    expect(isValidYEN({ ...valid, layout: './..' })).toBe(false);
  });

  it('rejects when a row has the wrong length', () => {
    expect(isValidYEN({ ...valid, layout: './../....' })).toBe(false);
  });

  it('rejects when layout contains invalid characters', () => {
    expect(isValidYEN({ ...valid, layout: 'X/../...' })).toBe(false);
  });
});
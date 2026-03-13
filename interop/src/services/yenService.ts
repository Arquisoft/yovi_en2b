// ──────────────────────────────────────────────────────────────────────────────
// services/yenService.ts
//
// Minimal YEN utilities required by the stateless play API:
//
//   applyMove   — place the bot's returned coords onto a layout string
//   emptyYEN    — build an empty board (used in tests)
//   isValidYEN  — structural validation of an incoming YEN position object
//
// All coordinate math, turn helpers, and human-move validation that belonged
// to the old stateful game session have been removed.
// ──────────────────────────────────────────────────────────────────────────────

import type { Coordinates, YEN } from '../models/game';

const PLAYERS: string[] = ['B', 'R'];

// ── Layout helpers ────────────────────────────────────────────────────────────

function layoutToRows(layout: string): string[] {
  return layout.split('/');
}

function rowsToLayout(rows: string[]): string {
  return rows.join('/');
}

// ── applyMove ─────────────────────────────────────────────────────────────────

/**
 * Place a token at the given barycentric coordinates and return the updated
 * layout string.  Throws if the target cell is already occupied.
 *
 * Called with the coords the Rust engine returns so the response can include
 * the full updated board layout.
 */
export function applyMove(
  layout: string,
  coords: Coordinates,
  token: string,
  size: number
): string {
  // row = (size - 1) - x,  index = rowStart + y  (mirrors coord.rs)
  const row = (size - 1) - coords.x;
  const rowStart = (row * (row + 1)) / 2;
  const index = rowStart + coords.y;

  const rows = layoutToRows(layout);
  let cursor = 0;

  for (let r = 0; r < rows.length; r++) {
    const currentRow = rows[r];
    if (index < cursor + currentRow.length) {
      const col = index - cursor;
      if (currentRow[col] !== '.') {
        throw new Error(`Cell (${coords.x},${coords.y},${coords.z}) is already occupied`);
      }
      rows[r] = currentRow.substring(0, col) + token + currentRow.substring(col + 1);
      return rowsToLayout(rows);
    }
    cursor += currentRow.length;
  }

  throw new Error(`Coordinates (${coords.x},${coords.y},${coords.z}) out of bounds`);
}

// ── emptyYEN ──────────────────────────────────────────────────────────────────

/**
 * Build an empty YEN board for the given size.
 * Row i (0-based from top) has (i + 1) cells, all '.'.
 * Used in tests to construct fixture positions.
 */
export function emptyYEN(size: number): YEN {
  const rows: string[] = [];
  for (let r = 1; r <= size; r++) {
    rows.push('.'.repeat(r));
  }
  return {
    size,
    turn: 0,
    players: [...PLAYERS],
    layout: rowsToLayout(rows),
  };
}

// ── isValidYEN ────────────────────────────────────────────────────────────────

/**
 * Returns true when the given value is a structurally valid YEN object:
 *   - size is a positive integer
 *   - turn is 0 or 1
 *   - players is a non-empty array of strings
 *   - layout rows match the declared size (row r has r+1 cells, chars: B R .)
 */
export function isValidYEN(value: unknown): value is YEN {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;

  if (typeof v.size !== 'number' || !Number.isInteger(v.size) || v.size < 1) return false;
  if (typeof v.turn !== 'number' || (v.turn !== 0 && v.turn !== 1)) return false;
  if (!Array.isArray(v.players) || v.players.length === 0) return false;
  if (typeof v.layout !== 'string') return false;

  const rows = (v.layout as string).split('/');
  if (rows.length !== v.size) return false;

  for (let r = 0; r < rows.length; r++) {
    if (rows[r].length !== r + 1) return false;
    if (!/^[BR.]+$/.test(rows[r])) return false;
  }

  return true;
}
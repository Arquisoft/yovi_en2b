// ──────────────────────────────────────────────────────────────────────────────
// services/yenService.ts
//
// All logic that touches YEN notation lives here so the rest of the codebase
// works with plain TypeScript objects instead of raw strings.
//
// The coordinate math is a direct port of gamey/src/core/coord.rs so that
// both sides of the HTTP boundary always agree on cell indices.
// ──────────────────────────────────────────────────────────────────────────────

import type { Coordinates, YEN } from '../models/game';

// ── Constants ─────────────────────────────────────────────────────────────────
const PLAYERS: string[] = ['B', 'R'];
const DEFAULT_TIME_MS = 600_000; // 10 minutes per side

// ── Coordinate ↔ index helpers (port of coord.rs) ────────────────────────────

/**
 * Convert barycentric coordinates to a flat cell index.
 * Mirrors Coordinates::to_index in gamey/src/core/coord.rs
 *
 *   row   = (size - 1) - x
 *   start = row * (row + 1) / 2
 *   index = start + y
 */
export function coordsToIndex(coords: Coordinates, size: number): number {
  const row = (size - 1) - coords.x;
  const rowStart = (row * (row + 1)) / 2;
  return rowStart + coords.y;
}

/**
 * Convert a flat index back to barycentric coordinates.
 * Mirrors Coordinates::from_index in gamey/src/core/coord.rs
 */
export function indexToCoords(index: number, size: number): Coordinates {
  // row = floor((sqrt(8*i + 1) - 1) / 2)
  const row = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2);
  const rowStart = (row * (row + 1)) / 2;
  const col = index - rowStart;

  const x = (size - 1) - row;
  const y = col;
  const z = (size - 1) - x - y;
  return { x, y, z };
}

// ── Layout string manipulation ────────────────────────────────────────────────

/**
 * Split a layout string into an array of row strings.
 *   "B/.B/RBB" → ["B", ".B", "RBB"]
 */
export function layoutToRows(layout: string): string[] {
  return layout.split('/');
}

/**
 * Reconstruct a layout string from an array of row strings.
 */
export function rowsToLayout(rows: string[]): string {
  return rows.join('/');
}

/**
 * Return the token character at a given cell index ('B', 'R', or '.').
 */
export function cellAt(layout: string, size: number, index: number): string {
  const rows = layoutToRows(layout);
  let cursor = 0;
  for (const row of rows) {
    if (index < cursor + row.length) {
      return row[index - cursor];
    }
    cursor += row.length;
  }
  throw new Error(`Index ${index} out of bounds for board size ${size}`);
}

/**
 * Place a token at the given barycentric coordinates and return the updated
 * layout string.  Throws if the cell is already occupied.
 *
 * This is used to apply the bot's move (returned as Coordinates by Rust) onto
 * the layout string that the client submitted.
 */
export function applyMove(
  layout: string,
  coords: Coordinates,
  token: string,
  size: number
): string {
  const index = coordsToIndex(coords, size);
  const rows = layoutToRows(layout);

  let cursor = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (index < cursor + row.length) {
      const col = index - cursor;
      if (row[col] !== '.') {
        throw new Error(`Cell (${coords.x},${coords.y},${coords.z}) is already occupied`);
      }
      rows[r] = row.substring(0, col) + token + row.substring(col + 1);
      return rowsToLayout(rows);
    }
    cursor += row.length;
  }
  throw new Error(`Coordinates (${coords.x},${coords.y},${coords.z}) out of bounds`);
}

// ── Turn helpers ─────────────────────────────────────────────────────────────

/**
 * Return the token character ('B' or 'R') for a given turn index.
 * turn 0 → 'B', turn 1 → 'R'  (matches gamey/src/notation/yen.rs)
 */
export function tokenForTurn(turn: number): string {
  return PLAYERS[turn % PLAYERS.length];
}

/**
 * Return the turn index for the opponent of the given token.
 * 'B' → 1 (R's turn), 'R' → 0 (B's turn)
 */
export function nextTurnIndex(currentToken: string): number {
  return currentToken === 'B' ? 1 : 0;
}

// ── YEN factory ──────────────────────────────────────────────────────────────

/**
 * Build an empty YEN board for the given size.
 *
 * Row i (0-based from top) has (i + 1) cells.
 * An empty board of size 4:  "." + "/" + ".." + "/" + "..." + "/" + "...."
 *                          = "./../.../...."
 */
export function emptyYEN(size: number): YEN {
  const rows: string[] = [];
  for (let r = 1; r <= size; r++) {
    rows.push('.'.repeat(r));
  }
  return {
    size,
    turn: 0,          // B always goes first
    players: [...PLAYERS],
    layout: rowsToLayout(rows),
  };
}

/**
 * Clone a YEN and advance the turn counter to the next player.
 */
export function advanceTurn(yen: YEN): YEN {
  return {
    ...yen,
    turn: nextTurnIndex(tokenForTurn(yen.turn)),
  };
}

/**
 * Validate that a proposed layout string differs from the current one by
 * exactly one newly placed token for `expectedToken`, and that the placement
 * is legal (previously empty cell, correct token character).
 *
 * Returns the coordinates of the new move on success, throws on failure.
 */
export function validateHumanMove(
  currentLayout: string,
  proposedLayout: string,
  expectedToken: string,
  size: number
): Coordinates {
  const currentRows = layoutToRows(currentLayout);
  const proposedRows = layoutToRows(proposedLayout);

  if (currentRows.length !== proposedRows.length) {
    throw new Error('Layout row count mismatch');
  }

  const changes: Array<{ index: number; coords: Coordinates }> = [];
  let cursor = 0;

  for (let r = 0; r < currentRows.length; r++) {
    const cur = currentRows[r];
    const prop = proposedRows[r];
    if (cur.length !== prop.length) {
      throw new Error(`Row ${r} length mismatch`);
    }
    for (let c = 0; c < cur.length; c++) {
      if (cur[c] !== prop[c]) {
        if (cur[c] !== '.') {
          throw new Error(`Illegal move: cell at row ${r} col ${c} was already occupied`);
        }
        if (prop[c] !== expectedToken) {
          throw new Error(
            `Illegal move: expected token '${expectedToken}' but got '${prop[c]}'`
          );
        }
        changes.push({ index: cursor + c, coords: indexToCoords(cursor + c, size) });
      }
    }
    cursor += cur.length;
  }

  if (changes.length !== 1) {
    throw new Error(`Expected exactly 1 new cell, found ${changes.length}`);
  }

  return changes[0].coords;
}

export { DEFAULT_TIME_MS, PLAYERS };
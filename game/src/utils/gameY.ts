import type { BoardCell, BoardSize, PlayerColor, Move } from '../types/game';

const ALL_SIDES = [0, 1, 2];

export function createEmptyBoard(size: BoardSize): BoardCell[][] {
  const board: BoardCell[][] = [];
  for (let row = 0; row < size; row++) {
    const rowCells: BoardCell[] = [];
    for (let col = 0; col <= row; col++) {
      rowCells.push({ row, col, owner: null });
    }
    board.push(rowCells);
  }
  return board;
}

export function getNeighbors(
  row: number,
  col: number,
  size: BoardSize
): { row: number; col: number }[] {
  const neighbors: { row: number; col: number }[] = [];
  const offsets = [
    [-1, -1],
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  for (const [dr, dc] of offsets) {
    const newRow = row + dr;
    const newCol = col + dc;
    if (newRow >= 0 && newRow < size && newCol >= 0 && newCol <= newRow) {
      neighbors.push({ row: newRow, col: newCol });
    }
  }
  return neighbors;
}

export function getCellSides(row: number, col: number, size: BoardSize): number[] {
  const sides: number[] = [];
  if (col === 0) sides.push(0);
  if (col === row) sides.push(1);
  if (row === size - 1) sides.push(2);
  return sides;
}

export function checkWinner(board: BoardCell[][], size: BoardSize): PlayerColor | null {
  const players: PlayerColor[] = ['player1', 'player2'];
  for (const player of players) {
    if (hasConnectedAllSides(board, size, player)) return player;
  }
  return null;
}

function hasConnectedAllSides(board: BoardCell[][], size: BoardSize, player: PlayerColor): boolean {
  const visited = new Set<string>();
  for (let row = 0; row < size; row++) {
    if (board[row][0]?.owner !== player || visited.has(`${row},0`)) continue;
    const sidesReached = exploreComponent(board, size, player, row, visited);
    if (ALL_SIDES.every((side) => sidesReached.has(side))) return true;
  }
  return false;
}

function exploreComponent(
  board: BoardCell[][],
  size: BoardSize,
  player: PlayerColor,
  startRow: number,
  visited: Set<string>
): Set<number> {
  const sidesReached = new Set<number>();
  const queue: { row: number; col: number }[] = [{ row: startRow, col: 0 }];
  visited.add(`${startRow},0`);
  getCellSides(startRow, 0, size).forEach((s) => sidesReached.add(s));

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of getNeighbors(current.row, current.col, size)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (visited.has(key) || board[neighbor.row]?.[neighbor.col]?.owner !== player) continue;
      visited.add(key);
      queue.push(neighbor);
      getCellSides(neighbor.row, neighbor.col, size).forEach((s) => sidesReached.add(s));
    }
  }
  return sidesReached;
}

export function applyMove(board: BoardCell[][], move: Move): BoardCell[][] {
  return board.map((row, rowIndex) =>
    row.map((cell, colIndex) =>
      rowIndex === move.row && colIndex === move.col
        ? { ...cell, owner: move.player }
        : cell
    )
  );
}

export function isValidMove(board: BoardCell[][], row: number, col: number): boolean {
  const cell = board[row]?.[col];
  return cell !== undefined && cell.owner === null;
}

export function getOppositePlayer(player: PlayerColor): PlayerColor {
  return player === 'player1' ? 'player2' : 'player1';
}

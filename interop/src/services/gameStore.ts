// ──────────────────────────────────────────────────────────────────────────────
// services/gameStore.ts
//
// Pure in-memory store for ACTIVE games.
// A game is removed from here as soon as it reaches a terminal status and has
// been persisted to the database (that step lives in gameService.ts).
//
// Why in-memory?  The assignment's architecture decision ADR-004 explicitly
// states "keep gamey stateless; do not persist game state in M1".  The webapp
// backend mirrors that decision: the full YEN state is passed on every Rust
// call, so we only need RAM for the duration of a match.
// ──────────────────────────────────────────────────────────────────────────────

import type { GameState } from '../models/game';

// Simple auto-increment so each new game gets a stable numeric ID.
// In production this would come from the DB sequence; for M1 RAM is fine.
let nextId = 1;

const activeGames = new Map<number, GameState>();

/** Persist a game to the store (insert or update). */
export const saveToMemory = (game: GameState): void => {
  activeGames.set(game.gameId, game);
};

/** Retrieve an active game by its ID.  Returns undefined when not found. */
export const getFromMemory = (gameId: number): GameState | undefined => {
  return activeGames.get(gameId);
};

/** Remove a finished game after it has been persisted to the DB. */
export const removeFromMemory = (gameId: number): void => {
  activeGames.delete(gameId);
};

/**
 * Find any active game where a specific user (by their users-service id) is
 * playing as the human participant.  Used by auth checks to verify the caller
 * is actually a participant in the requested game.
 */
export const findGameByUserId = (userId: number): GameState | undefined => {
  for (const game of activeGames.values()) {
    for (const player of Object.values(game.players)) {
      if (player.type === 'HUMAN' && player.id === userId) {
        return game;
      }
    }
  }
  return undefined;
};

/** Allocate and return a fresh, unique game ID. */
export const allocateGameId = (): number => {
  return nextId++;
};
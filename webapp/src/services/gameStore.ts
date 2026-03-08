import type { GameState } from '../models/game';

const activeGames = new Map<string, GameState>();

export const saveToMemory = (game: GameState) => {
  activeGames.set(game.gameId, game);
};

export const getFromMemory = (gameId: string): GameState | undefined => {
  return activeGames.get(gameId);
};

export const removeFromMemory = (gameId: string) => {
  activeGames.delete(gameId);
};
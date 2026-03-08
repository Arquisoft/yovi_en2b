import axios from 'axios';
import * as gameStore from './gameStore';
import type { GameState, RustMoveResponse } from '../models/game';

const RUST_URL = process.env.RUST_ENGINE_URL || 'http://localhost:4000';

export const playMove = async (gameId: string, proposedLayout: string, botId: string) => {
  // 1. Get game
  let game = gameStore.getFromMemory(gameId);
  if (!game) throw new Error("GAME_NOT_FOUND");

  // 2. Update the local layout with the Human move
  game.layout = proposedLayout;

  // 3. Ask the Rust for the Bot's move
  // Note the new path from your Rust mod.rs
  const response = await axios.post<RustMoveResponse>(
    `${RUST_URL}/v1/ybot/choose/${botId}`, 
    { layout: game.layout } // Sending YEN notation
  );

  const botMove = response.data.coords;
  
  // 4. [TODO] Logic to apply botMove coordinates to the game.layout string
  // For now, let's assume the game is updated...
  
  // 5. Update RAM
  gameStore.saveToMemory(game);

  // 6. IF game is over, save to DB (The Persistence Requirement)
  if (game.status !== "ONGOING") {
    await persistToDatabase(game); // TODO: Implement DB Save
    gameStore.removeFromMemory(gameId); // Clear RAM
  }

  return game;
};

const persistToDatabase = async (game: GameState) => {
    console.log(`💾 Match ${game.gameId} ended. Persisting final state to DB...`);
    // Here goes your Mongoose/TypeORM save() call
};
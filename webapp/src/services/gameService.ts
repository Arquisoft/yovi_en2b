import axios from 'axios';
import type { GameState } from '../models/game';

const RUST_ENGINE_URL = process.env.RUST_ENGINE_URL || 'http://gamey:4000';

export const getGameById = async (gameId: string): Promise<GameState> => {
  // TODO: Implement actual DB query
  // For now, we return a mock object based on the YEN example
  return {
    size: 4,
    layout: "B/.B/RBB/B..R",
    players: {
      "B": { playerId: 1, playerType: "human" },
      "R": { playerId: 2, playerType: "bot" }
    },
    turn: "B",
    status: "ONGOING"
  };
};

export const processMove = async (gameId: string, userId: number, proposedLayout: string): Promise<GameState> => {
  const currentState = await getGameById(gameId);

  // 1. Validation Logic
  if (currentState.status !== "ONGOING") throw new Error("FINISHED");
  
  const userToken = currentState.players["B"].playerId === userId ? "B" : "R";
  if (currentState.turn !== userToken) throw new Error("NOT_YOUR_TURN");

  // 2. Call the Rust Engine (The Web Service Interface)
  // We send the proposed layout to the Rust Mathematician to check if it's legal/a win
  const response = await axios.post(`${RUST_ENGINE_URL}/verify`, {
    layout: proposedLayout,
    size: currentState.size
  });

  const updatedState: GameState = response.data;

  // 3. Save to Database
  // TODO: db.games.update({id: gameId}, updatedState);

  return updatedState;
};
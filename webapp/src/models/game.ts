// DTOs matching the OpenAPI Schemas
export interface Player {
  playerId: number;
  playerType: 'bot' | 'human';
}

export interface GameState {
  size: number;
  layout: string; // YEN Notation
  players: {
    [key: string]: Player; // Maps 'B' or 'R' to a Player object
  };
  turn: string | null;
  status: 'ONGOING' | 'PLAYER_B_WINS' | 'PLAYER_A_WINS';
}

export interface PlayRequest {
  layout: string; // The proposed new layout
}

export interface ErrorResponse {
  code: 'NOT_PLAYING' | 'NOT_YOUR_TURN';
  message: string;
  status: string | null;
}
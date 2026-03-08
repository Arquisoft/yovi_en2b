// DTOs matching the OpenAPI Schemas
export interface Player {
  playerId: number;
  playerType: 'bot' | 'human';
}

export interface GameState {
  gameId: string;
  size: number;
  layout: string; 
  players: { [key: string]: { playerId: string; playerType: string } };
  turn: string | null;
  status: 'ONGOING' | string;
}

// This is what Rust sends back to us
export interface RustMoveResponse {
  api_version: string;
  bot_id: string;
  coords: Coordinates;
}

export interface PlayRequest {
  layout: string; // The proposed new layout
}

export interface ErrorResponse {
  code: 'NOT_PLAYING' | 'NOT_YOUR_TURN';
  message: string;
  status: string | null;
}

export interface Coordinates {
  x: number;
  y: number;
  z: number;
}
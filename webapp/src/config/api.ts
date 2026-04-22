export const USERS_API_URL = `${import.meta.env.VITE_USERS_API_URL}/api`;
export const GAME_API_URL = `${import.meta.env.VITE_GAME_API_URL}/api`;

/**
 * WebSocket URL apuntando al servicio de juego.
 * Intenta usar la variable de entorno específica, de lo contrario, 
 * transforma la URL de la API de HTTP(S) a WS(S).
 */
const baseGameUrl = import.meta.env.VITE_GAME_API_URL ?? 'http://localhost:5000';

export const WS_URL = import.meta.env.VITE_GAME_WS_URL ?? 
  `${baseGameUrl.replace(/^http/, 'ws')}/ws`;
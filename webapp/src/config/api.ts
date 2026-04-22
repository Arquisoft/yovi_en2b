/**
 * All API base URLs are injected at build time via Vite env variables.
 * See .env.example for required values.
 *
 * Reverse-proxy layout (Traefik / nginx):
 *   http://api.localhost/users/*   → users service
 *   http://api.localhost/game/*    → game service  (prefix stripped)
 *   ws://api.localhost/game/ws     → game service WS (prefix stripped → /ws)
 */

if (!import.meta.env.VITE_USERS_API_URL) throw new Error('VITE_USERS_API_URL is required')
if (!import.meta.env.VITE_GAME_API_URL)  throw new Error('VITE_GAME_API_URL is required')
if (!import.meta.env.VITE_GAME_WS_URL)   throw new Error('VITE_GAME_WS_URL is required')

/** Base URL for the users service REST API.  e.g. http://api.localhost/users/api */
export const USERS_API_URL = `${import.meta.env.VITE_USERS_API_URL}/api`

/** Base URL for the game service REST API.  e.g. http://api.localhost/game/api */
export const GAME_API_URL = `${import.meta.env.VITE_GAME_API_URL}/api`

/**
 * Full WebSocket URL for the game service real-time endpoint.
 * e.g. ws://api.localhost/game/ws
 *
 * The reverse proxy strips the /game prefix before forwarding, so the game
 * service's WebSocketServer only needs to listen on path /ws — which it does.
 */
export const WS_URL = import.meta.env.VITE_GAME_WS_URL
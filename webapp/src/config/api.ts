/**
 * API configuration — read from environment at build-time.
 * These values are baked into the bundle by Vite during `npm run build`.
 */

export const USERS_API_URL = `${import.meta.env.VITE_USERS_API_URL ?? 'http://localhost:3001'}/api`
export const GAME_API_URL = `${import.meta.env.VITE_GAME_API_URL ?? 'http://localhost:5000'}/api`

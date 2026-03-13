// ──────────────────────────────────────────────────────────────────────────────
// routes/gameRoutes.ts
//
// Single route for the stateless play API:
//
//   POST /games/play  → playMove
//
// No :gameId parameter — the endpoint is sessionless.
// All requests still require a valid JWT (authMiddleware).
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { playMove } from '../controllers/gameController';

const router = Router();

// POST /games/play
// Body: { position: YEN, bot_id?: string, strategy?: string }
router.post('/play', playMove);

export default router;
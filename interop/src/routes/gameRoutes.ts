// ──────────────────────────────────────────────────────────────────────────────
// routes/gameRoutes.ts
//
// Single route for the stateless play API:
//
//   GET /play  → playMove
//
// No :gameId parameter — the endpoint is sessionless.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { playMove } from '../controllers/gameController';

const router = Router();

// GET /play
// Query: position (required, JSON-encoded YEN), bot_id (optional), strategy (optional)
router.get('/play', playMove);

export default router;
// ──────────────────────────────────────────────────────────────────────────────
// routes/gameRoutes.ts
//
// Registers the three game endpoints from webapp/openapi.yaml:
//
//   GET  /games/:gameId           → getGameState
//   POST /games/:gameId/play      → playMove
//   POST /games/:gameId/surrender → surrenderGame
//
// All routes are protected by the JWT authMiddleware, which attaches
// req.user = { id, username, role } for downstream use by the controller.
// This follows the exact same pattern used in users/src/routes/authRoutes.ts.
// ──────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as gameController from '../controllers/gameController';

const router = Router();

// Every game route requires a valid JWT — matches the OpenAPI global security
router.use(authMiddleware);

// GET /games/:gameId
// Returns the current snapshot of the game (board, timers, players, status).
router.get('/:gameId', gameController.getGameState);

// POST /games/:gameId/play
// The authenticated user submits their proposed board state.
// Body: { yen: string }
router.post('/:gameId/play', gameController.playMove);

// POST /games/:gameId/surrender
// The authenticated user forfeits; the opponent wins immediately.
router.post('/:gameId/surrender', gameController.surrenderGame);

export default router;
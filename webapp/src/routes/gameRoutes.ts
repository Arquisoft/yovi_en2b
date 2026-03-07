import { Router } from 'express';
import * as gameController from '../controllers/gameController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply auth to all game routes
router.use(authMiddleware);

router.get('/:gameId', gameController.getGameState);
router.post('/:gameId/play', gameController.playMove);

export default router;
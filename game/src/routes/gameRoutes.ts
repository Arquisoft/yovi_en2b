import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createGame, getGame, playMove, surrender } from '../controllers/GameController';

const router = Router();

router.post('/', authMiddleware, createGame);
router.get('/:id', getGame);
router.post('/:id/move', authMiddleware, playMove);
router.post('/:id/surrender', authMiddleware, surrender);

export default router;

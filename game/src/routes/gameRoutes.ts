import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth';
import { createGame, getGame, playMove, surrender } from '../controllers/GameController';

const router = Router();

router.post('/', optionalAuthMiddleware, createGame);
router.get('/:id', getGame);
router.post('/:id/move', optionalAuthMiddleware, playMove);
router.post('/:id/surrender', optionalAuthMiddleware, surrender);

export default router;

import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth';
import { createGame, getGame, playMove, decidePie, surrender, getGames } from '../controllers/GameController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, getGames);
router.post('/', optionalAuthMiddleware, createGame);
router.get('/:id', getGame);
router.post('/:id/move', optionalAuthMiddleware, playMove);
router.post('/:id/pie-decision', optionalAuthMiddleware, decidePie);
router.post('/:id/surrender', optionalAuthMiddleware, surrender);

export default router;

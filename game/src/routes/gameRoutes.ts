import { Router } from 'express';
import { optionalAuthMiddleware } from '../middleware/auth';
import { createGame, getGame, playMove, decidePie, surrender } from '../controllers/GameController';

const router = Router();

router.post('/', optionalAuthMiddleware, createGame);
router.get('/:id', getGame);
router.post('/:id/move', optionalAuthMiddleware, playMove);
router.post('/:id/pie-decision', optionalAuthMiddleware, decidePie);
router.post('/:id/surrender', optionalAuthMiddleware, surrender);

export default router;

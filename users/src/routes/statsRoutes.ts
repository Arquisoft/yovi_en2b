import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/history', authMiddleware, StatsController.getMatchHistory);
router.get('/winrate', authMiddleware, StatsController.getWinrate);
router.post('/record', authMiddleware, StatsController.saveRecord);

// Server-to-server endpoint — no JWT, protected by X-Internal-Secret header
router.post('/record/internal', StatsController.saveInternalRecord);

export default router;
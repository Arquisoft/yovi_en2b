// users/src/routes/statsRoutes.ts
import { Router } from 'express';
import { StatsController } from '../controllers/StatsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All stats routes require JWT
router.get('/history', authMiddleware, StatsController.getMatchHistory);
router.get('/winrate', authMiddleware, StatsController.getWinrate);
router.post('/record', authMiddleware, StatsController.saveRecord);  

export default router;

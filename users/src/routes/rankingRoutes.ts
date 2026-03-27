// users/src/routes/rankingRoutes.ts

import { Router } from 'express'
import { RankingController } from '../controllers/RankingController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Protected route - requires JWT
router.get('/:mode', authMiddleware, RankingController.getRankingByMode)

export default router
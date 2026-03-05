import { Router } from 'express';
import { handlePlay } from '../controllers/gameController';

const router = Router();
router.post(':gameId/play', handlePlay); // Matches POST /games/{gameId}/play

export default router;
// users/src/controllers/StatsController.ts
import { Response } from 'express';
import { AuthRequest } from '../types/request';
import { StatsService } from '../services/StatsService';

export class StatsController {
  // GET /api/stats/history
  static async getMatchHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const history = await StatsService.getMatchHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/stats/winrate
  static async getWinrate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const winrate = await StatsService.getWinrate(userId);
      res.json(winrate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

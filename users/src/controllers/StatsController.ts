import { Request, Response } from 'express';
import { AuthRequest } from '../types/request';
import { StatsService } from '../services/StatsService';

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || 'internal_secret';

export class StatsController {
  static async getMatchHistory(req: AuthRequest, res: Response) {
    try {
      const history = await StatsService.getMatchHistory(req.user!.id);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async getWinrate(req: AuthRequest, res: Response) {
    try {
      const winrate = await StatsService.getWinrate(req.user!.id);
      res.json(winrate);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  static async saveRecord(req: AuthRequest, res: Response) {
    try {
      const { opponentName, result, durationSeconds, gameMode } = req.body;
      const record = await StatsService.saveMatchRecord({
        userId: req.user!.id, opponentName, result, durationSeconds, gameMode: gameMode ?? null,
      });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /** Server-to-server endpoint – secured by X-Internal-Secret header. */
  static async saveInternalRecord(req: Request, res: Response) {
    if (req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    try {
      const { userId, opponentName, result, durationSeconds, gameMode } = req.body;
      if (!userId || !opponentName || !result || durationSeconds === undefined) {
        return res.status(400).json({ error: 'userId, opponentName, result and durationSeconds are required' });
      }
      const record = await StatsService.saveMatchRecord({ userId, opponentName, result, durationSeconds, gameMode: gameMode ?? null });
      res.status(201).json(record);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
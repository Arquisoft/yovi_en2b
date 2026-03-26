// users/src/controllers/RankingController.ts

import { Request, Response } from 'express'
import { RankingService } from '../services/RankingService'
import { GameMode } from '../types/ranking'

export class RankingController {
  // GET /api/ranking/:mode
  // NOSONAR
  static async getRankingByMode(req: Request, res: Response) {
    try {
      const mode = req.params.mode as GameMode
      const validModes: GameMode[] = ['pve-easy', 'pve-medium', 'pve-hard']

      if (!validModes.includes(mode)) {
        return res.status(400).json({ error: 'Invalid game mode' })
      }

      const ranking = await RankingService.getRankingByMode(mode)
      res.json(ranking)
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }
}
import { Response } from 'express';
import { AuthRequest } from '../types/request';
import { GameService } from '../services/GameService';
import type { GameConfig, PieDecision, PlayerColor } from '../types/game';

const gameService = new GameService();

export const createGame = async (req: AuthRequest, res: Response) => {
  try {
    const { config } = req.body as { config: GameConfig };
    if (!config) {
      return res.status(400).json({ error: 'config is required' });
    }

    if (config.boardSize < 4 || config.boardSize > 16) {
      return res.status(400).json({ error: 'boardSize must be between 4 and 16' });
    }

    if (config.timerEnabled && config.timerSeconds) {
      if (config.timerSeconds < 60 || config.timerSeconds > 1200) {
        return res.status(400).json({ error: 'timerSeconds must be between 60 and 1200 seconds (1–20 minutes)' });
      }
    }

    const userId = req.user?.id ?? null;
    const username = req.user?.username ?? 'Guest';
    const guestId = !req.user ? (req.body.guestId as string | undefined) : undefined;
    const token = req.headers.authorization?.split(' ')[1];
    const game = await gameService.createGame(config, userId, username, token, guestId);
    return res.status(201).json(game);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

export const getGame = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const game = await gameService.getGame(id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    return res.json(game);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

export const getGames = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const page = Math.max(1, Number.parseInt(req.query.page as string) || 1);
    const result = await gameService.getUserGames(userId, page);
    return res.json(result);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

export const playMove = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { row, col, player } = req.body as {
      row: number;
      col: number;
      player: PlayerColor;
    };

    if (row === undefined || col === undefined || !player) {
      return res.status(400).json({ error: 'row, col and player are required' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    const game = await gameService.playMove(id, row, col, player, token);
    return res.json(game);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

export const decidePie = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { decision } = req.body as { decision: PieDecision };

    if (decision !== 'keep' && decision !== 'swap') {
      return res.status(400).json({ error: 'decision must be "keep" or "swap"' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    const game = await gameService.decidePie(id, decision, token);
    return res.json(game);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};

export const surrender = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { player } = req.body as { player: PlayerColor };

    if (!player) {
      return res.status(400).json({ error: 'player is required' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    const game = await gameService.surrender(id, player, token);
    return res.json(game);
  } catch (err: any) {
    return res.status(err.status || 500).json({ error: err.message });
  }
};
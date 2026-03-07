import type { Request, Response } from 'express';
import * as gameService from '../services/gameService';

export const getGameState = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const game = await gameService.getGameById(String(gameId));
    res.status(200).json(game);
  } catch (error) {
    res.status(404).json({ message: "Game not found" });
  }
};

export const playMove = async (req: Request, res: Response) => {
    const INV_TURN: string = "NOT_YOUR_TURN";
    try {
    const { gameId } = req.params;
    const { layout } = req.body;
    const userId = (req as any).user.id; // From our Auth middleware

    const result = await gameService.processMove(String(gameId), userId, layout);
    res.status(200).json(result);

    } catch (error: any) {
    if (error.message === INV_TURN) {
        res.status(403).json({ code: INV_TURN, message: "It is not your turn", status: "ONGOING" });
    } else {
        res.status(400).json({ message: "Illegal move or invalid format" });
    }
    }
};
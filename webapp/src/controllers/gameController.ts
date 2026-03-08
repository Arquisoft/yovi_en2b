import type { Request, Response } from 'express';
import * as gameService from '../services/gameService';

export const playMove = async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { layout } = req.body;
    
    // We assume the frontend tells us which bot strategy to use
    // or we fetch it from the Game object
    const botId = "random_bot"; 

    const updatedGame = await gameService.playMove(gameId, layout, botId);
    
    res.status(200).json(updatedGame);
  } catch (error) {
    res.status(400).json({ error: "Action failed" });
  }
};
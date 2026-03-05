import type { Request, Response } from 'express';
import * as gameService from '../services/gameService';

export const handlePlay = async ( req: Request, res: Response) => {
    const INV_GAME_FORMAT: string = "Invalid Game ID format"
    const ILL_MOVE: string = "Illegal move"

    try {
        const { gameId } = req.params;
        const { position } = req.body;

        // Check for a valid request type for the game service to use 
        if (typeof gameId !== 'string') {
            res.status(400).json({error: INV_GAME_FORMAT});

            return;
        }

        const result = await gameService.playMove(gameId, position);

        // As per the OpenAPI spec: 200 for Bots, 202 for Humans
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({error: ILL_MOVE});
    }
};
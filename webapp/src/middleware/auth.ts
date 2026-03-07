import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const NOT_A_TOKEN: string = "Unauthorized: no valid token was found.";
    const INV_TOKEN: string = "Unauthorized: Invalid token.";

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: NOT_A_TOKEN });
    return;
    }

    const token = authHeader.split(' ')[1];
    try {
    // In a real project, the secret comes from process.env.JWT_SECRET
    const decoded = jwt.verify(token, 'your_shared_secret');
    (req as any).user = decoded; // Attach user info to the request
    next();
    } catch (error) {
    res.status(401).json({ message: INV_TOKEN });
}
};
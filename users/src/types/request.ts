import { Request } from 'express';

export type AuthRequest = Request & {
  user?: {
    id: number;
    username: string;
    role: string;
  };
};
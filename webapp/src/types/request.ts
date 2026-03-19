// types/request.ts
//
// Extends the Express Request type to carry the decoded JWT payload after
// the authMiddleware runs.  Imported by middleware/auth.ts and all controllers.
/*
import type { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
}
*/
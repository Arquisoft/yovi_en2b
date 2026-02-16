import { Response } from 'express';
import { AuthRequest } from '../types/request';
import { AuthService } from '../services/AuthService';


export class AuthController {
  // POST /auth/register
  static async register(req: AuthRequest, res: Response) {
    try {
      const { username, email, password } = req.body;

      if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const user = await AuthService.register(username, email, password);

      res.status(201).json({
        message: 'User registered successfully',
        user
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }


  // POST /auth/login
  static async login(req: AuthRequest, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const data = await AuthService.login(email, password);

      res.json({
        message: 'Login successful',
        ...data
      });
    } catch (error: any) {
      res.status(401).json({ error: error.message });
    }
  }


  // GET /auth/profile
  static async getProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;  // From authMiddleware
      const profile = await AuthService.getUserProfile(userId);

      res.json(profile);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }


  // PUT /auth/profile
  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { username, email } = req.body;

      const updatedUser = await AuthService.updateProfile(userId, { username, email });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }


  // PUT /auth/change-password
  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long' });
      }

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }


  // DELETE /auth/account
  static async deactivateAccount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await AuthService.deactivateAccount(userId);

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

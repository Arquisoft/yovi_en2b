import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';


const userRepository = AppDataSource.getRepository(User);
const JWT_SECRET = process.env.JWT_SECRET || 'please_dont_tell_anyone';


export class AuthService {
  static async register(username: string, email: string, password: string) {
    const existingUser = await userRepository.findOne({
      where: [{ email }, { username }]
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = userRepository.create({
      username,
      email,
      password: hashedPassword,
      role: 'player',
      isActive: true
    });

    await userRepository.save(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };
  }


  static async login(email: string, password: string) {
    const user = await userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'username', 'password', 'role', 'isActive']
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('User deactivated');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    user.lastLogin = new Date();
    await userRepository.save(user);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    };
  }


  static verifyToken(token: string): { id: number; username: string; role: string } {
    try {
      return jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }


  static async getUserProfile(userId: number) {
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'username', 'email', 'role', 'createdAt', 'lastLogin']
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }


  static async updateProfile(userId: number, updates: { username?: string; email?: string }) {
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    if (updates.username && updates.username !== user.username) {
      const existing = await userRepository.findOne({ where: { username: updates.username } });
      if (existing) throw new Error('Username already exists');
      user.username = updates.username;
    }

    if (updates.email && updates.email !== user.email) {
      const existing = await userRepository.findOne({ where: { email: updates.email } });
      if (existing) throw new Error('Email already exists');
      user.email = updates.email;
    }

    await userRepository.save(user);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
  }


  static async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const user = await userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password']
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await userRepository.save(user);

    return { message: 'Password updated successfully' };
  }


  static async deactivateAccount(userId: number) {
    const user = await userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    await userRepository.save(user);

    return { message: 'Account deactivated successfully' };
  }
}

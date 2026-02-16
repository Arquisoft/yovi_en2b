import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { TestDataSource } from './testDatabase';
import { User } from '../src/entities/User';

describe('Authentication API', () => {
  const testUser = {
    username: 'testplayer',
    email: 'test@example.com',
    password: 'password123'
  };

  let authToken: string;
  let userId: number;

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .set('Accept', 'application/json');

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('username', testUser.username);
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).toHaveProperty('role', 'player');
      expect(res.body.user).toHaveProperty('createdAt');
      expect(res.body.user).not.toHaveProperty('password'); // No debe exponer la contraseña
    });

    it('should return 400 if username is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: testUser.email, password: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'All fields are required');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: testUser.username, password: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'All fields are required');
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: testUser.username, email: testUser.email })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'All fields are required');
    });

    it('should return 400 if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, password: '12345' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Password must be at least 6 characters long');
    });

    it('should return 400 if username already exists', async () => {
      // Primero crear un usuario
      await request(app).post('/api/auth/register').send(testUser);

      // Intentar crear otro con el mismo username
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'different@example.com' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Username or email already exists');
    });

    it('should return 400 if email already exists', async () => {
      // Primero crear un usuario
      await request(app).post('/api/auth/register').send(testUser);

      // Intentar crear otro con el mismo email
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, username: 'differentuser' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Username or email already exists');
    });

    it('should return 400 for invalid JSON', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send('invalid json')
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Invalid JSON');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Crear usuario antes de cada test de login
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Login successful');
      expect(res.body).toHaveProperty('token');
      expect(res.body.token).toMatch(/^eyJ/); // JWT empieza con 'eyJ'
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('id');
      expect(res.body.user).toHaveProperty('username', testUser.username);
      expect(res.body.user).toHaveProperty('email', testUser.email);
      expect(res.body.user).toHaveProperty('role', 'player');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should return 400 if email is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email and password are required');
    });

    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email and password are required');
    });

    it('should return 401 for non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 401 for incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'wrongpassword' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 401 for deactivated user', async () => {
      // Desactivar el usuario
      const userRepository = TestDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email: testUser.email } });
      if (user) {
        user.isActive = false;
        await userRepository.save(user);
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'User deactivated');
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      // Registrar y hacer login para obtener token
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      authToken = loginRes.body.token;
      userId = loginRes.body.user.id;
    });

    it('should get user profile with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('id', userId);
      expect(res.body).toHaveProperty('username', testUser.username);
      expect(res.body).toHaveProperty('email', testUser.email);
      expect(res.body).toHaveProperty('role', 'player');
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('lastLogin');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 401 if no token provided', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'No authentication token provided');
    });

    it('should return 401 for invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid or expired token');
    });

    it('should return 403 for deactivated user', async () => {
      // Desactivar el usuario
      const userRepository = TestDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { id: userId } });
      if (user) {
        user.isActive = false;
        await userRepository.save(user);
      }

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Account deactivated');
    });
  });

  describe('PUT /api/auth/profile', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      authToken = loginRes.body.token;
      userId = loginRes.body.user.id;
    });

    it('should update username successfully', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'newusername' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Profile updated successfully');
      expect(res.body.user).toHaveProperty('username', 'newusername');
    });

    it('should update email successfully', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Profile updated successfully');
      expect(res.body.user).toHaveProperty('email', 'newemail@example.com');
    });

    it('should update both username and email', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'newusername', email: 'newemail@example.com' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body.user).toHaveProperty('username', 'newusername');
      expect(res.body.user).toHaveProperty('email', 'newemail@example.com');
    });

    it('should return 400 if username already exists', async () => {
      // Crear otro usuario
      await request(app).post('/api/auth/register').send({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: 'existinguser' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Username already exists');
    });

    it('should return 400 if email already exists', async () => {
      // Crear otro usuario
      await request(app).post('/api/auth/register').send({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'existing@example.com' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Email already exists');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ username: 'newusername' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      authToken = loginRes.body.token;
    });

    it('should change password successfully', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: testUser.password, newPassword: 'newpassword123' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Password updated successfully');

      // Verificar que puede hacer login con la nueva contraseña
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'newpassword123' });

      expect(loginRes.status).toBe(200);
    });

    it('should return 400 if currentPassword is missing', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ newPassword: 'newpassword123' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Current and new password are required');
    });

    it('should return 400 if newPassword is missing', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: testUser.password })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Current and new password are required');
    });

    it('should return 400 if new password is too short', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: testUser.password, newPassword: '12345' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'New password must be at least 6 characters long');
    });

    it('should return 400 if current password is incorrect', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword123' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Current password is incorrect');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .send({ currentPassword: testUser.password, newPassword: 'newpassword123' })
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/auth/account', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      authToken = loginRes.body.token;
      userId = loginRes.body.user.id;
    });

    it('should deactivate account successfully', async () => {
      const res = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Account deactivated successfully');

      // Verificar que no puede hacer login con cuenta desactivada
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body).toHaveProperty('error', 'User deactivated');
    });

    it('should return 401 without token', async () => {
      const res = await request(app)
        .delete('/api/auth/account')
        .set('Accept', 'application/json');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const res = await request(app)
        .get('/health')
        .set('Accept', 'application/json');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});

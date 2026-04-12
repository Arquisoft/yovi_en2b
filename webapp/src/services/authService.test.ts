import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from './authService'

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('AuthService', () => {
  describe('login', () => {
    it('returns a session with user, token and expiresAt on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-token', user: mockUser }),
      } as Response)

      const session = await authService.login({ email: 'test@example.com', password: 'pass' })

      expect(session.user).toEqual(mockUser)
      expect(session.token).toBe('jwt-token')
      expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now())
    })

    it('sets expiresAt roughly 7 days from now', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-token', user: mockUser }),
      } as Response)

      const before = Date.now()
      const session = await authService.login({ email: 'test@example.com', password: 'pass' })
      const after = Date.now()

      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      const expiresAt = new Date(session.expiresAt).getTime()
      expect(expiresAt).toBeGreaterThanOrEqual(before + sevenDaysMs)
      expect(expiresAt).toBeLessThanOrEqual(after + sevenDaysMs)
    })

    it('throws using data.message when present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid credentials' }),
      } as Response)

      await expect(authService.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
    })

    it('throws using data.error as fallback when message is absent', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' }),
      } as Response)

      await expect(authService.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow('Unauthorized')
    })

    it('throws generic message when neither message nor error is present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)

      await expect(authService.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow('Request failed')
    })

    it('calls POST /auth/login with credentials as JSON body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt-token', user: mockUser }),
      } as Response)

      await authService.login({ email: 'test@example.com', password: 'mypassword' })

      const [url, options] = vi.mocked(fetch).mock.calls[0]
      expect(String(url)).toContain('/auth/login')
      expect(options?.method).toBe('POST')
      expect(JSON.parse(options?.body as string)).toEqual({
        email: 'test@example.com',
        password: 'mypassword',
      })
    })
  })

  describe('register', () => {
    it('throws immediately when passwords do not match, without calling fetch', async () => {
      await expect(
        authService.register({
          username: 'user',
          email: 'user@example.com',
          password: 'pass1',
          passwordConfirm: 'pass2',
        })
      ).rejects.toThrow('Passwords do not match')

      expect(fetch).not.toHaveBeenCalled()
    })

    it('calls register endpoint then login and returns session', async () => {
      // First call: register (no token returned by backend)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'User created' }),
      } as Response)
      // Second call: auto-login
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'new-jwt', user: mockUser }),
      } as Response)

      const session = await authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'mypassword',
        passwordConfirm: 'mypassword',
      })

      expect(fetch).toHaveBeenCalledTimes(2)
      expect(session.token).toBe('new-jwt')
      expect(session.user).toEqual(mockUser)
    })

    it('sends only username, email, password to register endpoint (omits passwordConfirm)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'jwt', user: mockUser }),
      } as Response)

      await authService.register({
        username: 'u',
        email: 'u@e.com',
        password: 'pass',
        passwordConfirm: 'pass',
      })

      const registerBody = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(registerBody).not.toHaveProperty('passwordConfirm')
      expect(registerBody).toMatchObject({ username: 'u', email: 'u@e.com', password: 'pass' })
    })

    it('throws when register endpoint returns an error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Email already in use' }),
      } as Response)

      await expect(
        authService.register({
          username: 'u',
          email: 'taken@example.com',
          password: 'pass',
          passwordConfirm: 'pass',
        })
      ).rejects.toThrow('Email already in use')

      // Login should not be called if register fails
      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('getProfile', () => {
    it('returns the user profile', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      } as Response)

      const profile = await authService.getProfile('my-token')

      expect(profile).toEqual(mockUser)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer my-token' }),
        })
      )
    })

    it('throws on unauthorized', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Token expired' }),
      } as Response)

      await expect(authService.getProfile('expired-token')).rejects.toThrow('Token expired')
    })
  })

  describe('updateProfile', () => {
    it('returns the updated user from response.user', async () => {
      const updated = { ...mockUser, username: 'newname' }
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Profile updated', user: updated }),
      } as Response)

      const result = await authService.updateProfile('my-token', { username: 'newname' })

      expect(result.username).toBe('newname')
    })

    it('sends Authorization header and data in body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'ok', user: mockUser }),
      } as Response)

      await authService.updateProfile('my-token', { email: 'new@example.com' })

      const [, options] = vi.mocked(fetch).mock.calls[0]
      expect(options?.method).toBe('PUT')
      expect((options?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
      expect(JSON.parse(options?.body as string)).toEqual({ email: 'new@example.com' })
    })
  })

  describe('changePassword', () => {
    it('resolves without returning a value on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Password changed' }),
      } as Response)

      await expect(authService.changePassword('my-token', 'oldpass', 'newpass')).resolves.toBeUndefined()
    })

    it('sends current and new password in body', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      await authService.changePassword('my-token', 'oldpass', 'newpass')

      const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string)
      expect(body).toEqual({ currentPassword: 'oldpass', newPassword: 'newpass' })
    })

    it('throws when current password is wrong', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Current password is incorrect' }),
      } as Response)

      await expect(authService.changePassword('my-token', 'wrongpass', 'newpass'))
        .rejects.toThrow('Current password is incorrect')
    })
  })

  describe('deleteAccount', () => {
    it('resolves without returning a value on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Account deleted' }),
      } as Response)

      await expect(authService.deleteAccount('my-token')).resolves.toBeUndefined()
    })

    it('calls DELETE /auth/account with Authorization header', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)

      await authService.deleteAccount('my-token')

      const [url, options] = vi.mocked(fetch).mock.calls[0]
      expect(String(url)).toContain('/auth/account')
      expect(options?.method).toBe('DELETE')
      expect((options?.headers as Record<string, string>)?.Authorization).toBe('Bearer my-token')
    })

    it('throws when server returns an error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Account not found' }),
      } as Response)

      await expect(authService.deleteAccount('my-token')).rejects.toThrow('Account not found')
    })
  })
})

import type { User, AuthSession, LoginCredentials, RegisterCredentials } from '@/types'

//const API_BASE_URL = "http://api.localhost/users/api"
const API_BASE_URL = "https://api.micrati.com/users/api";

class AuthService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Request failed')
    }

    return data
  }

  private authHeaders(token: string): HeadersInit {
    return {
      Authorization: `Bearer ${token}`,
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const response = await this.request<{ token: string; user: User }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      }
    )

    return {
      user: response.user,
      token: response.token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    if (credentials.password !== credentials.passwordConfirm) {
      throw new Error('Passwords do not match')
    }

    // Backend only registers, does not return a token
    await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
      }),
    })

    // Obtain token by logging in automatically after successful registration
    return this.login({
      email: credentials.email,
      password: credentials.password,
    })
  }

  async getProfile(token: string): Promise<User> {
    return this.request('/auth/profile', {
      method: 'GET',
      headers: this.authHeaders(token),
    })
  }

  async updateProfile(token: string, data: Partial<User>): Promise<User> {
    const response = await this.request<{ message: string; user: User }>(
      '/auth/profile',
      {
        method: 'PUT',
        headers: this.authHeaders(token),
        body: JSON.stringify(data),
      }
    )

    return response.user
  }

  async changePassword(
    token: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    await this.request('/auth/change-password', {
      method: 'PUT',
      headers: this.authHeaders(token),
      body: JSON.stringify({ currentPassword, newPassword }),
    })
  }

  async deleteAccount(token: string): Promise<void> {
    await this.request('/auth/account', {
      method: 'DELETE',
      headers: this.authHeaders(token),
    })
  }
}

export const authService = new AuthService(API_BASE_URL)

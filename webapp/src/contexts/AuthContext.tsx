import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, AuthSession as _AuthSession, LoginCredentials, RegisterCredentials } from '@/types'
import { authService } from '@/services/authService'
import { storage } from '@/utils'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'yovi_token'
const USER_KEY = 'yovi_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = storage.get<string>(TOKEN_KEY)

      if (storedToken) {
        try {
          // Verify token by fetching profile
          const profile = await authService.getProfile(storedToken)
          setUser(profile)
          setToken(storedToken)
        } catch {
          // Token is invalid, clear storage
          storage.remove(TOKEN_KEY)
          storage.remove(USER_KEY)
        }
      }

      setIsLoading(false)
    }

    initAuth()
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await authService.login(credentials)
    setUser(session.user)
    setToken(session.token)
    storage.set(TOKEN_KEY, session.token)
    storage.set(USER_KEY, session.user)
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const session = await authService.register(credentials)
    setUser(session.user)
    setToken(session.token)
    storage.set(TOKEN_KEY, session.token)
    storage.set(USER_KEY, session.user)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    storage.remove(TOKEN_KEY)
    storage.remove(USER_KEY)
  }, [])

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!token) throw new Error('Not authenticated')
    const updated = await authService.updateProfile(token, data)
    setUser(updated)
    storage.set(USER_KEY, updated)
  }, [token])

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

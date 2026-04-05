import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, AuthSession as _AuthSession, LoginCredentials, RegisterCredentials } from '@/types'
import { authService } from '@/services/authService'
import { storage, generateId } from '@/utils'

export const GUEST_TOKEN = 'guest'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isGuest: boolean
  isLoading: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  loginAsGuest: () => void
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'yovi_token'
const USER_KEY  = 'yovi_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]           = useState<User | null>(null)
  const [token, setToken]         = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = storage.get<string>(TOKEN_KEY)

      if (!storedToken) {
        setIsLoading(false)
        return
      }

      if (storedToken === GUEST_TOKEN) {
        const storedUser = storage.get<User>(USER_KEY)
        if (storedUser) {
          setUser(storedUser)
          setToken(GUEST_TOKEN)
        }
        setIsLoading(false)
        return
      }

      try {
        const profile = await authService.getProfile(storedToken)
        setUser(profile)
        setToken(storedToken)
      } catch {
        storage.remove(TOKEN_KEY)
        storage.remove(USER_KEY)
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

  const loginAsGuest = useCallback(() => {
    const guestUser: User = {
      id:        `guest-${generateId()}`,
      username:  'Guest',
      email:     '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setUser(guestUser)
    setToken(GUEST_TOKEN)
    storage.set(TOKEN_KEY, GUEST_TOKEN)
    storage.set(USER_KEY, guestUser)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    storage.remove(TOKEN_KEY)
    storage.remove(USER_KEY)
  }, [])

  const updateProfile = useCallback(async (data: Partial<User>) => {
    if (!token || token === GUEST_TOKEN) throw new Error('Not authenticated')
    const updated = await authService.updateProfile(token, data)
    setUser(updated)
    storage.set(USER_KEY, updated)
  }, [token])

  const isGuest = token === GUEST_TOKEN

  const value: AuthContextValue = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isGuest,
    isLoading,
    login,
    register,
    loginAsGuest,
    logout,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
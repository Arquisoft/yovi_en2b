import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface LocationState {
  from?: { pathname: string }
}

export function useLoginController() {
  const { login, loginAsGuest } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const getDestination = (): string => {
    const state = location.state as LocationState
    return state?.from?.pathname || '/games'
  }

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      setError(null)
      try {
        await login({ email, password })
        navigate(getDestination(), { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed')
      } finally {
        setIsLoading(false)
      }
    },
    [login, navigate, location],
  )

  const handleGuestLogin = useCallback(() => {
    loginAsGuest()
    navigate(getDestination(), { replace: true })
  }, [loginAsGuest, navigate, location])

  return {
    isLoading,
    error,
    handleLogin,
    handleGuestLogin,
  }
}
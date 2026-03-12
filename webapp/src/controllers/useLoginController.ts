import { useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface LocationState {
  from?: { pathname: string }
}

export function useLoginController() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      setError(null)

      try {
        await login({ email, password })
        
        // Navigate to the page they tried to access, or games page
        const state = location.state as LocationState
        const from = state?.from?.pathname || '/games'
        navigate(from, { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed')
      } finally {
        setIsLoading(false)
      }
    },
    [login, navigate, location]
  )

  return {
    isLoading,
    error,
    handleLogin,
  }
}

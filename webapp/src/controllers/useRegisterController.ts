import { useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export function useRegisterController() {
  const { register } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleRegister = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      passwordConfirm: string
    ) => {
      setIsLoading(true)
      setError(null)

      try {
        await register({ username, email, password, passwordConfirm })
        setSuccess(true)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Registration failed')
      } finally {
        setIsLoading(false)
      }
    },
    [register]
  )

  return {
    isLoading,
    error,
    success,
    handleRegister,
  }
}

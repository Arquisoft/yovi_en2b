import { LoginForm } from '@/components/LoginForm'
import { useLoginController } from '@/controllers/useLoginController'

export function LoginPage() {
  const { isLoading, error, handleLogin, handleGuestLogin } = useLoginController()

  return (
    <LoginForm
      onSubmit={handleLogin}
      onGuestLogin={handleGuestLogin}
      isLoading={isLoading}
      error={error}
    />
  )
}
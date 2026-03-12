import { LoginForm } from '@/components/LoginForm'
import { useLoginController } from '@/controllers/useLoginController'

export function LoginPage() {
  const { isLoading, error, handleLogin } = useLoginController()

  return (
    <LoginForm
      onSubmit={handleLogin}
      isLoading={isLoading}
      error={error}
    />
  )
}

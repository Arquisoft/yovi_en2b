import { RegisterForm } from '@/components/RegisterForm'
import { useRegisterController } from '@/controllers/useRegisterController'

export function RegisterPage() {
  const { isLoading, error, success, handleRegister } = useRegisterController()

  return (
    <RegisterForm
      onSubmit={handleRegister}
      isLoading={isLoading}
      error={error}
      success={success}
    />
  )
}

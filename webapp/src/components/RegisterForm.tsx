import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card'
import { isValidEmail, validatePassword } from '@/utils'
import { AlertCircle, Hexagon, CheckCircle, Eye, EyeOff } from 'lucide-react'

interface RegisterFormProps {
  onSubmit: (username: string, email: string, password: string, passwordConfirm: string) => Promise<void>
  isLoading: boolean
  error: string | null
  success: boolean
}

export function RegisterForm({ onSubmit, isLoading, error, success }: RegisterFormProps) {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    email?: string
    password?: string
    passwordConfirm?: string
  }>({})

  const validate = (): boolean => {
    const errors: typeof validationErrors = {}

    if (!username) {
      errors.username = t('auth.usernameRequired')
    } else if (username.length < 3) {
      errors.username = t('auth.usernameMinLength')
    }

    if (!email) {
      errors.email = t('auth.emailRequired')
    } else if (!isValidEmail(email)) {
      errors.email = t('auth.emailInvalid')
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.valid) {
      errors.password = t('auth.passwordMinLength')
    }

    if (password !== passwordConfirm) {
      errors.passwordConfirm = t('auth.passwordsDoNotMatch')
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    await onSubmit(username, email, password, passwordConfirm)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl">{t('auth.accountCreatedTitle')}</CardTitle>
            <CardDescription>{t('auth.accountCreatedDescription')}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/games" className="w-full">
              <Button className="w-full">{t('auth.startPlaying')}</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Hexagon className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('auth.createAccountTitle')}</CardTitle>
          <CardDescription>{t('auth.createAccountSubtitle')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" error={!!validationErrors.username}>
                {t('auth.username')}
              </Label>
              <Input
                id="username"
                type="text"
                placeholder={t('auth.usernamePlaceholder')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                error={!!validationErrors.username}
                disabled={isLoading}
                autoComplete="username"
              />
              {validationErrors.username && (
                <p className="text-sm text-destructive">{validationErrors.username}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" error={!!validationErrors.email}>
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!validationErrors.email}
                disabled={isLoading}
                autoComplete="email"
              />
              {validationErrors.email && (
                <p className="text-sm text-destructive">{validationErrors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" error={!!validationErrors.password}>
                {t('auth.password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={!!validationErrors.password}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-sm text-destructive">{validationErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" error={!!validationErrors.passwordConfirm}>
                {t('auth.confirmPassword')}
              </Label>
              <div className="relative">
                <Input
                  id="passwordConfirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  error={!!validationErrors.passwordConfirm}
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPasswordConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {validationErrors.passwordConfirm && (
                <p className="text-sm text-destructive">{validationErrors.passwordConfirm}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" isLoading={isLoading}>
              {t('auth.createAccount')}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline">
                {t('auth.signInLink')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
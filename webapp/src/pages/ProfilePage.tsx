import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProfileController } from '@/controllers/useProfileController'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ArrowLeft, CheckCircle, AlertCircle, User, Lock } from 'lucide-react'

export function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    user,
    username, setUsername,
    email, setEmail,
    infoError, infoSuccess, infoLoading,
    handleUpdateInfo,
    currentPassword, setCurrentPassword,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    passError, passSuccess, passLoading,
    handleChangePassword,
  } = useProfileController()

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
      </div>

      {/* Account info */}
      <div className="flex items-center gap-3 px-1">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-6 h-6 text-primary" />
        </div>
        <div>
          <p className="font-semibold">{user?.username}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* ── Update username & email ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            {t('profile.infoTitle')}
          </CardTitle>
          <CardDescription>{t('profile.infoDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {infoError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{infoError}</span>
            </div>
          )}

          {infoSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{t('profile.infoSuccess')}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">{t('auth.username')}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePlaceholder')}
              disabled={infoLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.emailPlaceholder')}
              disabled={infoLoading}
            />
          </div>

          <Button
            onClick={handleUpdateInfo}
            isLoading={infoLoading}
            className="w-full sm:w-auto"
          >
            {t('profile.saveInfo')}
          </Button>
        </CardContent>
      </Card>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            {t('profile.passwordTitle')}
          </CardTitle>
          <CardDescription>{t('profile.passwordDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {passError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{passError}</span>
            </div>
          )}

          {passSuccess && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{t('profile.passwordSuccess')}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              disabled={passLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              disabled={passLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={passLoading}
            />
          </div>

          <Button
            onClick={handleChangePassword}
            isLoading={passLoading}
            className="w-full sm:w-auto"
          >
            {t('profile.savePassword')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
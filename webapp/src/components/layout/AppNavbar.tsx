import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/Button'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/i18n'
import { Sun, Moon, LogOut, User, Hexagon, BarChart2, Trophy } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { useTranslation } from 'react-i18next'
 

export function AppNavbar() {
  const { user, logout, isGuest } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { locale, setLanguage } = useLanguage()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)

  const handleLogoutConfirm = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-14 items-center justify-between px-4">
        <Link to="/games" className="flex items-center gap-2">
          <Hexagon className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">{t('app.name')}</span>
        </Link>

        <nav className="flex items-center gap-2">
         <select
            value={locale}
            onChange={(e) => setLanguage(e.target.value as SupportedLocale)}
            className="bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm appearance-none"
          >
            {SUPPORTED_LOCALES.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('nav.toggleTheme')}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user.username}</span>
                {isGuest && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground leading-none">
                    {t('nav.guestBadge')}
                  </span>
                )}
              </div>

              <Button variant="ghost" size="icon" onClick={() => navigate('/stats')} aria-label={t('nav.statistics')}>
                <BarChart2 className="h-5 w-5" />
              </Button>

              <Button variant="ghost" size="icon" onClick={() => navigate('/ranking')} aria-label={t('nav.ranking')}>
                <Trophy className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLogoutDialog(true)}
                aria-label={t('nav.logout')}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          )}
        </nav>
      </div>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out</DialogTitle>
            <DialogDescription>
              {t('nav.signOutConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
               {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleLogoutConfirm}>
              {t('nav.signOut')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  )
}
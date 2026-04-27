import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useLanguage } from '@/i18n/LanguageContext'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipProvider } from '@/components/ui/Tooltip'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/i18n'
import {
  Sun, Moon, LogOut, User, Hexagon, BarChart2, Trophy, Clock, Menu, X,
} from 'lucide-react'
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
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogoutConfirm = () => {
    logout()
    navigate('/login')
  }

  const go = (path: string) => {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/games" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
          <Hexagon className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">{t('app.name')}</span>
        </Link>

        {/* ── Desktop nav ─────────────────────────────────────────────────── */}
        <TooltipProvider delayDuration={400}>
          <nav className="hidden sm:flex items-center gap-2">
            <select
              value={locale}
              onChange={(e) => setLanguage(e.target.value as SupportedLocale)}
              className="bg-background text-foreground border border-border rounded-md px-2 py-1 text-sm appearance-none"
            >
              {SUPPORTED_LOCALES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>

            <Tooltip label={t('nav.toggleTheme')}>
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('nav.toggleTheme')}>
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
            </Tooltip>

            {user && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => !isGuest && navigate('/profile')}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={t('nav.profile')}
                  disabled={isGuest}
                >
                  <User className="h-4 w-4" />
                  <span>{user.username}</span>
                  {isGuest && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground leading-none">
                      {t('nav.guestBadge')}
                    </span>
                  )}
                </button>

                <Tooltip label={t('nav.statistics')}>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/stats')} aria-label={t('nav.statistics')}>
                    <BarChart2 className="h-5 w-5" />
                  </Button>
                </Tooltip>

                <Tooltip label={t('nav.history')}>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/history')} aria-label={t('nav.history')}>
                    <Clock className="h-5 w-5" />
                  </Button>
                </Tooltip>

                <Tooltip label={t('nav.ranking')}>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/ranking')} aria-label={t('nav.ranking')}>
                    <Trophy className="h-5 w-5" />
                  </Button>
                </Tooltip>

                <Tooltip label={t('nav.logout')}>
                  <Button variant="ghost" size="icon" onClick={() => setShowLogoutDialog(true)} aria-label={t('nav.logout')}>
                    <LogOut className="h-5 w-5" />
                  </Button>
                </Tooltip>
              </div>
            )}
          </nav>
        </TooltipProvider>

        {/* ── Mobile hamburger ─────────────────────────────────────────────── */}
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* ── Mobile slide-down menu ───────────────────────────────────────────── */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border bg-background/95 backdrop-blur px-4 py-3 space-y-1">
          {user && (
            <button
              onClick={() => !isGuest && go('/profile')}
              disabled={isGuest}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors disabled:opacity-50"
            >
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{user.username}</span>
                {isGuest && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full border border-border bg-muted text-muted-foreground leading-none shrink-0">
                    {t('nav.guestBadge')}
                  </span>
                )}
              </div>
            </button>
          )}

          <div className="h-px bg-border my-1" />

          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4 shrink-0 text-muted-foreground" />
              : <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />}
            <span>{t('nav.toggleTheme')}</span>
          </button>

          {user && (
            <>
              <button onClick={() => go('/stats')} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors">
                <BarChart2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{t('nav.statistics')}</span>
              </button>

              <button onClick={() => go('/history')} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{t('nav.history')}</span>
              </button>

              <button onClick={() => go('/ranking')} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors">
                <Trophy className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{t('nav.ranking')}</span>
              </button>
            </>
          )}

          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t('nav.language')}</span>
            <select
              value={locale}
              onChange={(e) => setLanguage(e.target.value as SupportedLocale)}
              className="bg-background text-foreground border border-border rounded-md px-2 py-1 text-xs appearance-none"
            >
              {SUPPORTED_LOCALES.map((lang) => (
                <option key={lang} value={lang}>{lang.toUpperCase()}</option>
              ))}
            </select>
          </div>

          {user && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { setMenuOpen(false); setShowLogoutDialog(true) }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>{t('nav.logout')}</span>
              </button>
            </>
          )}
        </div>
      )}

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

import { useTranslation } from 'react-i18next'
import { useOnlineHostLobbyController } from '@/controllers/useOnlineHostLobbyController'
import { Button } from '@/components/ui/Button'
import { Copy, Check, Wifi, WifiOff, UserCheck, AlertCircle } from 'lucide-react'

export function OnlineHostLobbyPage() {
  const { t } = useTranslation()
  const {
    status,
    roomCode,
    opponentName,
    error,
    copied,
    variant,
    handleCancel,
    handleCopy,
    handleRetry,
  } = useOnlineHostLobbyController()

  const variantName = t(`variants.${variant}.name`, { defaultValue: variant })
  const showVariantBadge = status !== 'error'

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-6 max-w-sm w-full">

        {showVariantBadge && (
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground">
            {t('online.variantLabel', { name: variantName })}
          </div>
        )}

        {/* ── CONNECTING ────────────────────────────────────────────────── */}
        {status === 'connecting' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wifi className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('online.connecting')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('online.connectingHint')}</p>
            </div>
          </div>
        )}

        {/* ── WAITING (room code displayed) ─────────────────────────────── */}
        {status === 'waiting' && roomCode && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">{t('online.waitingForOpponent')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('online.waitingForOpponentHint')}</p>
            </div>

            {/* Room code display */}
            <div className="rounded-xl border bg-card p-6 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                {t('online.roomCode')}
              </p>
              <p className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.25em] text-primary select-all">
                {roomCode}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="w-full gap-2"
              >
                {copied ? (
                  <><Check className="w-4 h-4 text-green-500" />{t('online.codeCopied')}</>
                ) : (
                  <><Copy className="w-4 h-4" />{t('online.copyCode')}</>
                )}
              </Button>
            </div>

            {/* Spinner */}
            <div className="flex justify-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>

            <Button variant="outline" onClick={handleCancel} className="w-full">
              {t('online.cancelRoom')}
            </Button>
          </div>
        )}

        {/* ── MATCHED ───────────────────────────────────────────────────── */}
        {status === 'matched' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-500">{t('online.matched')}</h2>
              {opponentName && (
                <p className="text-muted-foreground mt-1">
                  {t('online.playingAgainst', { name: opponentName })}
                </p>
              )}
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full" />
            </div>
          </div>
        )}

        {/* ── ERROR ─────────────────────────────────────────────────────── */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-destructive">{t('online.connectionError')}</h2>
              {error && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                {t('common.back')}
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                {t('online.tryAgain')}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

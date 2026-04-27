import { useTranslation } from 'react-i18next'
import { useOnlineRoomController } from '@/controllers/useOnlineRoomController'
import { Button } from '@/components/ui/Button'
import { Plus, Hash, Wifi, WifiOff, UserCheck, AlertCircle, ArrowLeft } from 'lucide-react'

export function OnlineRoomPage() {
  const { t } = useTranslation()
  const {
    codeInput,
    setCodeInput,
    joinStatus,
    error,
    hostName,
    matchedVariant,
    handleCreateRoom,
    handleJoin,
    handleCancel,
    handleRetry,
    isGuest,
  } = useOnlineRoomController()

  const matchedVariantName = t(`variants.${matchedVariant}.name`, { defaultValue: matchedVariant })

  // Idle state: matches the container layout used by GameModePage / GameConfigPage
  if (joinStatus === 'idle') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Button variant="ghost" onClick={handleCancel} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('gameModes.backToGames')}
          </Button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">{t('online.title')}</h1>
            <p className="text-muted-foreground">{t('online.subtitle')}</p>
          </div>

          <div className="space-y-4">
            {/* ── CREATE ROOM card ─────────────────────────────────────── */}
            <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold">{t('online.createRoom')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('online.createRoomDescription')}
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={handleCreateRoom}>
                {t('online.createRoom')}
              </Button>
            </div>

            {/* ── JOIN ROOM card ────────────────────────────────────────── */}
            <div className="rounded-xl border bg-card p-6 space-y-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                  <Hash className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h2 className="font-semibold">{t('online.joinRoom')}</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t('online.joinRoomDescription')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder={t('online.roomCodePlaceholder')}
                  className="flex-1 h-10 px-3 rounded-md border bg-background text-sm font-mono tracking-widest uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-ring"
                  maxLength={6}
                  disabled={isGuest}
                  onKeyDown={(e) => e.key === 'Enter' && codeInput.length === 6 && handleJoin()}
                />
                <Button
                  onClick={handleJoin}
                  disabled={codeInput.length < 6 || isGuest}
                  variant="outline"
                >
                  {t('online.join')}
                </Button>
              </div>
              {isGuest && (
                <p className="text-xs text-muted-foreground">{t('online.guestCannotJoin')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Non-idle states: centered, matches OnlineLobbyPage style
  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-6 max-w-sm w-full">

        {/* ── JOINING ──────────────────────────────────────────────────── */}
        {(joinStatus === 'connecting' || joinStatus === 'waiting') && (
          <>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wifi className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('online.joiningRoom')}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t('online.connectingHint')}</p>
            </div>
            <Button variant="outline" onClick={handleCancel} className="w-full">
              {t('common.cancel')}
            </Button>
          </>
        )}

        {/* ── MATCHED ──────────────────────────────────────────────────── */}
        {joinStatus === 'matched' && (
          <div className="animate-in fade-in zoom-in duration-300 space-y-4">
            <div className="inline-flex items-center justify-center px-3 py-1 rounded-full border border-border bg-muted/50 text-xs font-medium text-muted-foreground">
              {t('online.variantLabel', { name: matchedVariantName })}
            </div>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-500">{t('online.matched')}</h2>
              {hostName && (
                <p className="text-muted-foreground mt-1">
                  {t('online.joinedHost', { name: hostName })}
                </p>
              )}
            </div>
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full" />
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────── */}
        {joinStatus === 'error' && (
          <>
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
          </>
        )}

      </div>
    </div>
  )
}

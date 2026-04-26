import { useTranslation } from 'react-i18next'
import { useOnlineLobbyController } from '@/controllers/useOnlineLobbyController'
import { Button } from '@/components/ui/Button'
import { Wifi, WifiOff, UserCheck, AlertCircle } from 'lucide-react'

export function OnlineLobbyPage() {
  const { t } = useTranslation()
  const { 
    status, 
    opponentName, 
    error, 
    queueSize, 
    leaveQueue, 
    retry 
  } = useOnlineLobbyController()

  return (
    <div className="flex items-center justify-center h-full p-4">
      <div className="text-center space-y-6 max-w-sm w-full">
        
        {/* --- ESTADO: CONNECTING --- */}
        {status === 'connecting' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wifi className="w-8 h-8 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('online.connecting')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('online.connectingHint')}
              </p>
            </div>
          </div>
        )}

        {/* --- ESTADO: QUEUING (En cola) --- */}
        {status === 'queuing' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="relative w-16 h-16">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">
                    {queueSize > 1 ? queueSize : ''}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t('online.lookingForOpponent')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('online.lookingHint')}
              </p>
            </div>
            <Button variant="outline" onClick={leaveQueue} className="w-full">
              {t('online.leaveQueue')}
            </Button>
          </div>
        )}

        {/* --- ESTADO: MATCHED (Emparejado) --- */}
        {status === 'matched' && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-green-500">
                {t('online.matched')}
              </h2>
              <p className="text-muted-foreground mt-1">
                {t('online.playingAgainst', { name: opponentName })}
              </p>
            </div>
            {/* Barra de progreso visual para la transición */}
            <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary animate-pulse w-full" />
            </div>
          </div>
        )}

        {/* --- ESTADO: ERROR --- */}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-destructive">
                {t('online.connectionError')}
              </h2>
              {error && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={leaveQueue} className="flex-1">
                {t('common.back')}
              </Button>
              <Button onClick={retry} className="flex-1">
                {t('online.tryAgain')}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
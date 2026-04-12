import { useTranslation } from 'react-i18next'
import type { GameMode } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Users, Globe, Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/utils'

interface ModeCardProps {
  mode: GameMode
  onSelect: () => void
  disabled?: boolean
}

const modeIcons: Record<GameMode, typeof Users> = {
  'pvp-local': Users,
  'pvp-online': Globe,
  'pve': Bot,
}

const modeTranslationKeys: Record<GameMode, { title: string; description: string }> = {
  'pvp-local': {
    title: 'gameModes.pvpLocal.title',
    description: 'gameModes.pvpLocal.description',
  },
  'pvp-online': {
    title: 'gameModes.pvpOnline.title',
    description: 'gameModes.pvpOnline.description',
  },
  'pve': {
    title: 'gameModes.pve.title',
    description: 'gameModes.pve.description',
  },
}

export function ModeCard({ mode, onSelect, disabled }: ModeCardProps) {
  const { t } = useTranslation()
  const Icon = modeIcons[mode]
  const keys = modeTranslationKeys[mode]

  return (
    <Card
      className={cn(
        'transition-all',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer group hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5'
      )}
      onClick={!disabled ? onSelect : undefined}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          onSelect()
        }
      }}
    >
      <CardHeader>
        <div className={cn(
          'w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 transition-colors',
          !disabled && 'group-hover:bg-primary/20'
        )}>
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="flex items-center justify-between">
          {t(keys.title)}
          {disabled
            ? <span className="text-xs font-normal text-muted-foreground">{t('gameModes.soon')}</span>
            : <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          }
        </CardTitle>
        <CardDescription>{t(keys.description)}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className={cn(
            'h-full w-0 bg-primary transition-all duration-500',
            !disabled && 'group-hover:w-full'
          )} />
        </div>
      </CardContent>
    </Card>
  )
}
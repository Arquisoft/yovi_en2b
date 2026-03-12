import type { GameMode } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Users, Globe, Bot, ArrowRight } from 'lucide-react'
import { cn } from '@/utils'

interface ModeCardProps {
  mode: GameMode
  onSelect: () => void
}

const modeInfo: Record<GameMode, {
  title: string
  description: string
  icon: typeof Users
}> = {
  'pvp-local': {
    title: 'Local Match',
    description: 'Play against a friend on the same device. Take turns placing stones.',
    icon: Users,
  },
  'pvp-online': {
    title: 'Online Match',
    description: 'Challenge players from around the world in real-time matches.',
    icon: Globe,
  },
  'pve': {
    title: 'vs Computer',
    description: 'Practice your skills against an AI opponent at various difficulty levels.',
    icon: Bot,
  },
}

export function ModeCard({ mode, onSelect }: ModeCardProps) {
  const info = modeInfo[mode]
  const Icon = info.icon

  return (
    <Card
      className={cn(
        'cursor-pointer group hover:border-primary/50 transition-all',
        'hover:shadow-lg hover:shadow-primary/5'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect()
        }
      }}
    >
      <CardHeader>
        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="flex items-center justify-between">
          {info.title}
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </CardTitle>
        <CardDescription>{info.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full w-0 bg-primary group-hover:w-full transition-all duration-500" />
        </div>
      </CardContent>
    </Card>
  )
}

import type { GameInfo } from '@/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Users, Hexagon } from 'lucide-react'

interface GameCardProps {
  game: GameInfo
  onPlay: () => void
}

export function GameCard({ game, onPlay }: GameCardProps) {
  return (
    <Card className="overflow-hidden hover:border-primary/50 transition-colors">
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Hexagon className="w-20 h-20 text-primary/50" />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {game.name}
          <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
            <Users className="w-4 h-4" />
            {game.minPlayers === game.maxPlayers
              ? game.minPlayers
              : `${game.minPlayers}-${game.maxPlayers}`}
          </span>
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {game.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={onPlay}
          className="w-full"
          disabled={!game.isAvailable}
        >
          {game.isAvailable ? 'Play' : 'Coming Soon'}
        </Button>
      </CardContent>
    </Card>
  )
}

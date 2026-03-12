import type { RoomSummary } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Users, Clock, Grid3X3, Lock } from 'lucide-react'
import { formatTime } from '@/utils'

interface RoomCardProps {
  room: RoomSummary
  onJoin: () => void
  isJoining: boolean
}

export function RoomCard({ room, onJoin, isJoining }: RoomCardProps) {
  const isJoinable = room.status === 'waiting' && room.playerCount < room.maxPlayers

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {room.isPrivate && <Lock className="w-4 h-4 text-muted-foreground" />}
            {room.name}
          </span>
          <span className={`text-xs px-2 py-1 rounded-full ${
            room.status === 'waiting' 
              ? 'bg-green-500/10 text-green-500' 
              : 'bg-yellow-500/10 text-yellow-500'
          }`}>
            {room.status === 'waiting' ? 'Open' : 'In Progress'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {room.playerCount}/{room.maxPlayers}
          </span>
          <span className="flex items-center gap-1">
            <Grid3X3 className="w-4 h-4" />
            {room.boardSize}x{room.boardSize}
          </span>
          {room.timerSeconds && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {formatTime(room.timerSeconds * 1000)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Host: {room.host.username}
          </span>
          <Button
            size="sm"
            onClick={onJoin}
            disabled={!isJoinable || isJoining}
            isLoading={isJoining}
          >
            {isJoinable ? 'Join' : 'Full'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

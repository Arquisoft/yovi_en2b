import type { RoomSummary } from '@/types'
import { RoomCard } from './RoomCard'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface RoomListProps {
  rooms: RoomSummary[]
  isLoading: boolean
  joiningRoomId: string | null
  onJoin: (roomId: string) => void
  onRefresh: () => void
}

export function RoomList({
  rooms,
  isLoading,
  joiningRoomId,
  onJoin,
  onRefresh,
}: RoomListProps) {
  const waitingRooms = rooms.filter((r) => r.status === 'waiting')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Available Rooms</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {waitingRooms.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No rooms available</p>
          <p className="text-sm">Create a new room to start playing</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {waitingRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onJoin={() => onJoin(room.id)}
              isJoining={joiningRoomId === room.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

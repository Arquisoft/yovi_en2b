import { useNavigate } from 'react-router-dom'
import { useLobbyController } from '@/controllers/useLobbyController'
import { RoomList } from '@/components/RoomList'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Plus, Clock, Users, AlertCircle, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { formatTime } from '@/utils'

export function LobbyPage() {
  const navigate = useNavigate()
  const {
    rooms,
    currentRoom,
    isLoading,
    isJoining,
    error,
    handleRefresh,
    handleJoinRoom,
    handleLeaveRoom,
    handleCreateRoom,
  } = useLobbyController()
  
  const [copied, setCopied] = useState(false)

  // If we're in a waiting room, show the waiting UI
  if (currentRoom) {
    const handleCopyInvite = () => {
      const inviteUrl = `${window.location.origin}/games/y/lobby?roomId=${currentRoom.id}`
      navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Button variant="ghost" onClick={handleLeaveRoom} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Leave Room
          </Button>

          <Card>
            <CardHeader className="text-center">
              <CardTitle>{currentRoom.name}</CardTitle>
              <CardDescription>Waiting for opponent...</CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>

              <div className="flex justify-center gap-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {currentRoom.playerCount}/{currentRoom.maxPlayers}
                </span>
                {currentRoom.timerSeconds && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentRoom.timerSeconds * 1000)}
                  </span>
                )}
              </div>

              {currentRoom.isPrivate && currentRoom.inviteCode && (
                <div className="space-y-2">
                  <p className="text-sm text-center text-muted-foreground">
                    Share this link with your friend:
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCopyInvite}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Invite Link
                      </>
                    )}
                  </Button>
                </div>
              )}

              <p className="text-center text-sm text-muted-foreground">
                The game will start automatically when an opponent joins.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show lobby with room list
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/games/y')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Online Lobby</h1>
            <p className="text-muted-foreground">Join a room or create your own</p>
          </div>
          <Button onClick={handleCreateRoom}>
            <Plus className="w-4 h-4 mr-2" />
            Create Room
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm mb-4">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <RoomList
          rooms={rooms}
          isLoading={isLoading}
          joiningRoomId={isJoining}
          onJoin={handleJoinRoom}
          onRefresh={handleRefresh}
        />
      </div>
    </div>
  )
}

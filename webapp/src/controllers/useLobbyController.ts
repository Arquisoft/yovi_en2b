import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { RoomSummary, Room } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/contexts/RealtimeContext'
import { gameService } from '@/services/gameService'

export function useLobbyController() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const transport = useRealtime()
  
  const roomId = searchParams.get('roomId')
  
  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load rooms on mount
  useEffect(() => {
    const loadRooms = async () => {
      try {
        const roomList = await gameService.getRooms()
        setRooms(roomList)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rooms')
      } finally {
        setIsLoading(false)
      }
    }

    loadRooms()
  }, [])

  // If we have a roomId, load that room and start polling
  useEffect(() => {
    if (!roomId) return

    const loadRoom = async () => {
      try {
        const room = await gameService.getRoom(roomId)
        setCurrentRoom(room)
        
        // If room is full, start the game
        if (room && room.playerCount >= room.maxPlayers) {
          const game = await gameService.startGameFromRoom(roomId)
          navigate(`/games/y/play/${game.id}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room')
      }
    }

    loadRoom()

    // Start polling for room updates
    transport.startPolling({ type: 'room', roomId })

    const unsubscribe = transport.subscribe('roomUpdated', (event) => {
      const room = event.payload as Room
      setCurrentRoom(room)
      
      if (room.playerCount >= room.maxPlayers) {
        gameService.startGameFromRoom(roomId).then((game) => {
          navigate(`/games/y/play/${game.id}`)
        })
      }
    })

    return () => {
      transport.stopPolling({ type: 'room', roomId })
      unsubscribe()
    }
  }, [roomId, transport, navigate])

  // Poll for lobby updates
  useEffect(() => {
    if (roomId) return // Don't poll lobby if we're in a room

    transport.startPolling({ type: 'lobby' })

    const unsubscribe = transport.subscribe('lobbyUpdated', (event) => {
      setRooms(event.payload as RoomSummary[])
    })

    return () => {
      transport.stopPolling({ type: 'lobby' })
      unsubscribe()
    }
  }, [roomId, transport])

  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const roomList = await gameService.getRooms()
      setRooms(roomList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleJoinRoom = useCallback(
    async (roomIdToJoin: string) => {
      if (!user) return
      
      setIsJoining(roomIdToJoin)
      setError(null)

      try {
        const room = await gameService.joinRoom(roomIdToJoin, {
          id: user.id,
          name: user.username,
          color: 'player2',
        })
        
        if (room.playerCount >= room.maxPlayers) {
          const game = await gameService.startGameFromRoom(roomIdToJoin)
          navigate(`/games/y/play/${game.id}`)
        } else {
          navigate(`/games/y/lobby?roomId=${roomIdToJoin}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join room')
      } finally {
        setIsJoining(null)
      }
    },
    [user, navigate]
  )

  const handleLeaveRoom = useCallback(() => {
    navigate('/games/y/lobby')
  }, [navigate])

  const handleCreateRoom = useCallback(() => {
    navigate('/games/y/config/pvp-online')
  }, [navigate])

  return {
    rooms,
    currentRoom,
    isLoading,
    isJoining,
    error,
    handleRefresh,
    handleJoinRoom,
    handleLeaveRoom,
    handleCreateRoom,
  }
}

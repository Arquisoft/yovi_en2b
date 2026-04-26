import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'

export type RoomJoinStatus = 'idle' | 'connecting' | 'waiting' | 'matched' | 'error'

export function useOnlineRoomController() {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()

  const [codeInput, setCodeInput] = useState('')
  const [joinStatus, setJoinStatus] = useState<RoomJoinStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const mounted = useRef(true)
  const hasJoined = useRef(false)

  useEffect(() => {
    mounted.current = true

    const unsubMatched = wsService.on('matched', (data: any) => {
      if (!mounted.current) return
      setJoinStatus('matched')
      setTimeout(() => {
        if (mounted.current) navigate(`/games/y/play/${data.gameId}`)
      }, 1200)
    })

    const unsubError = wsService.on('error', (data: any) => {
      if (!mounted.current) return
      if (!hasJoined.current) return
      setJoinStatus('error')
      setError((data.message as string) ?? 'An error occurred')
    })

    return () => {
      mounted.current = false
      unsubMatched()
      unsubError()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const handleJoin = useCallback(async () => {
    const code = codeInput.trim().toUpperCase()
    if (!code || !token || isGuest) return

    setError(null)
    setJoinStatus('connecting')
    hasJoined.current = true

    try {
      if (!wsService.isConnected()) {
        await wsService.connect(token)
      }
      if (!mounted.current) return
      wsService.send({ type: 'join_room', code })
      setJoinStatus('waiting')
    } catch (err) {
      if (!mounted.current) return
      setJoinStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [codeInput, token, isGuest])

  const handleCreateRoom = useCallback(() => {
    navigate('/games/y/config/pvp-online')
  }, [navigate])

  const handleCancel = useCallback(() => {
    navigate('/games/y')
  }, [navigate])

  const handleRetry = useCallback(() => {
    setJoinStatus('idle')
    setError(null)
  }, [])

  return {
    codeInput,
    setCodeInput,
    joinStatus,
    error,
    handleCreateRoom,
    handleJoin,
    handleCancel,
    handleRetry,
    isGuest: isGuest ?? false,
  }
}

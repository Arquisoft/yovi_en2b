import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'
import { loadOnlineConfig } from '@/utils/onlineConfig'

export type HostLobbyStatus = 'connecting' | 'waiting' | 'matched' | 'error'

export function useOnlineHostLobbyController() {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<HostLobbyStatus>('connecting')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    if (!token || isGuest) {
      navigate('/login', { replace: true })
      return
    }

    const unsubCreated = wsService.on('room_created', (data: any) => {
      if (!mounted.current) return
      setRoomCode(data.code as string)
      setStatus('waiting')
    })

    const unsubMatched = wsService.on('matched', (data: any) => {
      if (!mounted.current) return
      setOpponentName(data.opponentName as string)
      setStatus('matched')
      setTimeout(() => {
        if (mounted.current) navigate(`/games/y/play/${data.gameId}`)
      }, 1200)
    })

    const unsubError = wsService.on('error', (data: any) => {
      if (!mounted.current) return
      setStatus('error')
      setError((data.message as string) ?? 'An error occurred')
    })

    const setup = async () => {
      try {
        if (!wsService.isConnected()) {
          await wsService.connect(token)
        }
        if (!mounted.current) return
        wsService.send({ type: 'create_room', config: loadOnlineConfig() })
      } catch (err) {
        if (!mounted.current) return
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Connection failed')
      }
    }

    setup()

    return () => {
      mounted.current = false
      unsubCreated()
      unsubMatched()
      unsubError()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = useCallback(() => {
    navigate('/games/y/online')
  }, [navigate])

  const handleCopy = useCallback(() => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => {
        if (mounted.current) setCopied(false)
      }, 2000)
    })
  }, [roomCode])

  const handleRetry = useCallback(() => {
    setStatus('connecting')
    setError(null)
    setRoomCode(null)
    if (token && !isGuest) {
      wsService.send({ type: 'create_room', config: loadOnlineConfig() })
    }
  }, [token, isGuest])

  return {
    status,
    roomCode,
    opponentName,
    error,
    copied,
    handleCancel,
    handleCopy,
    handleRetry,
  }
}

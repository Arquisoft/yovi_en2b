import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'
import { loadOnlineConfig } from '@/utils/onlineConfig'
import type { GameVariant } from '@/types'

export type HostLobbyStatus = 'connecting' | 'waiting' | 'matched' | 'error'

export function useOnlineHostLobbyController() {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()
  const { variant = 'y' } = useParams<{ variant: GameVariant }>()

  const [status, setStatus] = useState<HostLobbyStatus>('connecting')
  const [roomCode, setRoomCode] = useState<string | null>(null)
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const mounted = useRef(true)
  // Tracks whether a match happened — prevents cancel_room on unmount if matched.
  const matchedRef = useRef(false)

  useEffect(() => {
    mounted.current = true
    matchedRef.current = false

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
      matchedRef.current = true
      setOpponentName(data.opponentName as string)
      setStatus('matched')
      // Use server-supplied variant — host might theoretically differ in future flows.
      const serverVariant = (data.variant as GameVariant) ?? variant
      setTimeout(() => {
        if (mounted.current) navigate(`/games/${serverVariant}/play/${data.gameId}`)
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
        const config = { ...loadOnlineConfig(variant), variant }
        wsService.send({ type: 'create_room', config })
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
      // Cancel the room on the server if we never matched.
      // Without this, the room stays alive in server memory even though the
      // host has navigated away — any guest entering the code would trigger a
      // match that the host never sees.
      if (!matchedRef.current) {
        wsService.send({ type: 'cancel_room' })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = useCallback(() => {
    // Explicit cancel: clean up server state before navigating.
    if (!matchedRef.current) {
      wsService.send({ type: 'cancel_room' })
    }
    navigate(`/games/${variant}/online`)
  }, [navigate, variant])

  const handleCopy = useCallback(() => {
    if (!roomCode) return
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true)
      setTimeout(() => {
        if (mounted.current) setCopied(false)
      }, 2000)
    })
  }, [roomCode])

  const handleRetry = useCallback(async () => {
    setStatus('connecting')
    setError(null)
    setRoomCode(null)
    matchedRef.current = false

    if (!token || isGuest) return
    try {
      if (!wsService.isConnected()) {
        await wsService.connect(token)
      }
      const config = { ...loadOnlineConfig(variant), variant }
      wsService.send({ type: 'create_room', config })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [token, isGuest, variant])

  return {
    status,
    roomCode,
    opponentName,
    error,
    copied,
    variant,
    handleCancel,
    handleCopy,
    handleRetry,
  }
}

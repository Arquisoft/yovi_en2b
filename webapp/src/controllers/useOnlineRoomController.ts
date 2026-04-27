import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'
import type { GameVariant } from '@/types'

export type RoomJoinStatus = 'idle' | 'connecting' | 'waiting' | 'matched' | 'error'

export function useOnlineRoomController() {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()
  const { variant = 'y' } = useParams<{ variant: GameVariant }>()

  const [codeInput, setCodeInput] = useState('')
  const [joinStatus, setJoinStatus] = useState<RoomJoinStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hostName, setHostName] = useState<string | null>(null)
  const [matchedVariant, setMatchedVariant] = useState<GameVariant | null>(null)

  const mounted = useRef(true)
  const hasJoined = useRef(false)

  useEffect(() => {
    mounted.current = true

    const unsubMatched = wsService.on('matched', (data: any) => {
      if (!mounted.current) return
      setHostName(data.opponentName as string)
      // The joiner doesn't pick a variant — adopt whatever the host's room used.
      const serverVariant = (data.variant as GameVariant) ?? variant
      setMatchedVariant(serverVariant)
      setJoinStatus('matched')
      setTimeout(() => {
        if (mounted.current) navigate(`/games/${serverVariant}/play/${data.gameId}`)
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
  }, [navigate, variant])

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
      // Joiner doesn't pick the variant — the host's room config does.
      wsService.send({ type: 'join_room', code })
      setJoinStatus('waiting')
    } catch (err) {
      if (!mounted.current) return
      setJoinStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [codeInput, token, isGuest])

  const handleCreateRoom = useCallback(() => {
    navigate(`/games/${variant}/config/pvp-online`)
  }, [navigate, variant])

  const handleCancel = useCallback(() => {
    navigate(`/games/${variant}`)
  }, [navigate, variant])

  const handleRetry = useCallback(() => {
    setJoinStatus('idle')
    setError(null)
  }, [])

  return {
    codeInput,
    setCodeInput,
    joinStatus,
    error,
    hostName,
    /** Variant the joiner ended up matched into (server-supplied; falls back to URL variant). */
    matchedVariant: matchedVariant ?? variant,
    handleCreateRoom,
    handleJoin,
    handleCancel,
    handleRetry,
    isGuest: isGuest ?? false,
  }
}

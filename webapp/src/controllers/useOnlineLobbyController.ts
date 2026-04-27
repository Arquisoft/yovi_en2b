import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'
import { loadOnlineConfig } from '@/utils/onlineConfig'
import type { GameVariant } from '@/types'

export type LobbyStatus = 'connecting' | 'queuing' | 'matched' | 'error'

interface OnlineLobbyState {
  status: LobbyStatus
  opponentName: string | null
  error: string | null
  queueSize: number
  variant: GameVariant
}

export interface OnlineLobbyController extends OnlineLobbyState {
  leaveQueue: () => void
  retry: () => void
}

export function useOnlineLobbyController(): OnlineLobbyController {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()
  const { variant = 'y' } = useParams<{ variant: GameVariant }>()

  const [status, setStatus] = useState<LobbyStatus>('connecting')
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queueSize, setQueueSize] = useState(0)

  const mounted = useRef(true)
  const connectingRef = useRef(false)
  // Track whether we've been matched — don't leave_queue on unmount if matched
  const matchedRef = useRef(false)

  const connect = useCallback(async () => {
    if (connectingRef.current) return

    if (!token || isGuest) {
      navigate('/login', { replace: true })
      return
    }

    connectingRef.current = true
    try {
      await wsService.connect(token)
      if (!mounted.current) return

      // Stamp the variant onto the config so the server queues us in the
      // right bucket and creates the matched game with the right rules.
      const config = { ...loadOnlineConfig(variant), variant }
      wsService.send({ type: 'join_queue', config })
    } catch (err) {
      if (!mounted.current) return
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      connectingRef.current = false
    }
  }, [token, isGuest, navigate, variant])

  useEffect(() => {
    mounted.current = true
    matchedRef.current = false

    const unsubQueued = wsService.on('queue_joined', (data) => {
      if (!mounted.current) return
      setQueueSize((data.queueSize as number) ?? 0)
      setStatus('queuing')
    })

    const unsubMatched = wsService.on('matched', (data) => {
      if (!mounted.current) return
      matchedRef.current = true
      setOpponentName(data.opponentName as string)
      setStatus('matched')

      // Server-supplied variant is authoritative — the user's URL might say `y`
      // even if they were queued for `why-not` (defensive against future flows).
      const matchedVariant = (data.variant as GameVariant) ?? variant

      // Brief delay so the user sees who they matched with
      setTimeout(() => {
        if (mounted.current) {
          navigate(`/games/${matchedVariant}/play/${data.gameId}`)
        }
      }, 1200)
    })

    const unsubError = wsService.on('error', (data) => {
      if (!mounted.current) return
      setStatus('error')
      setError((data.message as string) ?? 'An error occurred')
    })

    connect()

    return () => {
      mounted.current = false
      unsubQueued()
      unsubMatched()
      unsubError()

      // Only send leave_queue if we're still waiting (not matched yet).
      // If we're matched, the WS is passed to the game page; don't interrupt it.
      if (!matchedRef.current) {
        wsService.send({ type: 'leave_queue' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect])

  const leaveQueue = useCallback(() => {
    matchedRef.current = false // reset so cleanup also sends leave_queue if needed
    wsService.send({ type: 'leave_queue' })
    wsService.disconnect()
    navigate(`/games/${variant}`)
  }, [navigate, variant])

  const retry = useCallback(() => {
    setStatus('connecting')
    setError(null)
    connectingRef.current = false
    connect()
  }, [connect])

  return {
    status,
    opponentName,
    error,
    queueSize,
    variant,
    leaveQueue,
    retry,
  }
}

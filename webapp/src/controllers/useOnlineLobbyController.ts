import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { wsService } from '@/services/websocketService'

export type LobbyStatus = 'connecting' | 'queuing' | 'matched' | 'error'

interface OnlineLobbyState {
  status: LobbyStatus
  opponentName: string | null
  error: string | null
  queueSize: number
}

export interface OnlineLobbyController extends OnlineLobbyState {
  leaveQueue: () => void
  retry: () => void
}

export function useOnlineLobbyController(): OnlineLobbyController {
  const { token, isGuest } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<LobbyStatus>('connecting')
  const [opponentName, setOpponentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [queueSize, setQueueSize] = useState(0)

  // Referencia para evitar actualizaciones de estado tras desmontar el componente
  const mounted = useRef(true)
  // Evita conexiones duplicadas causadas por el modo estricto de React
  const connectingRef = useRef(false)

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
      
      // Una vez conectados, entramos automáticamente en la cola
      wsService.send({ type: 'join_queue' })
    } catch (err) {
      if (!mounted.current) return
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      connectingRef.current = false
    }
  }, [token, isGuest, navigate])

  useEffect(() => {
    mounted.current = true

    // Suscripción: Confirmación de entrada en cola
    const unsubQueued = wsService.on('queue_joined', (data) => {
      if (!mounted.current) return
      setQueueSize((data.queueSize as number) ?? 0)
      setStatus('queuing')
    })

    // Suscripción: Emparejamiento encontrado
    const unsubMatched = wsService.on('matched', (data) => {
      if (!mounted.current) return
      setOpponentName(data.opponentName as string)
      setStatus('matched')
      
      // Delay de 1.2s para que el usuario pueda ver quién es su oponente
      setTimeout(() => {
        if (mounted.current) {
          navigate(`/games/y/play/${data.gameId}`)
        }
      }, 1200)
    })

    // Suscripción: Errores del servidor (WS)
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
      
      // Si el usuario sale de la página antes de emparejarse, avisamos al servidor
      if (status !== 'matched') {
        wsService.send({ type: 'leave_queue' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]) 

  const leaveQueue = useCallback(() => {
    wsService.send({ type: 'leave_queue' })
    wsService.disconnect()
    navigate('/games/y')
  }, [navigate])

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
    leaveQueue, 
    retry 
  }
}
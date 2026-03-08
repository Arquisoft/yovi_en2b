import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { PollingTransport } from '@/services/realtime/PollingTransport'
import type { RealtimeTransport } from '@/services/realtime/RealtimeTransport'

interface RealtimeContextValue {
  transport: RealtimeTransport
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const transportRef = useRef<RealtimeTransport | null>(null)

  if (!transportRef.current) {
    // Initialize with PollingTransport, can be swapped for WebSocketTransport later
    transportRef.current = new PollingTransport({
      defaultInterval: 3000,
      hiddenTabInterval: 10000,
    })
  }

  useEffect(() => {
    const transport = transportRef.current
    
    return () => {
      transport?.disconnect()
    }
  }, [])

  return (
    <RealtimeContext.Provider value={{ transport: transportRef.current }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime(): RealtimeTransport {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context.transport
}

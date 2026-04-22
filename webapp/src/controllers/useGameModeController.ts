import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { GameMode } from '@/types'

export function useGameModeController() {
  const navigate = useNavigate()

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      if (mode === 'pvp-online') {
        navigate('/games/y/online')
      } else {
        navigate(`/games/y/config/${mode}`)
      }
    },
    [navigate],
  )

  return { handleSelectMode }
}
import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { GameMode, GameVariant } from '@/types'

export function useGameModeController() {
  const navigate = useNavigate()
  const { variant = 'y' } = useParams<{ variant: GameVariant }>()

  const handleSelectMode = useCallback(
    (mode: GameMode) => {
      // pvp-online jumps to the room-vs-host chooser; every other mode goes
      // straight to the per-mode config screen.
      if (mode === 'pvp-online') {
        navigate(`/games/${variant}/online`)
      } else {
        navigate(`/games/${variant}/config/${mode}`)
      }
    },
    [navigate, variant],
  )

  return { handleSelectMode }
}
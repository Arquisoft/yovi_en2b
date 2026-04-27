import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const HANDLE_HEIGHT = 28
const COLLAPSED_HEIGHT = HANDLE_HEIGHT
const DEFAULT_OPEN_HEIGHT = 360
const FALLBACK_MAX_HEIGHT = 600
const MIN_MAX_HEIGHT = 240
const MAX_HEIGHT_VH_RATIO = 0.7
const DRAG_THRESHOLD_PX = 5
const OPEN_TOLERANCE_PX = 4
const SNAP_TO_COLLAPSE_DISTANCE = 80
const SNAP_TO_OPEN_DISTANCE = 40

function clampHeight(value: number, max: number): number {
  return Math.max(COLLAPSED_HEIGHT, Math.min(max, value))
}

interface MobileGameDrawerProps {
  children: React.ReactNode
}

export function MobileGameDrawer({ children }: Readonly<MobileGameDrawerProps>) {
  const { t } = useTranslation()
  const [height, setHeight] = useState(DEFAULT_OPEN_HEIGHT)
  const [maxHeight, setMaxHeight] = useState(FALLBACK_MAX_HEIGHT)

  const heightRef = useRef(height)
  heightRef.current = height

  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  const updateHeight = (next: number) => {
    heightRef.current = next
    setHeight(next)
  }

  useEffect(() => {
    const compute = () => setMaxHeight(Math.max(MIN_MAX_HEIGHT, Math.round(window.innerHeight * MAX_HEIGHT_VH_RATIO)))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  const isOpen = height > COLLAPSED_HEIGHT + OPEN_TOLERANCE_PX

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startHeight: heightRef.current, moved: false }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const delta = drag.current.startY - e.clientY
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) drag.current.moved = true
    updateHeight(clampHeight(drag.current.startHeight + delta, maxHeight))
  }, [maxHeight])

  const onPointerEnd = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const wasDrag = drag.current.moved
    drag.current = null

    if (!wasDrag) {
      updateHeight(heightRef.current > COLLAPSED_HEIGHT + OPEN_TOLERANCE_PX ? COLLAPSED_HEIGHT : DEFAULT_OPEN_HEIGHT)
      return
    }

    const finalHeight = heightRef.current
    if (finalHeight < COLLAPSED_HEIGHT + SNAP_TO_COLLAPSE_DISTANCE) {
      updateHeight(COLLAPSED_HEIGHT)
    } else if (finalHeight < DEFAULT_OPEN_HEIGHT - SNAP_TO_OPEN_DISTANCE) {
      updateHeight(DEFAULT_OPEN_HEIGHT)
    }
  }, [])

  const transitionClass = drag.current ? '' : 'transition-[height] duration-200 ease-out'

  return (
    <div
      data-testid="mobile-game-drawer"
      data-open={isOpen}
      className={`flex-shrink-0 border-t border-border bg-card overflow-hidden ${transitionClass}`}
      style={{ height }}
    >
      <button
        type="button"
        aria-label={isOpen ? t('game.collapseSidebar') : t('game.expandSidebar')}
        aria-expanded={isOpen}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        className="flex items-center justify-center w-full touch-none select-none bg-transparent border-0 p-0 cursor-ns-resize active:bg-muted/40"
        style={{ height: HANDLE_HEIGHT }}
      >
        <span className="block w-10 h-1 rounded-full bg-muted-foreground/50" />
      </button>

      <div
        className={`h-full transition-opacity duration-150 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ height: Math.max(0, height - HANDLE_HEIGHT) }}
      >
        {children}
      </div>
    </div>
  )
}

import { useGameYController } from '@/controllers/useGameYController'
import { GameYBoard } from '@/components/game-y/GameYBoard'
import { GameSidebar } from '@/components/game-y/GameSidebar'
import { GameOverlay } from '@/components/game-y/GameOverlay'
import { PieRuleDecisionPanel } from '@/components/game-y/PieRuleDecisionPanel'
import { AlertCircle, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export function GameYPage() {
  const {
    game, liveTimer, chatMessages, isLoading, error, moveError, lastMove,
    isBotThinking, isPieDecisionPending, isBotDecidingPie, isPieDecisionLoading, isSwapAnimating,
    canPlay, handleCellClick, handlePieDecision, handleSurrender,
    handleSendMessage, handlePlayAgain, currentUserId,
  } = useGameYController()

  const navigate = useNavigate()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Mobile drag state
  const SIDEBAR_HEIGHT = 320
  const dragStartY = useRef<number | null>(null)
  const dragStartHeight = useRef<number>(SIDEBAR_HEIGHT)
  const [mobileHeight, setMobileHeight] = useState(SIDEBAR_HEIGHT)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
    dragStartHeight.current = mobileHeight
  }, [mobileHeight])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const delta = dragStartY.current - e.touches[0].clientY
    const next = Math.max(48, Math.min(520, dragStartHeight.current + delta))
    setMobileHeight(next)
    setSidebarOpen(next > 64)
  }, [])

  const onTouchEnd = useCallback(() => {
    dragStartY.current = null
    if (mobileHeight < 100) {
      setMobileHeight(48)
      setSidebarOpen(false)
    } else if (mobileHeight < 200) {
      setMobileHeight(SIDEBAR_HEIGHT)
      setSidebarOpen(true)
    }
  }, [mobileHeight])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">{error || 'Game not found'}</p>
      </div>
    )
  }

  if (isMobile) {
    return (
      <div className="h-full min-h-0 flex flex-col relative">
        {moveError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{moveError}</span>
          </div>
        )}
        {/* Board */}
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <GameYBoard
            game={game}
            lastMove={lastMove}
            isInteractive={canPlay}
            onCellClick={handleCellClick}
            pieDecisionStone={isPieDecisionPending ? lastMove : null}
            isSwapAnimating={isSwapAnimating}
          />
          {isPieDecisionPending && (
            <PieRuleDecisionPanel
              game={game}
              isBotDeciding={isBotDecidingPie}
              onDecide={handlePieDecision}
              isLoading={isPieDecisionLoading}
            />
          )}
        </div>

        {/* Sidebar deslizable desde abajo */}
        <div
          className="flex-shrink-0 border-t border-border bg-card overflow-hidden transition-[height] duration-150"
          style={{ height: mobileHeight }}
        >
          <div
            className="flex items-center justify-center h-8 cursor-ns-resize touch-none select-none"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onClick={() => {
              if (sidebarOpen) { setMobileHeight(48); setSidebarOpen(false) }
              else { setMobileHeight(SIDEBAR_HEIGHT); setSidebarOpen(true) }
            }}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
          </div>

          <div className={`overflow-y-auto transition-opacity duration-150 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ height: mobileHeight - 32 }}
          >
            <GameSidebar
              game={game}
              liveTimer={liveTimer}
              currentUserId={currentUserId}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onSurrender={handleSurrender}
              onPlayAgain={handlePlayAgain}
              isBotThinking={isBotThinking}
              isMobile
            />
          </div>
        </div>

        {/* Game Over Overlay */}
        <GameOverlay
          game={game}
          currentUserId={currentUserId}
          onPlayAgain={handlePlayAgain}
          onGoHome={() => navigate('/games')}
        />
      </div>
    )
  }

  // Desktop
  return (
    <div className="h-full min-h-0 flex flex-col relative">
      {moveError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-destructive/10 text-destructive text-sm border-b border-destructive/20">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{moveError}</span>
        </div>
      )}
      <div className="flex-1 min-h-0 flex relative">
      {/* Board */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        <GameYBoard
          game={game}
          lastMove={lastMove}
          isInteractive={canPlay}
          onCellClick={handleCellClick}
          pieDecisionStone={isPieDecisionPending ? lastMove : null}
          isSwapAnimating={isSwapAnimating}
        />
        {isPieDecisionPending && (
          <PieRuleDecisionPanel
            game={game}
            isBotDeciding={isBotDecidingPie}
            onDecide={handlePieDecision}
            isLoading={isPieDecisionLoading}
          />
        )}
      </div>

      {/* Botón chevron pegado al borde del sidebar */}
      <div className="relative flex-shrink-0 flex">
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="absolute -left-4 top-1/2 -translate-y-1/2 z-10
            w-4 h-12 flex items-center justify-center
            bg-card border border-border rounded-l-md
            text-muted-foreground hover:text-foreground hover:bg-muted
            transition-colors"
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        <aside
          className="overflow-hidden border-l border-border bg-card transition-[width] duration-300 ease-in-out"
          style={{ width: sidebarOpen ? '20rem' : '0' }}
        >
          <div className="w-80 h-full">
            <GameSidebar
              game={game}
              liveTimer={liveTimer}
              currentUserId={currentUserId}
              chatMessages={chatMessages}
              onSendMessage={handleSendMessage}
              onSurrender={handleSurrender}
              onPlayAgain={handlePlayAgain}
              isBotThinking={isBotThinking}
            />
          </div>
        </aside>
      </div>

      {/* Game Over Overlay */}
      <GameOverlay
        game={game}
        currentUserId={currentUserId}
        onPlayAgain={handlePlayAgain}
        onGoHome={() => navigate('/games')}
      />
      </div>
    </div>
  )
}

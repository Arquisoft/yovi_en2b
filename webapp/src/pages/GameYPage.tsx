import { useGameYController } from '@/controllers/useGameYController'
import { GameYBoard } from '@/components/game-y/GameYBoard'
import { GameSidebar } from '@/components/game-y/GameSidebar'
import { AlertCircle } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function GameYPage() {
  const {
    game,
    liveTimer,
    chatMessages,
    isLoading,
    error,
    lastMove,
    canPlay,
    handleCellClick,
    handleSurrender,
    handleSendMessage,
    handlePlayAgain,
    currentUserId,
  } = useGameYController()

  const isMobile = useMediaQuery('(max-width: 768px)')

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
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <GameYBoard
            board={game.board}
            size={game.config.boardSize}
            currentTurn={game.currentTurn}
            lastMove={lastMove}
            isInteractive={canPlay}
            onCellClick={handleCellClick}
          />
        </div>
        <div className="flex-shrink-0 border-t border-border bg-card">
          <GameSidebar
            game={game}
            liveTimer={liveTimer}
            currentUserId={currentUserId}
            chatMessages={chatMessages}
            onSendMessage={handleSendMessage}
            onSurrender={handleSurrender}
            onPlayAgain={handlePlayAgain}
            isMobile
          />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 flex">
      <div className="flex-1 min-w-0 overflow-hidden">
        <GameYBoard
          board={game.board}
          size={game.config.boardSize}
          currentTurn={game.currentTurn}
          lastMove={lastMove}
          isInteractive={canPlay}
          onCellClick={handleCellClick}
        />
      </div>
      <aside className="w-80 flex-shrink-0 border-l border-border bg-card">
        <GameSidebar
          game={game}
          liveTimer={liveTimer}
          currentUserId={currentUserId}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          onSurrender={handleSurrender}
          onPlayAgain={handlePlayAgain}
        />
      </aside>
    </div>
  )
}

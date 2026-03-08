import { useGameYController } from '@/controllers/useGameYController'
import { GameYBoard } from '@/components/game-y/GameYBoard'
import { GameSidebar } from '@/components/game-y/GameSidebar'
import { AlertCircle } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export function GameYPage() {
  const {
    game,
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
      <div className="flex flex-col h-full overflow-hidden">
        {/* Board takes most of the space */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-2">
          <GameYBoard
            board={game.board}
            size={game.config.boardSize}
            currentTurn={game.currentTurn}
            lastMove={lastMove}
            isInteractive={canPlay}
            onCellClick={handleCellClick}
          />
        </div>

        {/* Sidebar at the bottom - fixed height */}
        <div className="shrink-0 h-48 border-t border-border bg-card overflow-hidden">
          <GameSidebar
            game={game}
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

  // Desktop layout
  return (
    <div className="flex h-full overflow-hidden">
      {/* Board on the left - centered */}
      <div className="flex-1 min-w-0 flex items-center justify-center p-6">
        <GameYBoard
          board={game.board}
          size={game.config.boardSize}
          currentTurn={game.currentTurn}
          lastMove={lastMove}
          isInteractive={canPlay}
          onCellClick={handleCellClick}
        />
      </div>

      {/* Sidebar on the right */}
      <aside className="shrink-0 w-80 border-l border-border bg-card">
        <GameSidebar
          game={game}
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

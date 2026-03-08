import type { GameState, ChatMessage, PlayerColor } from '@/types'
import { Button } from '@/components/ui/Button'
import { TimerPanel } from './TimerPanel'
import { ChatPanel } from './ChatPanel'
import { Flag, RotateCcw, Trophy, Home } from 'lucide-react'
import { cn } from '@/utils'
import { useNavigate } from 'react-router-dom'

interface GameSidebarProps {
  game: GameState
  currentUserId: string
  chatMessages: ChatMessage[]
  onSendMessage: (content: string) => void
  onSurrender: () => void
  onPlayAgain: () => void
  isMobile?: boolean
}

export function GameSidebar({
  game,
  currentUserId,
  chatMessages,
  onSendMessage,
  onSurrender,
  onPlayAgain,
  isMobile = false,
}: GameSidebarProps) {
  const navigate = useNavigate()
  const showChat = game.config.mode !== 'pvp-local'

  // Determine which player the current user is
  const currentPlayerColor: PlayerColor | null =
    game.players.player1.id === currentUserId
      ? 'player1'
      : game.players.player2.id === currentUserId
        ? 'player2'
        : null

  // For local games, show whose turn it is
  const getTurnLabel = (): string => {
    if (game.status === 'finished') {
      if (game.winner) {
        const winnerName = game.winner === 'player1'
          ? game.players.player1.name
          : game.players.player2.name
        return `${winnerName} wins!`
      }
      return 'Game Over'
    }

    const currentPlayer = game.currentTurn === 'player1'
      ? game.players.player1
      : game.players.player2

    return `${currentPlayer.name}'s turn`
  }

  return (
    <div className={cn(
      'flex flex-col gap-3 p-4 h-full overflow-y-auto overflow-x-hidden',
      isMobile && 'max-h-48'
    )}>
      {/* Game Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Game Y</h2>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
            {game.config.boardSize}x{game.config.boardSize}
          </span>
        </div>

        {game.config.roomName && (
          <p className="text-sm text-muted-foreground">{game.config.roomName}</p>
        )}
      </div>

      {/* Turn Indicator */}
      <div className={cn(
        'text-center py-3 px-4 rounded-lg border',
        game.status === 'finished' && game.winner && 'bg-primary/10 border-primary',
        game.status === 'finished' && !game.winner && 'bg-muted',
        game.status === 'playing' && 'bg-card'
      )}>
        {game.status === 'finished' && game.winner && (
          <Trophy className="w-6 h-6 mx-auto mb-1 text-primary" />
        )}
        <p className="font-medium">{getTurnLabel()}</p>
        {game.status === 'playing' && (
          <div className={cn(
            'w-3 h-3 rounded-full mx-auto mt-2',
            game.currentTurn === 'player1' ? 'bg-player1' : 'bg-player2'
          )} />
        )}
      </div>

      {/* Timers */}
      {game.timer && (
        <div className="space-y-2">
          <TimerPanel
            timer={game.timer}
            player="player1"
            playerName={game.players.player1.name}
            isCurrentPlayer={currentPlayerColor === 'player1'}
          />
          <TimerPanel
            timer={game.timer}
            player="player2"
            playerName={game.players.player2.name}
            isCurrentPlayer={currentPlayerColor === 'player2'}
          />
        </div>
      )}

      {/* Player indicators (if no timer) */}
      {!game.timer && (
        <div className="space-y-2">
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg border',
            game.currentTurn === 'player1' && game.status === 'playing' && 'border-primary bg-primary/5'
          )}>
            <div className="w-3 h-3 rounded-full bg-player1" />
            <span className="font-medium text-sm">{game.players.player1.name}</span>
          </div>
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg border',
            game.currentTurn === 'player2' && game.status === 'playing' && 'border-primary bg-primary/5'
          )}>
            <div className="w-3 h-3 rounded-full bg-player2" />
            <span className="font-medium text-sm">{game.players.player2.name}</span>
          </div>
        </div>
      )}

      {/* Move count */}
      <p className="text-sm text-muted-foreground text-center">
        Moves: {game.moves.length}
      </p>

      {/* Chat (not for local games) */}
      {showChat && (
        <ChatPanel
          messages={chatMessages}
          currentUserId={currentUserId}
          onSendMessage={onSendMessage}
          isCollapsible={isMobile}
        />
      )}

      {/* Actions */}
      <div className="mt-auto space-y-2">
        {game.status === 'playing' && (
          <Button
            variant="destructive"
            className="w-full"
            onClick={onSurrender}
          >
            <Flag className="w-4 h-4 mr-2" />
            Surrender
          </Button>
        )}

        {game.status === 'finished' && (
          <>
            <Button className="w-full" onClick={onPlayAgain}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/games')}
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Games
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

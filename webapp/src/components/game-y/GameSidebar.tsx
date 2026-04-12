import { useTranslation } from 'react-i18next'
import type { GameState, ChatMessage, PlayerColor, TimerState } from '@/types'
import { Button } from '@/components/ui/Button'
import { TimerPanel } from './TimerPanel'
import { ChatPanel } from './ChatPanel'
import { Flag, RotateCcw, Trophy, Home } from 'lucide-react'
import { cn } from '@/utils'
import { useNavigate } from 'react-router-dom'

interface GameSidebarProps {
  game: GameState
  liveTimer: TimerState | null
  currentUserId: string
  chatMessages: ChatMessage[]
  onSendMessage: (content: string) => void
  onSurrender: () => void
  onPlayAgain: () => void
  isBotThinking?: boolean
  isMobile?: boolean
}

export function GameSidebar({
  game,
  liveTimer,
  currentUserId,
  chatMessages,
  onSendMessage,
  onSurrender,
  onPlayAgain,
  isBotThinking = false,
  isMobile = false,
}: GameSidebarProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const showChat = game.config.mode !== 'pvp-local'

  const currentPlayerColor: PlayerColor | null =
    game.players.player1.id === currentUserId
      ? 'player1'
      : game.players.player2.id === currentUserId
        ? 'player2'
        : null

  const botColor: PlayerColor | null =
    game.config.mode === 'pve'
      ? (game.players.player1.isBot ? 'player1' : 'player2')
      : null
  const effectiveCurrentTurn: PlayerColor =
    isBotThinking && botColor ? botColor : game.currentTurn

  const getTurnLabel = (): string => {
    if (game.status === 'finished') {
      if (game.winner) {
        const winnerName =
          game.winner === 'player1'
            ? game.players.player1.name
            : game.players.player2.name
        return t('game.wins', { name: winnerName })
      }
      return t('game.gameOver')
    }

    const currentPlayer =
      effectiveCurrentTurn === 'player1'
        ? game.players.player1
        : game.players.player2

    return t('game.turn', { name: currentPlayer.name })
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">

      {/* Game info */}
      <div className="flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{t('game.gameY')}</h2>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
            {game.config.boardSize}×{game.config.boardSize}
          </span>
        </div>
      </div>

      {/* Turn indicator */}
      <div className={cn(
        'flex-shrink-0 text-center py-3 px-4 rounded-lg border',
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
            effectiveCurrentTurn === 'player1' ? 'bg-player1' : 'bg-player2'
          )} />
        )}
      </div>

      {/* Timers */}
      {liveTimer && (
        <div className="flex-shrink-0 space-y-2">
          <TimerPanel
            timer={liveTimer}
            player="player1"
            playerName={game.players.player1.name}
            isCurrentPlayer={currentPlayerColor === 'player1'}
          />
          <TimerPanel
            timer={liveTimer}
            player="player2"
            playerName={game.players.player2.name}
            isCurrentPlayer={currentPlayerColor === 'player2'}
          />
        </div>
      )}

      {/* Player indicators without timer */}
      {!liveTimer && (
        <div className="flex-shrink-0 space-y-2">
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg border',
            effectiveCurrentTurn === 'player1' && game.status === 'playing' && 'border-primary bg-primary/5'
          )}>
            <div className="w-3 h-3 rounded-full bg-player1" />
            <span className="font-medium text-sm">{game.players.player1.name}</span>
          </div>
          <div className={cn(
            'flex items-center gap-2 p-3 rounded-lg border',
            effectiveCurrentTurn === 'player2' && game.status === 'playing' && 'border-primary bg-primary/5'
          )}>
            <div className="w-3 h-3 rounded-full bg-player2" />
            <span className="font-medium text-sm">{game.players.player2.name}</span>
          </div>
        </div>
      )}

      {/* Moves counter */}
      <p className="flex-shrink-0 text-sm text-muted-foreground text-center">
        {t('game.moves', { count: game.moves.length })}
      </p>

      {/* Chat */}
      {showChat && (
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatPanel
            messages={chatMessages}
            currentUserId={currentUserId}
            onSendMessage={onSendMessage}
            isCollapsible={isMobile}
          />
        </div>
      )}

      {!showChat && <div className="flex-1" />}

      {/* Actions */}
      <div className="flex-shrink-0 space-y-2 border-t border-border pt-4">
        {game.status === 'playing' && (
          <Button variant="destructive" className="w-full" onClick={onSurrender}>
            <Flag className="w-4 h-4 mr-2" />
            {t('game.surrender')}
          </Button>
        )}
        {game.status === 'finished' && (
          <>
            <Button className="w-full" onClick={onPlayAgain}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t('game.playAgain')}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/games')}
            >
              <Home className="w-4 h-4 mr-2" />
              {t('game.backToGames')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
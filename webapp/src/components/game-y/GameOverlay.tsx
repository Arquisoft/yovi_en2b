import { useEffect, useState, useRef } from 'react'
import type { GameState, PlayerColor } from '@/types'
import { RotateCcw, Home, Skull, X } from 'lucide-react'

interface GameOverlayProps {
  game: GameState
  currentUserId: string
  onPlayAgain: () => void
  onGoHome: () => void
}

interface Particle { //confeti
  id: number
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  rotation: number
  rotationSpeed: number
  opacity: number
  shape: 'rect' | 'circle' | 'triangle'
}

function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>()
  const particlesRef = useRef<Particle[]>([])

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    const colors = ['#FFD700', '#4A9EFF', '#FF6B6B', '#4ECDC4', '#96CEB4', '#FFEAA7', '#DDA0DD']
    const shapes: Particle['shape'][] = ['rect', 'circle', 'triangle']

    particlesRef.current = Array.from({ length: 90 }, (_, i) => ({
      id: i,
      x: W * (0.3 + Math.random() * 0.4),
      y: H * (0.3 + Math.random() * 0.3),
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 12 - 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 6 + Math.random() * 10,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      shape: shapes[Math.floor(Math.random() * shapes.length)],
    }))

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      particlesRef.current = particlesRef.current
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.25,
          vx: p.vx * 0.98,
          rotation: p.rotation + p.rotationSpeed,
          opacity: p.opacity - 0.007,
        }))
        .filter(p => p.opacity > 0 && p.y < H + 20)

      for (const p of particlesRef.current) {
        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.fillStyle = p.color
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)

        if (p.shape === 'circle') {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        } else if (p.shape === 'triangle') {
          ctx.beginPath()
          ctx.moveTo(0, -p.size / 2)
          ctx.lineTo(p.size / 2, p.size / 2)
          ctx.lineTo(-p.size / 2, p.size / 2)
          ctx.closePath()
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6)
        }
        ctx.restore()
      }

      if (particlesRef.current.length > 0) {
        animRef.current = requestAnimationFrame(draw)
      }
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, [active])

  if (!active) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

export function GameOverlay({ game, currentUserId, onPlayAgain, onGoHome }: GameOverlayProps) {
  const [show, setShow] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (game.status !== 'finished') return
    const t = setTimeout(() => setShow(true), 400)
    return () => clearTimeout(t)
  }, [game.status])

  if (game.status !== 'finished' || !show || closed) return null

  const isLocalGame = game.config.mode === 'pvp-local'

  let isVictory = false
  let resultLabel = 'DRAW'
  let winnerName = ''

  if (game.winner) {
    winnerName = game.winner === 'player1' ? game.players.player1.name : game.players.player2.name
    if (isLocalGame) {
      isVictory = true
      resultLabel = 'VICTORY'
    } else {
      const myColor: PlayerColor | null =
        game.players.player1.id === currentUserId ? 'player1' :
        game.players.player2.id === currentUserId ? 'player2' : null
      isVictory = myColor === game.winner
      resultLabel = isVictory ? 'VICTORY' : 'DEFEAT'
    }
  }

  const opponentName =
    game.players.player1.id === currentUserId
      ? game.players.player2.name
      : game.players.player2.id === currentUserId
        ? game.players.player1.name
        : null

  const primaryColor = '#4A9EFF'
  const destructiveColor = '#e05252'
  const accentColor = isVictory ? primaryColor : (game.winner ? destructiveColor : '#888')

  return (
    <>
      <style>{`
        @keyframes go-fadein {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes go-slam {
          0%   { transform: scale(2.5); opacity: 0; filter: blur(6px); }
          65%  { transform: scale(0.93); opacity: 1; filter: blur(0); }
          82%  { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        @keyframes go-rise {
          from { transform: translateY(32px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes go-shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes go-crown {
          0%, 100% { transform: translateY(0)    rotate(-5deg); }
          50%       { transform: translateY(-10px) rotate(5deg); }
        }
        @keyframes go-shake {
          0%, 100%      { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-5px); }
          30%, 60%, 90% { transform: translateX(5px); }
        }
        @keyframes go-pulse-border {
          0%, 100% { box-shadow: 0 0 0 1.5px ${accentColor}, 0 0 24px ${accentColor}55, 0 20px 60px rgba(0,0,0,0.6); }
          50%       { box-shadow: 0 0 0 1.5px ${accentColor}, 0 0 48px ${accentColor}99, 0 20px 60px rgba(0,0,0,0.6); }
        }

        .go-overlay {
          animation: go-fadein 0.35s ease both;
        }
        .go-card {
          animation: go-rise 0.45s cubic-bezier(.175,.885,.32,1.275) 0.05s both,
                     go-pulse-border 2.5s ease 0.6s infinite;
        }
        .go-title-victory {
          background: linear-gradient(90deg, #FFD700, #4A9EFF, #FFD700, #fffbe0, #FFD700);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: go-slam 0.55s cubic-bezier(.175,.885,.32,1.275) both,
                     go-shimmer 2.5s linear 0.6s infinite;
        }
        .go-title-defeat {
          color: ${destructiveColor};
          text-shadow: 0 0 24px ${destructiveColor}99;
          animation: go-slam 0.55s cubic-bezier(.175,.885,.32,1.275) both,
                     go-shake 0.45s ease 0.6s;
        }
        .go-title-draw {
          color: #888;
          animation: go-slam 0.55s cubic-bezier(.175,.885,.32,1.275) both;
        }
        .go-crown {
          animation: go-crown 2s ease-in-out infinite;
        }
        .go-stats {
          animation: go-rise 0.4s ease 0.2s both;
        }
        .go-buttons {
          animation: go-rise 0.4s ease 0.3s both;
        }
        .go-btn-primary {
          background: ${primaryColor};
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 13px 0;
          width: 100%;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.03em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: filter 0.15s, transform 0.1s;
        }
        .go-btn-primary:hover  { filter: brightness(1.15); }
        .go-btn-primary:active { transform: scale(0.97); }
        .go-btn-ghost {
          background: transparent;
          color: #666;
          border: 1px solid #2a2a2a;
          border-radius: 8px;
          padding: 12px 0;
          width: 100%;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          transition: color 0.15s, border-color 0.15s;
        }
        .go-btn-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: 1px solid #2a2a2a;
          border-radius: 6px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #555;
          transition: color 0.15s, border-color 0.15s, background 0.15s;
        }
        .go-btn-close:hover { color: #aaa; border-color: #444; background: #1a1a2a; }
      `}</style>

      <div
        className="go-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isVictory
            ? 'radial-gradient(ellipse at 50% 45%, rgba(74,158,255,0.12) 0%, rgba(8,12,22,0.94) 65%)'
            : 'radial-gradient(ellipse at 50% 45%, rgba(200,50,50,0.08) 0%, rgba(8,12,22,0.96) 65%)',
        }}
      >
        <ConfettiCanvas active={isVictory} />

        <div
          className="go-card"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 400,
            margin: '0 16px',
            background: '#0e1220',
            borderRadius: 16,
            border: `1.5px solid ${accentColor}`,
            padding: '36px 28px 28px',
            textAlign: 'center',
          }}
        >
          {/* Scanlines */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.018) 2px, rgba(255,255,255,0.018) 4px)',
          }} />

          {/* Close button */}
          <button className="go-btn-close" onClick={() => setClosed(true)} title="Close and view board">
            <X style={{ width: 14, height: 14 }} />
          </button>

          {/* Icon */}
          <div style={{ marginBottom: 12 }}>
            {isVictory ? (
              <div className="go-crown" style={{ fontSize: 52, filter: 'drop-shadow(0 0 12px #FFD700)' }}>🏆</div>
            ) : game.winner ? (
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto',
                background: `${destructiveColor}22`, border: `2px solid ${destructiveColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Skull style={{ width: 28, height: 28, color: destructiveColor }} />
              </div>
            ) : (
              <div style={{ fontSize: 48 }}>🤝</div>
            )}
          </div>

          {/* Title */}
          <div
            style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 16 }}
            className={isVictory ? 'go-title-victory' : game.winner ? 'go-title-defeat' : 'go-title-draw'}
          >
            {resultLabel}
          </div>

          {/* Subtitle */}
          {game.winner && (
            <div style={{ marginBottom: 20, fontSize: 14, color: '#666' }}>
              {isLocalGame
                ? <span style={{ color: accentColor, fontWeight: 700 }}>{winnerName} wins!</span>
                : <>
                    {isVictory ? 'You beat ' : 'Beaten by '}
                    <span style={{ color: accentColor, fontWeight: 700 }}>{opponentName}</span>
                  </>
              }
            </div>
          )}

          {/* Stats */}
          <div className="go-stats" style={{
            display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 24,
            borderTop: '1px solid #1e2030', borderBottom: '1px solid #1e2030', padding: '14px 0',
          }}>
            {[
              { label: 'Moves', value: game.moves.length },
              { label: 'Board', value: `${game.config.boardSize}×${game.config.boardSize}` },
              { label: 'Mode', value: game.config.mode === 'pve' ? 'VS BOT' : game.config.mode === 'pvp-local' ? 'LOCAL' : 'ONLINE' },
            ].map((stat, i, arr) => (
              <div key={stat.label} style={{
                flex: 1, borderRight: i < arr.length - 1 ? '1px solid #1e2030' : 'none',
              }}>
                <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#ccc' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="go-buttons">
            <button className="go-btn-primary" onClick={onPlayAgain}>
              <RotateCcw style={{ width: 15, height: 15 }} />
              Play Again
            </button>
            <button className="go-btn-ghost" onClick={onGoHome}>
              <Home style={{ width: 15, height: 15 }} />
              Back to Games
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
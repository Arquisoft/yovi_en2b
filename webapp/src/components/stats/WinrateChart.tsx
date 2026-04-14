import { useTranslation } from 'react-i18next'
import type { WinrateStat } from '@/types'
 
export function WinrateChart({ data, title }: Readonly<{ data: WinrateStat; title: string }>) {
  const { t } = useTranslation()
  const total = data.wins + data.losses
 
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="w-28 h-28 rounded-full border-4 border-border flex items-center justify-center">
          <span className="text-xs text-muted-foreground">{t('stats.noData')}</span>
        </div>
      </div>
    )
  }
 
  const winAngle = (data.wins / total) * 360
  const r = 50; const cx = 60; const cy = 60
 
  const toXY = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
 
  const start = toXY(0); const end = toXY(winAngle); const largeArc = winAngle > 180 ? 1 : 0
  const winPath = winAngle >= 360
    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
    : `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
 
  const lossAngle = 360 - winAngle; const lossLargeArc = lossAngle > 180 ? 1 : 0
  const lossStart = toXY(winAngle); const lossEnd = toXY(0)
  const lossPath = lossAngle >= 360
    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
    : `M ${cx} ${cy} L ${lossStart.x} ${lossStart.y} A ${r} ${r} 0 ${lossLargeArc} 1 ${lossEnd.x} ${lossEnd.y} Z`
 
  const winPct = Math.round((data.wins / total) * 100)
 
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <svg width="120" height="120" viewBox="0 0 120 120">
        {data.losses > 0 && <path d={lossPath} fill="hsl(var(--player2))" opacity="0.8" />}
        {data.wins   > 0 && <path d={winPath}  fill="hsl(var(--player1))" opacity="0.9" />}
        <text x={cx} y={cy + 5} textAnchor="middle" className="text-xs font-bold fill-foreground" fontSize="13" fill="currentColor">
          {winPct}%
        </text>
      </svg>
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-player1 inline-block" />
          {t('stats.winsLabel', { count: data.wins })}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-player2 inline-block" />
          {t('stats.lossesLabel', { count: data.losses })}
        </span>
      </div>
    </div>
  )
}
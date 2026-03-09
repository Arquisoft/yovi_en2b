import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils'

interface MessageBannerProps {
  message: ReactNode
  onClose?: () => void
  className?: string
}

export function MessageBanner({ message, onClose, className }: MessageBannerProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-4', // pb-4 para más espacio
        className
      )}
    >
      <div className="pointer-events-auto max-w-lg w-full mx-4 rounded-lg border bg-primary text-primary-foreground px-6 py-4 shadow-lg flex items-center justify-between">
        <span className="text-lg font-medium max-w-xs">{message}</span>
        {onClose && (
          <button
            type="button"
            className="text-primary-foreground/70 hover:text-primary-foreground transition-colors p-1"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Close message"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}

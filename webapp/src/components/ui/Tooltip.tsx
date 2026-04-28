import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/utils'

export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: Readonly<React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 rounded-md bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

interface TooltipProps {
  label: string
  children: React.ReactNode
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side']
}

export function Tooltip({ label, children, side = 'bottom' }: Readonly<TooltipProps>) {
  return (
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  )
}

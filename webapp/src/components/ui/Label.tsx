import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '@/utils'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  error?: boolean
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          error && 'text-destructive',
          className
        )}
        {...props}
      />
    )
  }
)

Label.displayName = 'Label'

export { Label }

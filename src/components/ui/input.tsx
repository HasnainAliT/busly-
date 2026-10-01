import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, invalid, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    aria-invalid={invalid || undefined}
    className={cn(
      'flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
      invalid && 'border-danger/60 focus-visible:border-danger focus-visible:ring-danger/30',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }

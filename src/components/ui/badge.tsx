import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold leading-5 whitespace-nowrap', {
  variants: {
    tone: {
      success: 'border-success/30 bg-success/12 text-success',
      warning: 'border-warning/30 bg-warning/12 text-warning',
      danger: 'border-danger/30 bg-danger/12 text-danger',
      primary: 'border-primary/30 bg-primary/12 text-primary',
      info: 'border-primary/30 bg-primary/12 text-primary',
      neutral: 'border-white/12 bg-white/6 text-foreground/85',
      muted: 'border-white/8 bg-white/4 text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}

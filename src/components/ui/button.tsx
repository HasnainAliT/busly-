import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-0 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_hsl(var(--primary)/.7)] hover:-translate-y-0.5 hover:shadow-glow',
        glass: 'glass text-foreground hover:-translate-y-0.5 hover:bg-white/10',
        outline: 'border border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-white/5',
        ghost: 'text-muted-foreground hover:bg-white/8 hover:text-foreground',
        destructive: 'bg-destructive/90 text-destructive-foreground hover:bg-destructive',
        subtle: 'bg-white/8 text-foreground hover:bg-white/12',
      },
      size: {
        default: 'h-11 px-4',
        sm: 'h-9 px-3 text-[13px]',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-11',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
})
Button.displayName = 'Button'

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }

import { cn } from '@/lib/utils'

export function LiveDot({ className, tone = 'success' }: { className?: string; tone?: 'success' | 'warning' | 'danger' | 'muted' }) {
  const color = { success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', muted: 'bg-muted-foreground' }[tone]
  return (
    <span className={cn('relative inline-flex size-2', className)} aria-hidden>
      {tone !== 'muted' && <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', color)} />}
      <span className={cn('relative inline-flex size-2 rounded-full', color)} />
    </span>
  )
}

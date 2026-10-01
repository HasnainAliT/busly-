import { cn } from '@/lib/utils'

/** Shimmering placeholder used instead of generic spinners. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-white/6', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/8 to-transparent" />
    </div>
  )
}

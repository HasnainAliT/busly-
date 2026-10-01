import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { BusFront, CloudOff, MapPinOff, RefreshCw, SearchX, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
  className?: string
  tone?: 'neutral' | 'danger' | 'warning'
}

export function StateCard({ icon, title, description, action, className, tone = 'neutral' }: StateProps) {
  const ring = tone === 'danger' ? 'text-danger bg-danger/10' : tone === 'warning' ? 'text-warning bg-warning/10' : 'text-primary bg-primary/10'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}
    >
      <div className={cn('mb-4 grid size-12 place-items-center rounded-xl [&_svg]:size-6', ring)}>{icon}</div>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  )
}

export function EmptyBuses({ onReset, className }: { onReset?: () => void; className?: string }) {
  return (
    <StateCard
      className={className}
      icon={<BusFront />}
      title="No active buses found nearby"
      description="Looks like there aren't any active buses nearby. Clear your filters or pick a different starting point."
      action={onReset && <Button variant="outline" size="sm" onClick={onReset}>Clear filters</Button>}
    />
  )
}

export function EmptySearch({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <StateCard
      icon={<SearchX />}
      title="Nothing matches that search"
      description={`We couldn't find "${query.slice(0, 40)}". Check the bus number or try a stop name.`}
      action={<Button variant="outline" size="sm" onClick={onReset}>Clear search</Button>}
    />
  )
}

export function FeedError({ onRetry, className }: { onRetry: () => void; className?: string }) {
  return (
    <StateCard
      className={className}
      tone="danger"
      icon={<CloudOff />}
      title="We couldn't load live bus data"
      description="The tracking service didn't respond. Your saved buses and routes are safe. Try again in a moment."
      action={
        <Button size="sm" onClick={onRetry}>
          <RefreshCw /> Try again
        </Button>
      }
    />
  )
}

export function LocationDisabled({ onEnable, className }: { onEnable: () => void; className?: string }) {
  return (
    <StateCard
      className={className}
      tone="warning"
      icon={<MapPinOff />}
      title="Location access is disabled"
      description="Turn on location to see buses near you. You can still search by stop or route without it."
      action={<Button variant="outline" size="sm" onClick={onEnable}>Enable location</Button>}
    />
  )
}

export function OfflineBanner({ className }: { className?: string }) {
  return (
    <div role="status" className={cn('flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-[13px] text-warning', className)}>
      <WifiOff className="size-4 shrink-0" />
      You're offline. Showing the latest available information.
    </div>
  )
}

export function BusListSkeleton({ rows = 4, label = 'Finding nearby buses...' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <p className="px-1 text-sm text-muted-foreground">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass flex items-center gap-3 rounded-xl p-3.5">
          <Skeleton className="size-11 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-3/4" />
          </div>
          <Skeleton className="h-8 w-14" />
        </div>
      ))}
    </div>
  )
}

export function CardGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4', className)} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass space-y-3 rounded-2xl p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  )
}

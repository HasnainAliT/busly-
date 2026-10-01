import { memo } from 'react'
import { motion } from 'framer-motion'
import { BusFront, MapPin, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { useNow } from '@/hooks/useLiveFeed'
import { formatAgo, type BusInsight } from '@/utils/bus'
import { markerTheme } from '@/components/map/Markers'

interface BusCardProps {
  insight: BusInsight
  selected?: boolean
  onSelect?: (id: string) => void
  index?: number
  distanceLabel?: string
  showFavorite?: boolean
}

function BusCardBase({ insight, selected, onSelect, index = 0, distanceLabel, showFavorite = true }: BusCardProps) {
  const { bus, route, nextStop } = insight
  const now = useNow(5000)
  const offline = bus.status === 'offline'
  const theme = markerTheme[bus.status]

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.03 }}
      className="group relative"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect?.(bus.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect?.(bus.id)
          }
        }}
        aria-pressed={selected}
        aria-label={`${bus.id}, Route ${route.code}: ${route.from} to ${route.to}, ${bus.locationLost ? 'location temporarily unavailable' : offline ? 'offline' : `arrives in ${insight.etaDestMin} minutes`}`}
        className={cn(
          'glass relative flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-all duration-200',
          'hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected && 'border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/.5),0_10px_30px_-12px_hsl(var(--primary)/.5)]',
        )}
      >
        <span
          className="grid size-11 shrink-0 place-items-center rounded-lg"
          style={{ background: `${theme.fill.replace(')', ' / .16)')}`, color: bus.status === 'offline' ? 'hsl(215 15% 60%)' : theme.fill }}
        >
          {offline ? <WifiOff className="size-5" /> : <BusFront className="size-5" />}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-display text-[15px] font-semibold leading-none">{bus.id}</span>
            <StatusBadge status={bus.status} delayMin={bus.delayMin} />
          </span>
          <span className="mt-1.5 block truncate text-[13px] text-muted-foreground">
            Route {route.code}: {route.from} to {route.to}
          </span>
          <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground/90">
            {bus.locationLost ? (
              <>Location temporarily unavailable</>
            ) : offline ? (
              <>Hasn't reported its location recently</>
            ) : (
              <>
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">
                  {nextStop ? `Next: ${nextStop.name}` : 'Final stop reached'}
                  {distanceLabel ? ` · ${distanceLabel}` : ''}
                </span>
              </>
            )}
          </span>
        </span>

        <span className="flex shrink-0 flex-col items-end gap-1 pr-0.5">
          {offline || bus.locationLost ? (
            <span className="text-xs text-muted-foreground">{formatAgo(bus.lastUpdated, now)}</span>
          ) : (
            <>
              <span className="font-display text-xl font-bold leading-none tabular-nums">
                {insight.etaDestMin}
                <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">min</span>
              </span>
              <span className="text-[11px] text-muted-foreground">{formatAgo(bus.lastUpdated, now)}</span>
            </>
          )}
        </span>
      </div>
      {showFavorite && (
        <div className="absolute -right-1 -top-1 z-10 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
          <FavoriteButton kind="bus" id={bus.id} label={bus.id} className="size-8 bg-card" />
        </div>
      )}
    </motion.div>
  )
}

export const BusCard = memo(BusCardBase)

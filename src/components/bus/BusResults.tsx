import { AnimatePresence } from 'framer-motion'
import { MapPinOff } from 'lucide-react'
import { BusCard } from '@/components/bus/BusCard'
import { BusListSkeleton, EmptyBuses, EmptySearch, FeedError, OfflineBanner } from '@/components/ui/states'
import { Button } from '@/components/ui/button'
import { formatDistance } from '@/hooks/useBusFilters'
import type { BusInsight } from '@/utils/bus'
import type { FeedStatus } from '@/types'
import type { LocationState } from '@/context/LocationContext'

interface Props {
  status: FeedStatus
  results: { insight: BusInsight; distance: number }[]
  selectedId: string | null
  onSelect: (id: string) => void
  query: string
  hasActiveFilters: boolean
  onReset: () => void
  onRetry: () => void
  locationState: LocationState
  onEnableLocation: () => void
  showDistance?: boolean
}

/** The one place that decides which of loading / error / offline / empty / list to show for bus results. */
export function BusResults({ status, results, selectedId, onSelect, query, hasActiveFilters, onReset, onRetry, locationState, onEnableLocation, showDistance = true }: Props) {
  return (
    <div className="space-y-3">
      {status === 'offline' && <OfflineBanner />}
      {locationState === 'denied' && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/25 bg-warning/8 px-3.5 py-2.5">
          <MapPinOff className="size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-warning">Location access is disabled</p>
          <Button variant="outline" size="sm" className="h-8" onClick={onEnableLocation}>
            Enable
          </Button>
        </div>
      )}

      {status === 'connecting' ? (
        <BusListSkeleton />
      ) : status === 'error' ? (
        <FeedError onRetry={onRetry} />
      ) : results.length === 0 ? (
        query.trim() ? <EmptySearch query={query} onReset={onReset} /> : <EmptyBuses onReset={hasActiveFilters ? onReset : undefined} />
      ) : (
        <ul className="space-y-2.5" aria-label="Buses">
          <AnimatePresence initial={false}>
            {results.map(({ insight, distance }, i) => (
              <li key={insight.bus.id}>
                <BusCard
                  insight={insight}
                  index={i}
                  selected={selectedId === insight.bus.id}
                  onSelect={onSelect}
                  distanceLabel={showDistance && locationState !== 'denied' ? formatDistance(distance) : undefined}
                />
              </li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  )
}

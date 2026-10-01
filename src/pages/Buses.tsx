import { useNavigate } from 'react-router-dom'
import { History } from 'lucide-react'
import { BusFilterBar } from '@/components/bus/BusFilterBar'
import { BusCard } from '@/components/bus/BusCard'
import { BusResults } from '@/components/bus/BusResults'
import { Button } from '@/components/ui/button'
import { useBuses } from '@/hooks/useLiveFeed'
import { useBusFilters, formatDistance } from '@/hooks/useBusFilters'
import { useLocationAccess } from '@/context/LocationContext'
import { useUserData } from '@/context/UserDataContext'

export default function BusesPage() {
  const { insights, status, feed } = useBuses()
  const loc = useLocationAccess()
  const navigate = useNavigate()
  const { favorites, recentBuses, clearRecents } = useUserData()
  const { filters, setFilters, results, hasActiveFilters, reset } = useBusFilters(insights, favorites.bus, loc.state === 'granted')

  const recent = recentBuses.map((id) => insights.find((i) => i.bus.id === id)).filter((i): i is NonNullable<typeof i> => !!i).slice(0, 3)
  const open = (id: string) => navigate(`/app/buses/${id}`)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Buses</h1>
        <p className="mt-1.5 text-muted-foreground">Every bus on the network. Open one for its stops, ETA and QR code.</p>
      </div>

      <div className="glass-strong mb-6 min-w-0 rounded-2xl p-4">
        <BusFilterBar filters={filters} onChange={setFilters} locationEnabled={loc.state === 'granted'} resultCount={results.length} />
      </div>

      {recent.length > 0 && !hasActiveFilters && status === 'live' && (
        <section className="mb-6" aria-label="Recently viewed">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold"><History className="size-4 text-muted-foreground" /> Recently viewed</h2>
            <Button variant="ghost" size="sm" onClick={clearRecents}>Clear</Button>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recent.map((i, n) => (
              <BusCard key={i.bus.id} insight={i} index={n} onSelect={open} showFavorite={false} />
            ))}
          </div>
        </section>
      )}

      <BusGrid>
        <BusResultsGrid
          status={status}
          results={results}
          hasActiveFilters={hasActiveFilters}
          query={filters.query}
          onReset={reset}
          onRetry={() => feed.retry()}
          onOpen={open}
          locationState={loc.state}
          onEnableLocation={loc.request}
        />
      </BusGrid>
    </div>
  )
}

function BusGrid({ children }: { children: React.ReactNode }) {
  return <section aria-label="All buses">{children}</section>
}

/** Same state handling as the map list, but laid out as a responsive card grid. */
function BusResultsGrid(props: {
  status: ReturnType<typeof useBuses>['status']
  results: ReturnType<typeof useBusFilters>['results']
  hasActiveFilters: boolean
  query: string
  onReset: () => void
  onRetry: () => void
  onOpen: (id: string) => void
  locationState: ReturnType<typeof useLocationAccess>['state']
  onEnableLocation: () => void
}) {
  if (props.status !== 'live' || props.results.length === 0) {
    return (
      <BusResults
        status={props.status}
        results={props.results}
        selectedId={null}
        onSelect={props.onOpen}
        query={props.query}
        hasActiveFilters={props.hasActiveFilters}
        onReset={props.onReset}
        onRetry={props.onRetry}
        locationState={props.locationState}
        onEnableLocation={props.onEnableLocation}
      />
    )
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
      {props.results.map(({ insight, distance }, i) => (
        <li key={insight.bus.id}>
          <BusCard insight={insight} index={i} onSelect={props.onOpen} distanceLabel={props.locationState === 'denied' ? undefined : formatDistance(distance)} />
        </li>
      ))}
    </ul>
  )
}

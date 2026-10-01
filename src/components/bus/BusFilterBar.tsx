import { Heart, LocateFixed, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { locationOptions, routes } from '@/data/mockRoutes'
import { cn } from '@/lib/utils'
import type { BusFilters, StatusFilter } from '@/hooks/useBusFilters'

const chips: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'On route' },
  { id: 'nearby', label: 'Nearby' },
  { id: 'delayed', label: 'Delayed' },
  { id: 'available', label: 'Available' },
  { id: 'break', label: 'On break' },
  { id: 'offline', label: 'Offline' },
  { id: 'favorites', label: 'Favorites' },
]

const selectCls =
  'h-10 w-full appearance-none rounded-lg border border-white/10 bg-white/5 pl-3 pr-8 text-[13px] font-medium text-foreground focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

interface Props {
  filters: BusFilters
  onChange: (f: BusFilters) => void
  locationEnabled: boolean
  resultCount: number
  className?: string
  /** Which parts to render, so the same state can drive a compact overlay and a fuller panel. */
  parts?: ('search' | 'selects' | 'chips')[]
}

export function BusFilterBar({ filters, onChange, locationEnabled, resultCount, className, parts = ['search', 'selects', 'chips'] }: Props) {
  const set = (patch: Partial<BusFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className={cn('space-y-2.5', className)}>
      {parts.includes('search') && (
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={filters.query}
          onChange={(e) => set({ query: e.target.value.slice(0, 40) })}
          placeholder="Search bus, route or stop"
          aria-label="Search buses, routes or stops"
          className="pl-10 pr-10"
          maxLength={40}
          autoComplete="off"
          inputMode="search"
          enterKeyHint="search"
        />
        {filters.query && (
          <button onClick={() => set({ query: '' })} aria-label="Clear search" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-white/10 hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>
      )}

      {parts.includes('selects') && (
        <div className="grid grid-cols-2 gap-2">
          <label className="relative block">
            <span className="sr-only">Route</span>
            <select value={filters.routeId} onChange={(e) => set({ routeId: e.target.value })} className={selectCls}>
              <option value="all" className="bg-[#0d1424]">All routes</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#0d1424]">Route {r.code}</option>
              ))}
            </select>
            <Caret />
          </label>
          <label className="relative block">
            <span className="sr-only">Distance from</span>
            <LocateFixed className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary" aria-hidden />
            <select value={filters.locationId} onChange={(e) => set({ locationId: e.target.value })} className={cn(selectCls, 'pl-8')}>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id} className="bg-[#0d1424]">
                  {l.id === 'me' && !locationEnabled ? 'Location off' : l.label}
                </option>
              ))}
            </select>
            <Caret />
          </label>
        </div>
      )}

      {parts.includes('chips') && (
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 no-scrollbar" role="group" aria-label="Filter buses">
        {chips.map((c) => {
          const active = filters.status === c.id
          return (
            <button
              key={c.id}
              onClick={() => set({ status: c.id })}
              aria-pressed={active}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition-colors',
                active ? 'border-primary/50 bg-primary/15 text-primary' : 'border-white/10 bg-white/4 text-muted-foreground hover:bg-white/8 hover:text-foreground',
              )}
            >
              {c.id === 'favorites' && <Heart className="size-3" fill={active ? 'currentColor' : 'none'} />}
              {c.label}
            </button>
          )
        })}
      </div>
      )}
      <p className="sr-only" aria-live="polite">{resultCount} buses match</p>
    </div>
  )
}

function Caret() {
  return (
    <svg className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownUp, History, MapPin, Navigation, Search, X } from 'lucide-react'
import { RouteCard } from '@/components/route/RouteCard'
import { RouteDetail } from '@/components/route/RouteDetail'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedError, OfflineBanner, StateCard } from '@/components/ui/states'
import { useBuses } from '@/hooks/useLiveFeed'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useUserData } from '@/context/UserDataContext'
import { ServiceAlerts } from '@/components/alerts/ServiceAlerts'
import { findRoutes, findTransfers, placeSuggestions } from '@/utils/routeSearch'
import { routeById } from '@/data/mockRoutes'
import { sanitizeText } from '@/utils/security'

export default function RoutesPage() {
  const { insights, status, feed } = useBuses()
  const { recentSearches, addRecentSearch, addActivity } = useUserData()
  const [params, setParams] = useSearchParams()
  const isLg = useMediaQuery('(min-width: 1024px)')

  const [from, setFrom] = useState(() => sanitizeText(params.get('from') ?? '', 40))
  const [to, setTo] = useState(() => sanitizeText(params.get('to') ?? '', 40))
  const [applied, setApplied] = useState({ from: from, to: to })
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const r = params.get('route')
    try {
      return r ? routeById(r).id : null
    } catch {
      return null
    }
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const searched = !!(applied.from || applied.to)
  const matches = useMemo(() => findRoutes(applied.from, applied.to, insights), [applied, insights])
  const transfers = useMemo(() => (matches.length === 0 && applied.from && applied.to ? findTransfers(applied.from, applied.to, insights) : []), [matches.length, applied, insights])
  const selected = matches.find((m) => m.route.id === selectedId) ?? null
  // Without a search the first card is previewed on large screens so the panel is never empty.
  const preview = selected ?? (isLg ? matches[0] ?? null : null)

  // Keep the URL shareable.
  useEffect(() => {
    const next: Record<string, string> = {}
    if (applied.from) next.from = applied.from
    if (applied.to) next.to = applied.to
    if (selectedId) next.route = selectedId
    setParams(next, { replace: true })
  }, [applied, selectedId, setParams])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const f = sanitizeText(from, 40)
    const t = sanitizeText(to, 40)
    if (f && t && f.toLowerCase() === t.toLowerCase()) {
      setFormError('Pick two different places.')
      return
    }
    setFormError(null)
    setApplied({ from: f, to: t })
    setSelectedId(null)
    if (f && t) {
      addRecentSearch({ from: f, to: t })
      addActivity(`Searched ${f} to ${t}`)
    }
  }

  const swap = () => {
    setFrom(to)
    setTo(from)
  }

  const clear = () => {
    setFrom('')
    setTo('')
    setApplied({ from: '', to: '' })
    setSelectedId(null)
    setFormError(null)
  }

  const view = (id: string) => {
    setSelectedId(id)
    if (!isLg) setSheetOpen(true)
  }

  const applyRecent = (f: string, t: string) => {
    setFrom(f)
    setTo(t)
    setApplied({ from: f, to: t })
    setSelectedId(null)
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Find your route</h1>
        <p className="mt-1.5 text-muted-foreground">Enter where you are and where you're headed to compare trip time and buses nearby.</p>
      </div>

      <form onSubmit={submit} className="glass-strong mb-6 rounded-2xl p-4 sm:p-5" noValidate>
        <div className="grid items-end gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
          <Field label="From" name="from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="MUET" list="place-suggestions" icon={<Navigation />} maxLength={40} autoComplete="off" />
          <Button type="button" variant="glass" size="icon" onClick={swap} aria-label="Swap from and to" className="mx-auto">
            <ArrowDownUp className="md:rotate-90" />
          </Button>
          <Field label="To" name="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Hyderabad" list="place-suggestions" icon={<MapPin />} maxLength={40} autoComplete="off" error={formError} />
          <div className="flex gap-2">
            <Button type="submit" size="default" className="flex-1 md:flex-none">
              <Search /> Find routes
            </Button>
            {(searched || from || to) && (
              <Button type="button" variant="ghost" size="icon" onClick={clear} aria-label="Clear search">
                <X />
              </Button>
            )}
          </div>
        </div>
        <datalist id="place-suggestions">
          {placeSuggestions.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {recentSearches.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><History className="size-3.5" /> Recent</span>
            {recentSearches.map((s) => (
              <button type="button" key={`${s.from}-${s.to}`} onClick={() => applyRecent(s.from, s.to)} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/10">
                {s.from} to {s.to}
              </button>
            ))}
          </div>
        )}
      </form>

      <ServiceAlerts className="mb-4" />
      {status === 'offline' && <OfflineBanner className="mb-4" />}

      {status === 'error' ? (
        <FeedError onRetry={() => feed.retry()} className="glass rounded-2xl" />
      ) : status === 'connecting' ? (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]" role="status" aria-label="Finding routes">
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="hidden h-[560px] rounded-2xl lg:block" />
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {searched ? `${matches.length} ${matches.length === 1 ? 'route' : 'routes'} from ${applied.from || 'anywhere'} to ${applied.to || 'anywhere'}` : `All ${matches.length} routes`}
            </p>
            {matches.length === 0 && transfers.length > 0 ? (
              <div className="space-y-3" aria-label="Routes with a change">
                <p className="text-sm text-warning">No single bus runs from {applied.from} to {applied.to}. These trips need one change:</p>
                {transfers.map((p) => (
                  <article key={`${p.first.route.id}-${p.second.route.id}-${p.changeAt.id}`} className="glass rounded-2xl p-4 sm:p-5">
                    <p className="font-display text-base font-semibold">Route {p.first.route.code} then Route {p.second.route.code}</p>
                    <ol className="mt-3 space-y-2 text-sm">
                      <li>1. Board Route {p.first.route.code} at <b>{p.first.fromStop.name}</b>, get off at <b>{p.changeAt.name}</b> ({p.first.durationMin} min).</li>
                      <li>2. Change to Route {p.second.route.code} at {p.changeAt.name} (about {Math.round(p.second.route.frequencyMin / 2)} min wait), get off at <b>{p.second.toStop.name}</b> ({p.second.durationMin} min).</li>
                    </ol>
                    <p className="mt-3 text-sm text-muted-foreground">About {p.durationMin} min in total · PKR {p.fare}</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="glass" onClick={() => view(p.first.route.id)}>View Route {p.first.route.code}</Button>
                      <Button size="sm" variant="glass" onClick={() => view(p.second.route.id)}>View Route {p.second.route.code}</Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : matches.length === 0 ? (
              <StateCard
                className="glass rounded-2xl"
                icon={<Search />}
                title="No direct route found"
                description={`We couldn't match a single bus from "${applied.from}" to "${applied.to}". Try a nearby stop, or a shorter name like "MUET".`}
                action={<Button variant="outline" size="sm" onClick={clear}>Show all routes</Button>}
              />
            ) : (
              matches.map((m, i) => <RouteCard key={m.route.id} match={m} index={i} searched={searched} selected={preview?.route.id === m.route.id} onView={view} />)
            )}
          </div>

          <aside className="glass sticky top-24 hidden max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-2xl p-5 lg:block" aria-label="Route details">
            {preview ? <RouteDetail route={preview.route} insights={insights} /> : <StateCard icon={<Navigation />} title="Select a route" description="Choose View route to see its stops, map and buses." />}
          </aside>
        </div>
      )}

      <Modal open={!isLg && sheetOpen && !!selected} onOpenChange={setSheetOpen} title={selected ? `Route ${selected.route.code}` : 'Route'} hideTitle className="max-w-xl">
        {selected && <RouteDetail route={selected.route} insights={insights} mapHeight="h-48" />}
      </Modal>
    </div>
  )
}

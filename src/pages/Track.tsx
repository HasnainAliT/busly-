import { ServiceAlerts } from '@/components/alerts/ServiceAlerts'
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BusFront, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedError, OfflineBanner, StateCard } from '@/components/ui/states'
import { MapView } from '@/components/map/MapView'
import { BusDetailPanel } from '@/components/bus/BusDetailPanel'
import { RouteTimeline } from '@/components/route/RouteTimeline'
import { ConnectionStatus } from '@/components/layout/Topbar'
import { useBusInsight, useLiveFeed } from '@/hooks/useLiveFeed'
import { useAuth } from '@/context/AuthContext'
import { BUS_ID_PATTERN } from '@/data/mockBuses'

const noop = () => {}

/** Public, read-only page opened by a bus QR code. It exposes only the bus's own position, never rider data. */
export default function TrackPage() {
  const { id } = useParams()
  const { insight, status } = useBusInsight(id)
  const { feed } = useLiveFeed()
  const { user } = useAuth()
  const buses = useMemo(() => (insight ? [insight] : []), [insight])
  const valid = !!id && BUS_ID_PATTERN.test(id)

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Busly home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ConnectionStatus />
            <Button asChild size="sm" variant="glass" className="hidden sm:inline-flex">
              <Link to={user ? '/app' : '/login'}>{user ? 'Open app' : 'Sign in'}</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <ServiceAlerts className="mb-4" />
        {!valid || (status === 'live' && !insight) ? (
          <StateCard
            className="glass mx-auto mt-6 max-w-lg rounded-2xl"
            icon={<BusFront />}
            title="This tracking link isn't valid"
            description="The bus number in the link doesn't match any active Busly bus. Ask the driver or check the code on the bus."
            action={<Button asChild><Link to="/">Go to Busly</Link></Button>}
          />
        ) : status === 'error' ? (
          <FeedError onRetry={() => feed.retry()} className="glass mx-auto mt-6 max-w-lg rounded-2xl" />
        ) : !insight ? (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]" role="status" aria-label="Loading bus">
            <Skeleton className="h-[360px] rounded-2xl lg:h-[560px]" />
            <Skeleton className="h-[420px] rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4 lg:order-1">
              {status === 'offline' && <OfflineBanner />}
              <div className="glass relative h-[340px] overflow-hidden rounded-2xl sm:h-[440px] lg:h-[600px]">
                <MapView className="absolute inset-0" buses={buses} selectedBusId={insight.bus.id} onSelectBus={noop} userPosition={null} focusZoom={1.3} showLegend={false} ariaLabel={`Live position of ${insight.bus.id}`} />
              </div>
            </div>
            <div className="space-y-4 lg:order-2">
              <section className="glass rounded-2xl p-5" aria-label="Bus status">
                <BusDetailPanel insight={insight} hideActions />
              </section>
              <section className="glass rounded-2xl p-5" aria-label="Route timeline">
                <h2 className="mb-4 font-display text-lg font-semibold">Route timeline</h2>
                <RouteTimeline insight={insight} compact />
              </section>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                This page is read-only and shows the bus only. It never shows who is riding.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

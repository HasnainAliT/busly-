import { Link } from 'react-router-dom'
import { BusFront, LogOut, UserRound } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/form'
import { StateCard, FeedError, OfflineBanner } from '@/components/ui/states'
import { ConnectionStatus } from '@/components/layout/Topbar'
import { DemoPanel } from '@/components/layout/DemoPanel'
import { useAuth } from '@/context/AuthContext'
import { useBuses, useTransit } from '@/hooks/useLiveFeed'
import { StartTrip } from '@/pages/driver/StartTrip'
import { ActiveTrip } from '@/pages/driver/ActiveTrip'
import { TripHistory } from '@/pages/driver/TripHistory'

export default function DriverPage() {
  const { user, logout } = useAuth()
  const { drivers, trips, routes, stops, simSpeed, status, feed } = useTransit()
  const { buses, insights } = useBuses()

  const driver = drivers.find((d) => d.userId === user?.id)
  const trip = driver?.currentTripId ? trips.find((t) => t.id === driver.currentTripId && !t.endTime) : undefined
  const insight = trip ? insights.find((i) => i.bus.id === trip.busId) : undefined

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/8 bg-background/85 px-4 backdrop-blur-xl">
        <Link to="/" aria-label="Busly home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <ConnectionStatus />
          <DemoPanel />
          <Button variant="glass" size="icon-sm" onClick={logout} aria-label="Sign out" title="Sign out">
            <LogOut />
          </Button>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Driver app</h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserRound className="size-4" /> {driver?.name ?? user?.name}
            </p>
          </div>
          <Button asChild variant="glass" size="sm">
            <Link to="/app">Passenger view</Link>
          </Button>
        </div>

        {status === 'offline' && <OfflineBanner />}
        {status === 'error' ? (
          <FeedError onRetry={() => feed.retry()} />
        ) : !driver ? (
          <Panel>
            <StateCard icon={<BusFront />} title="Your account isn't linked to a driver profile" description="Ask an operator to add you as a driver, then sign in again." />
          </Panel>
        ) : trip && insight ? (
          <ActiveTrip trip={trip} insight={insight} stopName={(id) => stops.find((s) => s.id === id)?.name ?? id} />
        ) : (
          <>
            <Panel title="Start a trip">
              {status === 'connecting' ? (
                <p className="text-sm text-muted-foreground">Loading your buses…</p>
              ) : (
                <StartTrip driver={driver} buses={buses} routes={routes} simSpeed={simSpeed} />
              )}
            </Panel>
            <TripHistory refreshKey={driver.currentTripId} routeCode={(id) => routes.find((r) => r.id === id)?.code ?? '?'} />
          </>
        )}
      </main>
    </div>
  )
}

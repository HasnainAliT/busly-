import { ServiceAlerts } from '@/components/alerts/ServiceAlerts'
import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Bell, BellRing, Clock, Heart, History, Map as MapIcon, QrCode, Route as RouteIcon, TriangleAlert, Waypoints } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { BusCard } from '@/components/bus/BusCard'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { CardGridSkeleton, EmptyBuses, FeedError, OfflineBanner, StateCard } from '@/components/ui/states'
import { LoadBars, Sparkline, StatusBar } from '@/components/dashboard/charts'
import { useBuses } from '@/hooks/useLiveFeed'
import { useHistory } from '@/hooks/useHistory'
import { useUserData } from '@/context/UserDataContext'
import { useNotifications } from '@/context/NotificationsContext'
import { useLocationAccess } from '@/context/LocationContext'
import { useAuth } from '@/context/AuthContext'
import { useShell } from '@/context/ShellContext'
import { routes } from '@/data/mockRoutes'
import { distance } from '@/utils/geometry'
import { formatAgo } from '@/utils/bus'
import { cn } from '@/lib/utils'
import type { BusStatus } from '@/types'

const DEFAULT_REF = { x: 130, y: 150 }

function Card({ title, icon, action, children, className }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('glass rounded-2xl p-5', className)}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Stat({ label, value, unit, sub, spark, hue, tone }: { label: string; value: string | number; unit?: string; sub: string; spark?: number[]; hue?: number; tone?: 'warning' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="glass rounded-2xl p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-display text-[2rem] font-bold leading-none tabular-nums', tone === 'warning' && 'text-warning')}>
        {value}
        {unit && <span className="ml-1.5 text-base font-medium text-muted-foreground">{unit}</span>}
      </p>
      <p className="mt-2 text-[13px] text-muted-foreground">{sub}</p>
      {spark && <Sparkline values={spark} hue={hue} label={`${label} over the last few minutes`} className="mt-3" />}
    </motion.div>
  )
}

export default function DashboardPage() {
  const { insights, status, feed } = useBuses()
  const { user } = useAuth()
  const { favorites, recentSearches, activity } = useUserData()
  const { notifications, unreadCount } = useNotifications()
  const loc = useLocationAccess()
  const { openScanner } = useShell()
  const navigate = useNavigate()

  const live = useMemo(() => insights.filter((i) => i.bus.status === 'active' || i.bus.status === 'delayed'), [insights])
  const counts = useMemo(() => {
    const c: Record<BusStatus, number> = { active: 0, delayed: 0, available: 0, break: 0, offline: 0 }
    insights.forEach((i) => c[i.bus.status]++)
    return c
  }, [insights])
  const activeRoutes = new Set(live.map((i) => i.route.id)).size
  const avgEta = live.length ? Math.round(live.reduce((a, i) => a + i.etaDestMin, 0) / live.length) : 0
  const alerts = counts.delayed + counts.offline

  const liveHistory = useHistory(live.length, { seedSpread: 1.2 })
  const etaHistory = useHistory(avgEta, { seedSpread: 2 })

  const ref = loc.position ?? DEFAULT_REF
  const nearby = useMemo(
    () =>
      insights
        .filter((i) => i.bus.status !== 'offline')
        .map((i) => ({ insight: i, d: distance(i.position, ref) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3),
    [insights, ref],
  )

  const routeLoad = useMemo(
    () =>
      routes.map((r) => {
        const buses = insights.filter((i) => i.route.id === r.id && i.bus.status !== 'offline')
        const avg = buses.length ? Math.round(buses.reduce((a, i) => a + i.bus.occupancy, 0) / buses.length) : 0
        return { label: `Route ${r.code}`, value: avg, hue: r.hue }
      }),
    [insights],
  )

  const followed = insights.filter((i) => favorites.bus.includes(i.bus.id))
  const favRoutes = routes.filter((r) => favorites.route.includes(r.id))
  const loading = status === 'connecting'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">
            {greeting}, {user?.name.split(' ')[0]}
          </h1>
          <p className="mt-1.5 text-muted-foreground">Here's what's moving on your routes right now.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="glass" onClick={openScanner}>
            <QrCode /> Scan QR
          </Button>
          <Button asChild>
            <Link to="/app/map">
              <MapIcon /> Open live map
            </Link>
          </Button>
        </div>
      </div>

      <ServiceAlerts />
      {status === 'offline' && <OfflineBanner />}

      {status === 'error' ? (
        <FeedError onRetry={() => feed.retry()} className="glass rounded-2xl" />
      ) : loading ? (
        <>
          <CardGridSkeleton count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
          <div className="grid gap-5 lg:grid-cols-3">
            <Skeleton className="h-[380px] rounded-2xl lg:col-span-2" />
            <Skeleton className="h-[380px] rounded-2xl" />
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Live buses" value={live.length} sub={`${insights.length} in the fleet`} spark={liveHistory} />
            <Stat label="Active routes" value={activeRoutes} sub={`of ${routes.length} total routes`} />
            <Stat label="Average ETA" value={avgEta} unit="min" sub="to final stop, live buses" spark={etaHistory} hue={38} />
            <Stat label="Alerts" value={alerts} tone={alerts ? 'warning' : undefined} sub={`${counts.delayed} delayed, ${counts.offline} offline`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <section className="glass relative overflow-hidden rounded-2xl lg:col-span-2" aria-label="Live map preview">
              <div className="relative h-[320px] sm:h-[400px]">
                <MapView
                  className="absolute inset-0"
                  buses={insights}
                  selectedBusId={null}
                  onSelectBus={(id) => id && navigate(`/app/map?bus=${id}`)}
                  userPosition={loc.position}
                  showControls={false}
                  showLegend={false}
                  interactive={false}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4">
                  <span className="glass flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold">
                    <LiveDot tone={status === 'live' ? 'success' : 'muted'} /> Live map
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-end p-4">
                  <Button asChild variant="glass" size="sm">
                    <Link to="/app/map">
                      Expand map <ArrowRight />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>

            <Card title="Nearby buses" icon={<Waypoints />} action={<Link to="/app/buses" className="text-[13px] font-semibold text-primary hover:underline">All buses</Link>}>
              {nearby.length === 0 ? (
                <EmptyBuses className="py-6" />
              ) : (
                <ul className="space-y-2.5">
                  {nearby.map(({ insight }, i) => (
                    <li key={insight.bus.id}>
                      <BusCard insight={insight} index={i} onSelect={(id) => navigate(`/app/map?bus=${id}`)} showFavorite={false} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Fleet right now" icon={<RouteIcon />}>
              <StatusBar counts={counts} />
              <div className="mt-6 border-t border-white/8 pt-5">
                <p className="mb-3.5 text-sm font-medium">Seats taken by route</p>
                <LoadBars rows={routeLoad} />
              </div>
            </Card>

            <Card title="Your active trips" icon={<Clock />}>
              {followed.length === 0 ? (
                <StateCard className="py-6" icon={<Heart />} title="No saved buses yet" description="Save a bus and its trip appears here with a live progress bar." />
              ) : (
                <ul className="space-y-4">
                  {followed.slice(0, 4).map((i) => (
                    <li key={i.bus.id}>
                      <Link to={`/app/buses/${i.bus.id}`} className="block rounded-lg p-1 -m-1 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-semibold">{i.bus.id}</span>
                          <span className="text-muted-foreground">{i.bus.status === 'offline' ? 'No signal' : `${i.etaDestMin} min to ${i.route.to}`}</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(i.bus.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${i.bus.id} trip progress`}>
                          <div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-1000" style={{ width: `${i.bus.progress * 100}%` }} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {favRoutes.length > 0 && (
                <div className="mt-5 border-t border-white/8 pt-4">
                  <p className="mb-2.5 text-sm font-medium">Favorite routes</p>
                  <div className="flex flex-wrap gap-2">
                    {favRoutes.map((r) => (
                      <Link key={r.id} to={`/app/routes?route=${r.id}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-semibold transition-colors hover:bg-white/10">
                        Route {r.code}: {r.from} to {r.to}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card
              title="Notifications"
              icon={unreadCount ? <BellRing className="!text-primary" /> : <Bell />}
              action={<Link to="/app/notifications" className="text-[13px] font-semibold text-primary hover:underline">{unreadCount ? `${unreadCount} new` : 'View all'}</Link>}
              className="md:col-span-2 lg:col-span-1"
            >
              {notifications.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">You're all caught up.</p>
              ) : (
                <ul className="space-y-3">
                  {notifications.slice(0, 3).map((n) => (
                    <li key={n.id} className="flex gap-3">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-white/20' : 'bg-primary')} aria-label={n.read ? 'Read' : 'Unread'} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-snug">{n.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{formatAgo(n.at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Recent routes" icon={<RouteIcon />}>
              {recentSearches.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Routes you search for show up here.</p>
              ) : (
                <ul className="space-y-2">
                  {recentSearches.map((s) => (
                    <li key={`${s.from}-${s.to}`}>
                      <Link to={`/app/routes?from=${encodeURIComponent(s.from)}&to=${encodeURIComponent(s.to)}`} className="flex items-center justify-between gap-3 rounded-lg bg-white/4 px-3.5 py-3 text-sm transition-colors hover:bg-white/8">
                        <span className="truncate font-medium">{s.from} to {s.to}</span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Recent activity" icon={<History />}>
              <ul className="space-y-3">
                {activity.slice(0, 4).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{a.text}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {!loading && status !== 'error' && alerts > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 text-warning" /> {alerts} {alerts === 1 ? 'bus needs' : 'buses need'} attention: delayed or not reporting.
        </p>
      )}
    </div>
  )
}

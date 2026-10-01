import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, BusFront, Clock, Flag, MapPin, Navigation, QrCode, Radio, Share2, TriangleAlert } from 'lucide-react'
import { MapView } from '@/components/map/MapView'
import { BusDetailPanel } from '@/components/bus/BusDetailPanel'
import { StatusBadge } from '@/components/bus/StatusBadge'
import { FavoriteButton } from '@/components/bus/FavoriteButton'
import { RouteTimeline } from '@/components/route/RouteTimeline'
import { QrTrackingCard } from '@/components/qr/QrTrackingCard'
import { QrCodeDialog } from '@/components/qr/QrCodeDialog'
import { ReportIssueDialog } from '@/components/bus/ReportIssueDialog'
import { Button } from '@/components/ui/button'
import { LiveDot } from '@/components/ui/live-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { FeedError, OfflineBanner, StateCard } from '@/components/ui/states'
import { useBusInsight, useLiveFeed, useNow } from '@/hooks/useLiveFeed'
import { useLocationAccess } from '@/context/LocationContext'
import { useUserData } from '@/context/UserDataContext'
import { BUS_ID_PATTERN } from '@/data/mockBuses'
import { formatAgo, formatClock, formatEta } from '@/utils/bus'
import { copyText, shareLink } from '@/utils/share'
import { buildTrackingUrl } from '@/utils/security'
import { useToast } from '@/components/ui/toast'

const noop = () => {}

export default function BusDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { insight, status } = useBusInsight(id)
  const { feed } = useLiveFeed()
  const loc = useLocationAccess()
  const { addRecentBus } = useUserData()
  const now = useNow(1000)
  const [qrOpen, setQrOpen] = useState(params.get('qr') === '1')
  const [reportOpen, setReportOpen] = useState(false)
  const toast = useToast()

  const validId = !!id && BUS_ID_PATTERN.test(id)
  useEffect(() => {
    if (insight) addRecentBus(insight.bus.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insight?.bus.id])

  // Clear the one-shot ?qr=1 flag so refreshing doesn't reopen the dialog.
  useEffect(() => {
    if (params.get('qr')) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buses = useMemo(() => (insight ? [insight] : []), [insight])

  const share = async () => {
    if (!insight) return
    const url = buildTrackingUrl(insight.bus.id)
    const shared = await shareLink({ title: `Track ${insight.bus.id} on Busly`, text: `Follow ${insight.bus.id} live.`, url })
    if (!shared) {
      const ok = await copyText(url)
      toast({ title: ok ? 'Tracking link copied' : "Couldn't copy the link", tone: ok ? 'success' : 'warning' })
    }
  }

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/app/buses'))}>
      <ArrowLeft /> Back
    </Button>
  )

  if (!validId || (status === 'live' && !insight)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        {back}
        <StateCard className="glass mt-4 rounded-2xl" icon={<BusFront />} title="We can't find that bus" description="The bus number may be wrong, or the bus is no longer part of the active fleet." action={<Button asChild><Link to="/app/buses">Browse all buses</Link></Button>} />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        {back}
        <FeedError onRetry={() => feed.retry()} className="glass mt-4 rounded-2xl" />
      </div>
    )
  }

  if (!insight) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 md:px-8" role="status" aria-label="Loading bus details">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    )
  }

  const { bus, route } = insight
  const offline = bus.status === 'offline'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
      {back}
      {status === 'offline' && <OfflineBanner className="mt-3" />}

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold sm:text-4xl">{bus.id}</h1>
            <StatusBadge status={bus.status} delayMin={bus.delayMin} />
            {!offline && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <LiveDot /> Live
              </span>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            Route {route.code}: {route.from} to {route.to} · {bus.model} · {bus.plate}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FavoriteButton kind="bus" id={bus.id} label={bus.id} className="size-11" />
          <Button variant="glass" onClick={share}>
            <Share2 /> Share
          </Button>
          <Button variant="glass" onClick={() => setQrOpen(true)}>
            <QrCode /> QR code
          </Button>
          <Button asChild>
            <Link to={`/app/map?bus=${bus.id}`}>
              <Navigation /> Track live
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <div className="glass relative h-[300px] overflow-hidden rounded-2xl sm:h-[380px]">
            <MapView className="absolute inset-0" buses={buses} selectedBusId={bus.id} onSelectBus={noop} userPosition={loc.position} focusZoom={1.35} interactive showLegend={false} ariaLabel={`Live position of ${bus.id}`} />
            {offline && (
              <div className="glass-strong absolute inset-x-3 top-3 flex items-start gap-2.5 rounded-xl p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>This bus hasn't reported its location recently. The marker shows its last known position.</span>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={<Clock />} label="ETA to destination" value={offline ? 'Unknown' : formatEta(insight.etaDestMin)} />
            <Tile icon={<MapPin />} label="Current stop" value={insight.currentStop.name} small />
            <Tile icon={<Flag />} label="Next stop" value={insight.nextStop?.name ?? 'Final stop'} small />
            <Tile icon={<Radio />} label="Last updated" value={`${formatAgo(bus.lastUpdated, now)}`} hint={formatClock(bus.lastUpdated)} />
          </div>

          <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 sm:p-6" aria-label="Route timeline">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Route timeline</h2>
              <span className="text-sm text-muted-foreground">{insight.stopsRemaining} {insight.stopsRemaining === 1 ? 'stop' : 'stops'} to go</span>
            </div>
            <RouteTimeline insight={insight} />
          </motion.section>
        </div>

        <div className="space-y-5">
          <section className="glass rounded-2xl p-5" aria-label="Vehicle status">
            <h2 className="mb-4 font-display text-lg font-semibold">Vehicle status</h2>
            <BusDetailPanel insight={insight} hideActions hideHeader hideHero />
          </section>
          <QrTrackingCard insight={insight} />
          <Button variant="outline" className="w-full" onClick={() => setReportOpen(true)}>
            Report a problem with this bus
          </Button>
        </div>
      </div>

      <QrCodeDialog insight={insight} open={qrOpen} onOpenChange={setQrOpen} />
      <ReportIssueDialog busId={bus.id} open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  )
}

function Tile({ icon, label, value, hint, small }: { icon: React.ReactNode; label: string; value: string; hint?: string; small?: boolean }) {
  return (
    <div className="glass min-w-0 rounded-xl p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className={`mt-1.5 font-display font-bold leading-tight ${small ? 'truncate text-base' : 'text-xl tabular-nums'}`} title={value}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

import { Download, Info, Lightbulb, Printer, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InsightsPanel } from '@/components/insights/InsightsPanel'
import { ActivityTimeline } from '@/components/ui/timeline'
import { analyticsToCsv, downloadText } from '@/utils/exportReport'
import { Panel, Tile } from '@/components/ui/form'
import { Badge } from '@/components/ui/badge'
import { ColumnChart, LineChart, BarList } from '@/components/operator/charts'
import { StateCard, FeedError } from '@/components/ui/states'
import { useAnalytics, useTransit } from '@/hooks/useLiveFeed'

export default function Analytics() {
  const { analytics: a, error } = useAnalytics()
  const { routes } = useTransit()
  if (error && !a) return <FeedError onRetry={() => location.reload()} />
  if (!a) return <p className="text-sm text-muted-foreground" role="status">Loading analytics...</p>
  const hue = (r: { key: string }) => routes.find((x) => x.id === r.key)?.hue
  const hours = a.hourly.filter((h) => h.hour >= 5 && h.hour <= 23)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Analytics</h1>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /> Calculated from the last {a.historyDays} days of trips. {a.sampleTrips > 0 ? `${a.sampleTrips} of them are generated sample trips so the charts are not empty on a fresh install.` : ''} These are statistics, not a trained model.</p>
       </div>
       <div className="flex gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={() => downloadText(`busly-report-${new Date(a.generatedAt).toISOString().slice(0, 10)}.csv`, analyticsToCsv(a))}><Download /> Export CSV</Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print report</Button>
       </div>
      </div>


      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Average trip" value={`${a.avgTripDurationMin} min`} />
        <Tile label="Average delay" value={`${a.avgDelayMin} min`} tone={a.avgDelayMin > 5 ? 'warning' : undefined} />
        <Tile label="Trips completed" value={`${a.completionRate}%`} tone="success" />
        <Tile label="ETA accuracy" value={`${a.etaAccuracy}%`} sub="start prediction vs actual" />
      </div>

      <InsightsPanel insights={a.insights} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Trips by hour of day"><ColumnChart data={hours.map((h) => ({ label: String(h.hour), value: h.trips, hot: a.peakHours.includes(h.hour) }))} unit="trips" ariaLabel="Trips by hour" labelEvery={2} /><p className="mt-2 text-xs text-muted-foreground">Peak hours: {a.peakHours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ') || 'not enough data'}</p></Panel>
        <Panel title="Average delay, last 7 days"><LineChart data={a.delayTrend.map((d) => ({ label: d.date, value: d.avgDelay }))} unit="min" ariaLabel="Average delay per day" /></Panel>
        <Panel title="Most used routes"><BarList unit="trips" rows={a.mostUsedRoutes.map((r) => ({ key: r.routeId, label: `${r.code} · ${r.name}`, value: r.trips, sub: `Average peak load ${r.avgOccupancy}%` }))} hueOf={hue} /></Panel>
        <Panel title="Most delayed routes"><BarList unit="min" rows={a.mostDelayedRoutes.map((r) => ({ key: r.routeId, label: `${r.code} · ${r.name}`, value: r.avgDelay }))} hueOf={hue} /></Panel>
        <Panel title="Most used stops">{a.mostUsedStops.length ? <BarList unit="visits" rows={a.mostUsedStops.map((s) => ({ key: s.stopId, label: s.name, value: s.visits }))} /> : <p className="text-sm text-muted-foreground">No data yet.</p>}</Panel>
        <Panel title="Bus utilisation"><BarList unit="trips" rows={a.busUtilization.map((b) => ({ key: b.busId, label: b.busId, value: b.trips, sub: `${b.hoursOnRoute} h on route` }))} /></Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Patterns found" action={<TrendingUp className="size-4 text-muted-foreground" />}>
          {a.patterns.length === 0 ? <p className="text-sm text-muted-foreground">No repeating delay pattern yet.</p> : <ul className="list-disc space-y-2 pl-5 text-sm">{a.patterns.map((p) => <li key={p}>{p}</li>)}</ul>}
        </Panel>
        <Panel title="Schedule suggestions" action={<Lightbulb className="size-4 text-muted-foreground" />}>
          {a.recommendations.length === 0 ? <p className="text-sm text-muted-foreground">Load is within capacity on every route.</p> : <ul className="list-disc space-y-2 pl-5 text-sm">{a.recommendations.map((p) => <li key={p}>{p}</li>)}</ul>}
        </Panel>
      </div>

      <Panel title="Recent activity across Busly" className="print:hidden">
        <ActivityTimeline all limit={12} />
      </Panel>

      <Panel title="Driver trip history">
        {a.driverHistory.length === 0 ? <StateCard title="No driver trips yet" description="Driver statistics appear after drivers complete trips." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs text-muted-foreground"><tr><th className="py-2 font-medium">Driver</th><th className="font-medium">Trips</th><th className="font-medium">Avg delay</th><th className="font-medium">On time</th></tr></thead>
              <tbody className="divide-y divide-white/8">{a.driverHistory.map((d) => <tr key={d.driverId}><td className="py-2.5 font-semibold">{d.name}</td><td>{d.trips}</td><td>{d.avgDelay} min</td><td><Badge tone={d.onTimePct >= 80 ? 'success' : 'warning'}>{d.onTimePct}%</Badge></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

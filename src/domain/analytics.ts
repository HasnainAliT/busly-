import type { Route, TransitData, Trip } from './types'
import { actualMinutes } from './tripMath'
import { computeInsights, type Insight } from './insights'

/* ------------------------------------------------------------------ *
 * Analytics and rule-based predictions.
 * Everything here is computed from stored trips (arithmetic and simple
 * grouping). There is no trained model, so the UI describes these as
 * "based on trip history".
 * ------------------------------------------------------------------ */

const DAY = 864e5
const finished = (t: Trip) => t.endTime != null && (t.status === 'completed' || t.status === 'ended-vehicle-issue')

export { actualMinutes }

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const round1 = (n: number) => Math.round(n * 10) / 10

function recentFinished(d: TransitData, now: number, days = 7): Trip[] {
  return d.trips.filter((t) => finished(t) && t.status === 'completed' && (t.endTime as number) >= now - days * DAY)
}

/** Expected trip length for a route at an hour of day, from the same hour in recent history. */
export function predictDurationMin(d: TransitData, routeId: string, hour: number): number {
  const route = d.routes.find((r) => r.id === routeId)
  const base = route?.durationMin ?? 30
  const samples = d.trips.filter((t) => t.routeId === routeId && t.status === 'completed' && t.endTime != null && Math.abs(new Date(t.startTime).getHours() - hour) <= 1).slice(-60)
  if (samples.length < 4) return base
  return Math.max(5, Math.round(avg(samples.map(actualMinutes))))
}

/** Typical delay for a route at an hour of day, in minutes. */
export function expectedDelayMin(d: TransitData, routeId: string, hour: number): number {
  const samples = d.trips.filter((t) => t.routeId === routeId && t.endTime != null && new Date(t.startTime).getHours() === hour).slice(-60)
  return samples.length >= 4 ? round1(avg(samples.map((t) => t.delayMinutes))) : 0
}

export interface Analytics {
  generatedAt: number
  fleet: { total: number; active: number; delayed: number; offline: number; available: number; onBreak: number }
  routesRunning: number
  tripsCompletedToday: number
  tripsActive: number
  avgTripDurationMin: number
  avgDelayMin: number
  completionRate: number
  etaAccuracy: number
  mostUsedRoutes: { routeId: string; code: string; name: string; trips: number; avgOccupancy: number }[]
  mostUsedStops: { stopId: string; name: string; visits: number }[]
  mostDelayedRoutes: { routeId: string; code: string; name: string; avgDelay: number }[]
  delayTrend: { date: string; avgDelay: number; trips: number }[]
  hourly: { hour: number; trips: number; avgDelay: number; avgOccupancy: number }[]
  peakHours: number[]
  busUtilization: { busId: string; trips: number; hoursOnRoute: number }[]
  driverHistory: { driverId: string; name: string; trips: number; avgDelay: number; onTimePct: number }[]
  patterns: string[]
  recommendations: string[]
  /** Explainable anomalies, comparisons and recommendations, each with its evidence. */
  insights: Insight[]
  sampleTrips: number
  historyDays: number
}

const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`

export function computeAnalytics(d: TransitData, now: number): Analytics {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const today0 = startOfToday.getTime()

  const week = recentFinished(d, now, 8)
  const allEnded = d.trips.filter((t) => t.endTime != null && (t.endTime as number) >= now - 8 * DAY)
  const completedToday = d.trips.filter((t) => t.status === 'completed' && t.endTime != null && (t.endTime as number) >= today0)

  const fleet = {
    total: d.buses.length,
    active: d.buses.filter((b) => b.status === 'active').length,
    delayed: d.buses.filter((b) => b.status === 'delayed').length,
    offline: d.buses.filter((b) => b.status === 'offline').length,
    available: d.buses.filter((b) => b.status === 'available').length,
    onBreak: d.buses.filter((b) => b.status === 'break').length,
  }
  const running = new Set(d.buses.filter((b) => b.status === 'active' || b.status === 'delayed').map((b) => b.routeId))

  const routeName = (r: Route | undefined) => r?.name ?? 'Unknown route'

  /* routes */
  const mostUsedRoutes = d.routes
    .map((r) => {
      const ts = week.filter((t) => t.routeId === r.id)
      return { routeId: r.id, code: r.code, name: routeName(r), trips: ts.length, avgOccupancy: Math.round(avg(ts.map((t) => t.peakOccupancy))) }
    })
    .sort((a, b) => b.trips - a.trips)

  const mostDelayedRoutes = d.routes
    .map((r) => ({ routeId: r.id, code: r.code, name: routeName(r), avgDelay: round1(avg(week.filter((t) => t.routeId === r.id).map((t) => t.delayMinutes))) }))
    .sort((a, b) => b.avgDelay - a.avgDelay)

  /* stops */
  const visits = new Map<string, number>()
  for (const t of week) {
    const route = d.routes.find((r) => r.id === t.routeId)
    const ids = t.stopsServed.length ? t.stopsServed : (route?.stopIds ?? [])
    for (const id of ids) visits.set(id, (visits.get(id) ?? 0) + 1)
  }
  const mostUsedStops = [...visits.entries()]
    .map(([stopId, v]) => ({ stopId, name: d.stops.find((s) => s.id === stopId)?.name ?? stopId, visits: v }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 6)

  /* trend by day */
  const delayTrend: Analytics['delayTrend'] = []
  for (let i = 6; i >= 0; i--) {
    const from = today0 - i * DAY
    const ts = week.filter((t) => (t.endTime as number) >= from && (t.endTime as number) < from + DAY)
    delayTrend.push({ date: new Date(from).toLocaleDateString('en-GB', { weekday: 'short' }), avgDelay: round1(avg(ts.map((t) => t.delayMinutes))), trips: ts.length })
  }

  /* hourly */
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const ts = week.filter((t) => new Date(t.startTime).getHours() === hour)
    return { hour, trips: ts.length, avgDelay: round1(avg(ts.map((t) => t.delayMinutes))), avgOccupancy: Math.round(avg(ts.map((t) => t.peakOccupancy))) }
  })
  const peakHours = [...hourly]
    .sort((a, b) => b.trips * b.avgOccupancy - a.trips * a.avgOccupancy)
    .slice(0, 3)
    .map((h) => h.hour)
    .sort((a, b) => a - b)

  /* utilisation */
  const busUtilization = d.buses
    .map((b) => {
      const ts = week.filter((t) => t.busId === b.id)
      return { busId: b.id, trips: ts.length, hoursOnRoute: round1(ts.reduce((a, t) => a + actualMinutes(t), 0) / 60) }
    })
    .sort((a, b) => b.trips - a.trips)

  /* drivers */
  const driverHistory = d.drivers
    .map((drv) => {
      const ts = week.filter((t) => t.driverId === drv.id)
      return { driverId: drv.id, name: drv.name, trips: ts.length, avgDelay: round1(avg(ts.map((t) => t.delayMinutes))), onTimePct: ts.length ? Math.round((ts.filter((t) => t.delayMinutes <= 3).length / ts.length) * 100) : 0 }
    })
    .filter((x) => x.trips > 0)
    .sort((a, b) => b.trips - a.trips)

  /* ETA accuracy: how close the start-of-trip prediction was to what happened. */
  const accuracies = week.filter((t) => t.predictedMin > 0 && actualMinutes(t) > 0).map((t) => Math.max(0, 1 - Math.abs(t.predictedMin - actualMinutes(t)) / actualMinutes(t)))

  /* patterns: a route that is repeatedly late at the same hour on several days */
  const patterns: string[] = []
  for (const r of d.routes) {
    for (let h = 5; h < 23; h++) {
      const ts = week.filter((t) => t.routeId === r.id && new Date(t.startTime).getHours() === h)
      const days = new Set(ts.map((t) => new Date(t.startTime).toDateString()))
      const a = avg(ts.map((t) => t.delayMinutes))
      if (ts.length >= 4 && days.size >= 3 && a >= 4) patterns.push(`Route ${r.code} is regularly delayed around ${fmtHour(h)} (about ${Math.round(a)} min late on ${days.size} of the last 7 days).`)
    }
  }

  /* schedule recommendations from load: suggest an extra bus where peak occupancy stays high */
  const recommendations: string[] = []
  for (const r of d.routes) {
    const ts = week.filter((t) => t.routeId === r.id)
    if (!ts.length) continue
    const byHour = new Map<number, number[]>()
    ts.forEach((t) => byHour.set(new Date(t.startTime).getHours(), [...(byHour.get(new Date(t.startTime).getHours()) ?? []), t.peakOccupancy]))
    const worst = [...byHour.entries()].map(([h, xs]) => ({ h, o: avg(xs), n: xs.length })).filter((x) => x.n >= 3).sort((a, b) => b.o - a.o)[0]
    if (worst && worst.o >= 85) recommendations.push(`Route ${r.code} averages ${Math.round(worst.o)}% load around ${fmtHour(worst.h)}. Consider adding a bus or shortening the ${r.frequencyMin} minute gap at that hour.`)
  }

  const ended = allEnded.length
  const ok = allEnded.filter((t) => t.status === 'completed').length

  return {
    generatedAt: now,
    fleet,
    routesRunning: running.size,
    tripsCompletedToday: completedToday.length,
    tripsActive: d.trips.filter((t) => t.endTime == null).length,
    avgTripDurationMin: Math.round(avg(week.map(actualMinutes))),
    avgDelayMin: round1(avg(week.map((t) => t.delayMinutes))),
    completionRate: ended ? Math.round((ok / ended) * 100) : 100,
    etaAccuracy: Math.round(avg(accuracies) * 100),
    mostUsedRoutes,
    mostUsedStops,
    mostDelayedRoutes,
    delayTrend,
    hourly,
    peakHours,
    busUtilization: busUtilization.slice(0, 8),
    driverHistory: driverHistory.slice(0, 8),
    patterns,
    recommendations,
    insights: computeInsights(d, now),
    sampleTrips: d.trips.filter((t) => t.sample).length,
    historyDays: 7,
  }
}

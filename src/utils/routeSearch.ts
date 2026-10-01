import { routes, routeStops } from '@/data/mockRoutes'
import { getRouteGeometry } from '@/utils/geometry'
import { sanitizeText } from '@/utils/security'
import type { BusInsight } from '@/utils/bus'
import type { Route, Stop } from '@/types'

export interface RouteMatch {
  route: Route
  fromStop: Stop
  toStop: Stop
  segment: Stop[]
  durationMin: number
  stopCount: number
  busesNearby: number
  /** Adult fare in PKR for this part of the route, rounded up to the next 5. */
  fare: number
  /** Names of stops on this part of the journey that an operator has closed. */
  closedStops: string[]
  /** Minutes until the soonest bus reaches the boarding stop, or null if none is approaching. */
  etaMin: number | null
}

/** Partial journeys are charged in proportion to the stops travelled, never less than PKR 20. */
export const partFare = (route: Route, stopsTravelled: number) => Math.max(20, Math.ceil((route.fare * stopsTravelled) / Math.max(1, route.stopIds.length - 1) / 5) * 5)

const norm = (s: string) => sanitizeText(s, 40).toLowerCase()

/** Every stop name (plus short aliases) the user can type, used for suggestions. */
export const placeSuggestions: string[] = Array.from(
  new Set([...routes.flatMap((r) => routeStops(r).map((s) => s.name)), 'MUET', 'Hyderabad', 'Kotri', 'Jamshoro']),
).sort()

export function findRoutes(from: string, to: string, insights: BusInsight[]): RouteMatch[] {
  const f = norm(from)
  const t = norm(to)
  const matches: RouteMatch[] = []

  for (const route of routes) {
    const stops = routeStops(route)
    const g = getRouteGeometry(route)
    const fromIdx = f ? stops.map((s, i) => (s.name.toLowerCase().includes(f) ? i : -1)).filter((i) => i >= 0) : [0]
    const toIdx = t ? stops.map((s, i) => (s.name.toLowerCase().includes(t) ? i : -1)).filter((i) => i >= 0) : [stops.length - 1]

    let best: { i: number; j: number } | null = null
    for (const i of fromIdx) for (const j of toIdx) if (i < j && (!best || j - i > best.j - best.i)) best = { i, j }
    if (!best) continue

    const { i, j } = best
    const live = insights.filter((b) => b.route.id === route.id && b.bus.status !== 'offline')
    const approaching = live.filter((b) => b.bus.progress <= g.stopProgress[i] + 0.0001)
    const etaMin = approaching.length
      ? Math.max(1, Math.round(Math.min(...approaching.map((b) => (g.stopProgress[i] - b.bus.progress) * route.durationMin))))
      : null

    matches.push({
      route,
      fromStop: stops[i],
      toStop: stops[j],
      segment: stops.slice(i, j + 1),
      durationMin: Math.max(1, Math.round((g.stopProgress[j] - g.stopProgress[i]) * route.durationMin)),
      stopCount: j - i,
      busesNearby: live.length,
      fare: partFare(route, j - i),
      closedStops: stops.slice(i, j + 1).filter((x) => x.closed).map((x) => x.name),
      etaMin,
    })
  }

  return matches.sort((a, b) => a.durationMin - b.durationMin)
}

export interface TransferPlan {
  first: RouteMatch
  second: RouteMatch
  changeAt: Stop
  durationMin: number
  fare: number
}

/**
 * When no single bus connects two places, look for two routes that share a stop.
 * Waiting time at the interchange is estimated as half the second route's frequency.
 */
export function findTransfers(from: string, to: string, insights: BusInsight[]): TransferPlan[] {
  const f = norm(from)
  const t = norm(to)
  if (!f || !t) return []
  const plans: TransferPlan[] = []
  for (const a of routes) {
    const aStops = routeStops(a)
    for (const b of routes) {
      if (a.id === b.id) continue
      const bStops = routeStops(b)
      for (const x of aStops) {
        const bi = bStops.findIndex((s) => s.id === x.id)
        if (bi < 0) continue
        const first = findRoutes(from, x.name, insights).find((m) => m.route.id === a.id && m.toStop.id === x.id)
        const second = findRoutes(x.name, to, insights).find((m) => m.route.id === b.id && m.fromStop.id === x.id)
        if (first && second) plans.push({ first, second, changeAt: x, durationMin: first.durationMin + second.durationMin + Math.round(b.frequencyMin / 2), fare: first.fare + second.fare })
      }
    }
  }
  const seen = new Set<string>()
  return plans
    .sort((p, q) => p.durationMin - q.durationMin)
    .filter((p) => {
      const k = `${p.first.route.id}>${p.second.route.id}@${p.changeAt.id}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, 3)
}

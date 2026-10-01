import type { BusRecord, BusStatus, Route, Stop } from '@/types'
import { routeById, routeStops } from '@/data/mockRoutes'
import { getRouteGeometry, pointAtProgress } from '@/utils/geometry'
import { etaMinutes, stopIndexAt } from '@/domain/geo'

export interface BusInsight {
  bus: BusRecord
  route: Route
  stops: Stop[]
  position: { x: number; y: number }
  currentStopIndex: number
  currentStop: Stop
  nextStop: Stop | null
  etaNextMin: number | null
  etaDestMin: number
  distNextKm: number | null
  distDestKm: number
  stopsRemaining: number
  occupancyLabel: 'Seats available' | 'Filling up' | 'Standing room only'
  isStale: boolean
  /** The driver's GPS stopped reporting. Show "Location temporarily unavailable" instead of live numbers. */
  unavailable: boolean
}

export const STALE_AFTER_MS = 2 * 60 * 1000

export function getBusInsight(bus: BusRecord): BusInsight {
  const route = routeById(bus.routeId)
  const stops = routeStops(route)
  const g = getRouteGeometry(route)

  const currentStopIndex = stopIndexAt(g, bus.progress)
  const nextIndex = currentStopIndex + 1 < stops.length ? currentStopIndex + 1 : -1
  const etaDest = etaMinutes(g, route, bus, 1)
  const etaNext = nextIndex === -1 ? null : etaMinutes(g, route, bus, g.stopProgress[nextIndex])

  const pct = bus.occupancy
  return {
    bus,
    route,
    stops,
    position: pointAtProgress(route, bus.progress),
    currentStopIndex,
    currentStop: stops[currentStopIndex],
    nextStop: nextIndex === -1 ? null : stops[nextIndex],
    etaNextMin: etaNext,
    etaDestMin: etaDest,
    distNextKm: nextIndex === -1 ? null : Math.max(0, (g.stopProgress[nextIndex] - bus.progress) * g.lengthKm),
    distDestKm: Math.max(0, (1 - bus.progress) * g.lengthKm),
    stopsRemaining: stops.length - 1 - currentStopIndex,
    occupancyLabel: pct < 55 ? 'Seats available' : pct < 85 ? 'Filling up' : 'Standing room only',
    isStale: Date.now() - bus.lastUpdated > STALE_AFTER_MS && bus.status !== 'available' && bus.status !== 'break',
    unavailable: bus.locationLost,
  }
}

export const statusMeta: Record<BusStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'muted' | 'info'; description: string }> = {
  active: { label: 'On route', tone: 'success', description: 'Moving and reporting normally' },
  delayed: { label: 'Delayed', tone: 'warning', description: 'Running behind schedule' },
  available: { label: 'Available', tone: 'info', description: 'At the depot or terminal, ready for a trip' },
  break: { label: 'On break', tone: 'neutral', description: 'Stopped temporarily' },
  offline: { label: 'Offline', tone: 'muted', description: "Not in service or hasn't reported recently" },
}

/** Buses that are moving along a route right now. */
export const isRunning = (s: BusStatus) => s === 'active' || s === 'delayed'

export function formatAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} sec ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  return `${h} hr ago`
}

export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatEta(min: number): string {
  return min < 60 ? `${String(min).padStart(2, '0')} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`
}

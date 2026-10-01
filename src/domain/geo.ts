import type { BusRecord, Point, Route, Stop } from './types'

/* ------------------------------------------------------------------ *
 * Coordinate model.
 * The map is a schematic 1000x700 space. lat/lng are linked to it by a
 * linear transform so operators can enter real coordinates and a driver's
 * phone GPS can be projected onto a route. The mapping is approximate
 * (schematic, not survey grade); a real map provider replaces it.
 * ------------------------------------------------------------------ */

export const MAP_W = 1000
export const MAP_H = 700
export const KM_PER_UNIT = 0.024
const LAT0 = 25.4492
const LNG0 = 68.2315
const LAT_PER_UNIT = 0.1516 / MAP_H
const LNG_PER_UNIT = 0.2388 / MAP_W

export const xyToGeo = (p: Point): { lat: number; lng: number } => ({
  lat: round(LAT0 - p.y * LAT_PER_UNIT, 5),
  lng: round(LNG0 + p.x * LNG_PER_UNIT, 5),
})

export const geoToXY = (lat: number, lng: number): Point => ({
  x: round((lng - LNG0) / LNG_PER_UNIT, 2),
  y: round((LAT0 - lat) / LAT_PER_UNIT, 2),
})

export const isValidLatLng = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180

function round(n: number, d: number) {
  const m = 10 ** d
  return Math.round(n * m) / m
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/* ------------------------------------------------------------------ *
 * Route geometry
 * ------------------------------------------------------------------ */

export interface RouteGeometry {
  points: Point[]
  cumulative: number[]
  total: number
  lengthKm: number
  /** Progress (0-1) at which each stop sits along the polyline. */
  stopProgress: number[]
}

const cache = new Map<string, RouteGeometry>()

export function routeGeometryFor(route: Route, stops: Stop[]): RouteGeometry {
  const key = `${route.id}|${stops.map((s) => `${s.id}:${s.x},${s.y}`).join(';')}`
  const hit = cache.get(key)
  if (hit) return hit
  const points = stops.map((s) => ({ x: s.x, y: s.y }))
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distance(points[i], points[i - 1]))
  const total = cumulative[cumulative.length - 1] || 1
  const geometry: RouteGeometry = {
    points,
    cumulative,
    total,
    lengthKm: total * KM_PER_UNIT,
    stopProgress: cumulative.map((c) => c / total),
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, geometry)
  return geometry
}

export function pointAt(g: RouteGeometry, progress: number): Point {
  if (g.points.length === 0) return { x: 0, y: 0 }
  const target = Math.min(1, Math.max(0, progress)) * g.total
  for (let i = 1; i < g.points.length; i++) {
    if (target <= g.cumulative[i]) {
      const seg = g.cumulative[i] - g.cumulative[i - 1]
      const t = seg === 0 ? 0 : (target - g.cumulative[i - 1]) / seg
      return {
        x: g.points[i - 1].x + (g.points[i].x - g.points[i - 1].x) * t,
        y: g.points[i - 1].y + (g.points[i].y - g.points[i - 1].y) * t,
      }
    }
  }
  return g.points[g.points.length - 1]
}

/** Closest point of the route polyline to p, as route progress plus the miss distance in map units. */
export function projectOnRoute(g: RouteGeometry, p: Point): { progress: number; missUnits: number } {
  let best = { progress: 0, missUnits: Infinity }
  for (let i = 1; i < g.points.length; i++) {
    const a = g.points[i - 1]
    const b = g.points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2))
    const q = { x: a.x + dx * t, y: a.y + dy * t }
    const miss = distance(p, q)
    if (miss < best.missUnits) best = { progress: (g.cumulative[i - 1] + (g.cumulative[i] - g.cumulative[i - 1]) * t) / g.total, missUnits: miss }
  }
  return best
}

/** Index of the last stop the bus has reached. */
export function stopIndexAt(g: RouteGeometry, progress: number): number {
  let idx = 0
  for (let i = 0; i < g.stopProgress.length; i++) if (progress >= g.stopProgress[i] - 0.0001) idx = i
  return idx
}

/* ------------------------------------------------------------------ *
 * ETA
 * Uses the factors from the brief: distance from the stop, current speed,
 * route progress and current delay. It blends the bus's live speed with the
 * route's typical average speed so one slow reading does not swing the ETA.
 * ------------------------------------------------------------------ */

export function routeAvgKmh(g: RouteGeometry, route: Route): number {
  return Math.max(12, (g.lengthKm / Math.max(route.durationMin, 1)) * 60)
}

export function etaMinutes(g: RouteGeometry, route: Route, bus: Pick<BusRecord, 'progress' | 'speedKmh' | 'status' | 'delayMin'>, targetProgress: number): number {
  const distKm = Math.max(0, targetProgress - bus.progress) * g.lengthKm
  const avg = routeAvgKmh(g, route)
  const moving = bus.speedKmh >= 5
  const effective = moving ? Math.min(70, Math.max(8, 0.6 * bus.speedKmh + 0.4 * avg)) : avg * 0.7
  const base = (distKm / effective) * 60
  const breakWait = bus.status === 'break' ? 3 : 0
  return Math.max(1, Math.round(base + breakWait))
}

export const progressPerSecond = (g: RouteGeometry, speedKmh: number, simSpeed: number) => ((speedKmh / 3600) * simSpeed) / g.lengthKm

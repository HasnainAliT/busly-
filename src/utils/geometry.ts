import type { Point, Route } from '@/types'
import { routeStops } from '@/data/mockRoutes'
import { distance, pointAt, routeGeometryFor, type RouteGeometry } from '@/domain/geo'

export type { RouteGeometry }
export { distance }

/** Geometry for a route using the live catalog. The domain layer caches by route + stop coordinates. */
export function getRouteGeometry(route: Route): RouteGeometry {
  return routeGeometryFor(route, routeStops(route))
}

export function pointAtProgress(route: Route, progress: number): Point {
  return pointAt(getRouteGeometry(route), progress)
}

export function headingAtProgress(route: Route, progress: number): number {
  const a = pointAtProgress(route, Math.max(0, progress - 0.01))
  const b = pointAtProgress(route, Math.min(1, progress + 0.01))
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

export function routePathD(route: Route): string {
  const { points } = getRouteGeometry(route)
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/** Path from the origin up to the given progress, used for the "travelled" segment. */
export function routePathUntil(route: Route, progress: number): string {
  const g = getRouteGeometry(route)
  const target = progress * g.total
  const parts: string[] = []
  for (let i = 0; i < g.points.length; i++) {
    if (g.cumulative[i] <= target) {
      parts.push(`${i === 0 ? 'M' : 'L'} ${g.points[i].x} ${g.points[i].y}`)
    } else {
      const p = pointAtProgress(route, progress)
      parts.push(`L ${p.x} ${p.y}`)
      break
    }
  }
  return parts.join(' ')
}

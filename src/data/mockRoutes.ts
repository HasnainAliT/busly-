import { seedRoutes, seedStops } from '@/domain/seed'
import type { Route, Stop, TransitData } from '@/types'

/**
 * Schematic coordinates for the Jamshoro - Kotri - Hyderabad corridor.
 * With a real map provider these become lat/lng pairs; the rest of the app only reads x/y
 * through the MapAdapter, so nothing else needs to change.
 */
/**
 * The catalog is a live view of the transit data. The store calls syncCatalog() on every change and
 * mutates these arrays in place, so modules that import `routes` / `stops` always see current data.
 */
export const stops: Stop[] = seedStops()
export const routes: Route[] = seedRoutes()

export function syncCatalog(data: Pick<TransitData, 'stops' | 'routes'>) {
  stops.splice(0, stops.length, ...data.stops)
  routes.splice(0, routes.length, ...data.routes)
}

export const stopById = (id: string): Stop => {
  const s = stops.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown stop: ${id}`)
  return s
}

export const routeById = (id: string): Route => {
  const r = routes.find((x) => x.id === id)
  if (!r) throw new Error(`Unknown route: ${id}`)
  return r
}

/** Non-throwing lookups for ids that may come from storage and point at something an operator has since removed. */
export const findRoute = (id: string): Route | undefined => routes.find((x) => x.id === id)
export const findStop = (id: string): Stop | undefined => stops.find((x) => x.id === id)

export const routeStops = (route: Route): Stop[] => route.stopIds.map((id) => stops.find((s) => s.id === id)).filter((s): s is Stop => !!s)

/** Fixed point of the rider in the demo. Replace with the geolocation hook output. */
export const DEMO_USER_POSITION = { x: 182, y: 196 }

/** Reference points for the location selector in the tracking panel. */
export const locationOptions = [
  { id: 'me', label: 'Current location', x: DEMO_USER_POSITION.x, y: DEMO_USER_POSITION.y },
  { id: 'muet', label: 'MUET Main Gate', x: 130, y: 150 },
  { id: 'sindh-uni', label: 'Sindh University', x: 250, y: 92 },
  { id: 'terminal', label: 'Hyderabad Terminal', x: 825, y: 560 },
] as const

/** Static map decoration (rivers, roads, districts). */
export const mapGeometry = {
  river:
    'M 330 -40 C 380 120, 360 200, 450 280 S 560 330, 600 380 S 640 540, 560 760',
  riverBank:
    'M 352 -40 C 402 120, 382 200, 472 280 S 582 330, 622 380 S 662 540, 582 760',
  highways: [
    // M-9 motorway
    'M -60 330 C 120 330, 300 360, 420 420 S 600 470, 668 432 S 900 300, 1080 280',
    // N-55 Indus highway
    'M 60 40 C 150 120, 280 180, 392 275 S 520 350, 530 362',
  ],
  minorRoads: [
    'M 70 190 L 200 190 L 270 215',
    'M 130 150 L 130 260 L 220 290',
    'M 250 92 L 330 140 L 392 275',
    'M 180 70 L 290 70 L 340 110',
    'M 470 452 L 530 362',
    'M 470 452 L 420 520 L 340 560',
    'M 668 432 L 700 520 L 825 560',
    'M 790 470 L 905 430',
    'M 790 470 L 760 380 L 820 330',
    'M 825 560 L 900 600 L 960 580',
    'M 700 622 L 640 560 L 668 432',
    'M 585 648 L 520 600 L 470 452',
    'M 905 430 L 960 360',
    'M 740 330 L 668 432',
  ],
  districts: [
    { id: 'jamshoro', label: 'Jamshoro', x: 100, y: 40, w: 270, h: 250 },
    { id: 'kotri', label: 'Kotri', x: 400, y: 380, w: 190, h: 150 },
    { id: 'hyderabad', label: 'Hyderabad', x: 700, y: 380, w: 280, h: 280 },
  ],
}

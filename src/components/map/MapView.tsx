import { env } from '@/config/env'
import { SchematicMap } from '@/components/map/SchematicMap'
import type { MapViewProps } from '@/components/map/types'

/**
 * Single entry point for every map in the app.
 *
 * To add a real provider:
 *  1. Create e.g. components/map/MapboxMap.tsx that implements MapViewProps (buses, selection, user position, route fit).
 *  2. Convert stop/bus x,y to lng/lat in data/mockRoutes.ts (or fetch them from your API).
 *  3. Return it below when env.mapProvider matches. Use a public, domain-restricted token from VITE_MAP_PUBLIC_TOKEN.
 */
export function MapView(props: MapViewProps) {
  switch (env.mapProvider) {
    // case 'mapbox': return <MapboxMap {...props} />
    // case 'google': return <GoogleMapsMap {...props} />
    // case 'osm': return <LeafletMap {...props} />
    case 'mock':
    default:
      return <SchematicMap {...props} />
  }
}

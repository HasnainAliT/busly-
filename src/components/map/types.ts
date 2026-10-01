import type { BusInsight } from '@/utils/bus'
import type { Point } from '@/types'

export interface MapInset {
  top: number
  right: number
  bottom: number
  left: number
}

/**
 * The contract every map implementation must satisfy. The schematic map below implements it today;
 * a Mapbox / Google Maps / OpenStreetMap adapter can implement the same props later and be swapped
 * in from `MapView` without touching any page or panel.
 */
export interface MapViewProps {
  buses: BusInsight[]
  selectedBusId: string | null
  onSelectBus: (id: string | null) => void
  userPosition: Point | null
  /** Route to emphasise when no bus is selected (e.g. on the Routes page). */
  fitRouteId?: string | null
  /** Pixels covered by overlaid UI (panels, sheets) so focus targets stay visible. */
  focusInset?: Partial<MapInset>
  interactive?: boolean
  showControls?: boolean
  showLegend?: boolean
  showAllRouteLines?: boolean
  /** Zoom used when a bus is selected, as a multiple of the fit-all zoom. */
  focusZoom?: number
  /** Keep the camera on the selected bus as it moves. */
  followSelected?: boolean
  className?: string
  ariaLabel?: string
}

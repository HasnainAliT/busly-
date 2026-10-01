import { useMemo, useState } from 'react'
import { locationOptions } from '@/data/mockRoutes'
import { distance } from '@/utils/geometry'
import { KM_PER_UNIT } from '@/domain/geo'
import { sanitizeText } from '@/utils/security'
import type { BusInsight } from '@/utils/bus'

export type StatusFilter = 'all' | 'active' | 'delayed' | 'available' | 'break' | 'offline' | 'favorites' | 'nearby'

export interface BusFilters {
  query: string
  routeId: string
  status: StatusFilter
  locationId: string
}

export const NEARBY_RADIUS = 240

export const formatDistance = (units: number) => {
  const km = units * KM_PER_UNIT
  return km < 1 ? `${Math.round(km * 10) * 100} m` : `${km.toFixed(1)} km`
}

export const initialFilters: BusFilters = { query: '', routeId: 'all', status: 'all', locationId: 'me' }

export function useBusFilters(insights: BusInsight[], favoriteBusIds: string[], locationAvailable: boolean) {
  const [filters, setFilters] = useState<BusFilters>(initialFilters)

  const reference = useMemo(() => {
    const opt = locationOptions.find((l) => l.id === filters.locationId) ?? locationOptions[0]
    // Without location access, "Current location" falls back to a fixed campus point so sorting still works.
    return opt.id === 'me' && !locationAvailable ? locationOptions[1] : opt
  }, [filters.locationId, locationAvailable])

  const results = useMemo(() => {
    const q = sanitizeText(filters.query, 40).toLowerCase()
    return insights
      .map((i) => ({ insight: i, distance: distance(i.position, reference) }))
      .filter(({ insight: i, distance: d }) => {
        if (filters.routeId !== 'all' && i.route.id !== filters.routeId) return false
        if (filters.status === 'favorites' && !favoriteBusIds.includes(i.bus.id)) return false
        if (filters.status === 'nearby' && (d > NEARBY_RADIUS || i.bus.status === 'offline')) return false
        if (['active', 'delayed', 'available', 'break', 'offline'].includes(filters.status) && i.bus.status !== filters.status) return false
        if (!q) return true
        const hay = [i.bus.id, i.bus.busNumber, i.route.name, `route ${i.route.code}`, i.currentStop.name, i.nextStop?.name ?? '', i.bus.plate].join(' ').toLowerCase()
        return q.split(/\s+/).every((part) => hay.includes(part))
      })
      .sort((a, b) => {
        // Offline buses sink to the bottom; everything else is ordered by distance to the chosen reference.
        const off = Number(a.insight.bus.status === 'offline') - Number(b.insight.bus.status === 'offline')
        return off || a.distance - b.distance
      })
  }, [insights, filters, favoriteBusIds, reference])

  const hasActiveFilters = filters.query !== '' || filters.routeId !== 'all' || filters.status !== 'all'
  const reset = () => setFilters((f) => ({ ...initialFilters, locationId: f.locationId }))

  return { filters, setFilters, results, reference, hasActiveFilters, reset }
}

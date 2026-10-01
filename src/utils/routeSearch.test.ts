import { describe, expect, it } from 'vitest'
import { findRoutes, findTransfers, partFare } from '@/utils/routeSearch'
import { routes } from '@/data/mockRoutes'

describe('fares and transfers', () => {
  it('charges part of the full fare for part of a route, never below PKR 20', () => {
    const a = routes.find((r) => r.id === 'route-a')!
    expect(partFare(a, a.stopIds.length - 1)).toBe(a.fare)
    expect(partFare(a, 1)).toBeGreaterThanOrEqual(20)
    expect(partFare(a, 1)).toBeLessThan(a.fare)
  })
  it('finds a direct route with a fare', () => {
    const m = findRoutes('MUET', 'Hyderabad', [])
    expect(m.length).toBeGreaterThan(0)
    expect(m[0].fare).toBeGreaterThan(0)
  })
  it('suggests a change when no single bus connects two places', () => {
    expect(findRoutes('Kotri Station', 'Hyderabad', [])).toHaveLength(0)
    const t = findTransfers('Kotri Station', 'Hyderabad', [])
    expect(t.length).toBeGreaterThan(0)
    expect(t[0].first.route.id).not.toBe(t[0].second.route.id)
    expect(t[0].fare).toBe(t[0].first.fare + t[0].second.fare)
  })
})

import { describe, expect, it } from 'vitest'
import { computeAnalytics } from './analytics'
import { computeInsights, zScore } from './insights'
import { createSeedData } from './seed'
import type { TransitData } from './types'

const NOW = new Date(2026, 9, 7, 17, 30, 0).getTime()

describe('zScore', () => {
  it('is 0 without enough history and ignores tiny wobbles on a steady history', () => {
    expect(zScore(10, [1, 2])).toBe(0)
    expect(zScore(1.4, [1, 1, 1, 1, 1])).toBeLessThan(1)
  })
  it('grows when a value is far from its own history', () => {
    expect(zScore(9, [1, 1.2, 0.9, 1.1, 1])).toBeGreaterThan(5)
  })
})

describe('insights', () => {
  const base = createSeedData(NOW)

  it('is attached to analytics and every insight explains itself with evidence', () => {
    const a = computeAnalytics(base, NOW)
    expect(Array.isArray(a.insights)).toBe(true)
    for (const i of a.insights) {
      expect(i.why.length).toBeGreaterThan(10)
      expect(i.evidence.length).toBeGreaterThan(0)
    }
  })

  it('flags a route that is much later today than on its own recent days, and not before', () => {
    const t0 = new Date(NOW)
    t0.setHours(0, 0, 0, 0)
    const quiet = computeInsights(base, NOW)
    expect(quiet.some((i) => i.id === 'delay-anomaly-route-c')).toBe(false)

    const d: TransitData = {
      ...base,
      trips: base.trips.map((t) => (t.routeId === 'route-c' && t.endTime != null && t.endTime >= t0.getTime() ? { ...t, delayMinutes: 14 } : t)),
    }
    const hit = computeInsights(d, NOW).find((i) => i.id === 'delay-anomaly-route-c')
    expect(hit).toBeDefined()
    expect(hit?.kind).toBe('anomaly')
    expect(hit?.evidence.map((e) => e.label)).toContain('Today')
  })

  it('returns nothing and does not throw with no trips', () => {
    expect(computeInsights({ ...base, trips: [] }, NOW)).toEqual([])
  })
})

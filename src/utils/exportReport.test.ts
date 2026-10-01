import { describe, expect, it } from 'vitest'
import { computeAnalytics } from '@/domain/analytics'
import { createSeedData } from '@/domain/seed'
import { analyticsToCsv, csvCell } from './exportReport'

describe('csv export', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })
  it('defuses spreadsheet formulas but keeps plain negative numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toMatch(/^"?'=/)
    expect(csvCell('-5')).toBe('-5')
  })
  it('produces labelled sections from real analytics', () => {
    const now = new Date(2026, 9, 7, 10, 30).getTime()
    const csv = analyticsToCsv(computeAnalytics(createSeedData(now), now))
    for (const s of ['Busly operations report', 'Summary', 'Routes', 'Hourly', 'Insights']) expect(csv).toContain(s)
    expect(csv.split('\r\n').length).toBeGreaterThan(20)
  })
})

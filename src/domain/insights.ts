import type { TransitData, Trip } from './types'
import { actualMinutes } from './tripMath'

/* ------------------------------------------------------------------ *
 * Explainable insights.
 * Every insight carries the numbers it was derived from ("evidence"), so
 * an operator can see WHY it was raised. Methods are plain statistics:
 *  - anomaly: z-score of today's value against the route's own history
 *  - comparison: today against the average of the previous days
 *  - recommendation: sustained high load at one hour of day
 * There is no trained model, and the UI says so.
 * ------------------------------------------------------------------ */

const DAY = 864e5

export type InsightKind = 'anomaly' | 'comparison' | 'recommendation'
export type InsightSeverity = 'info' | 'watch' | 'act'

export interface Insight {
  id: string
  kind: InsightKind
  severity: InsightSeverity
  title: string
  /** One plain sentence on why this was raised. */
  why: string
  /** The numbers behind it. */
  evidence: { label: string; value: string }[]
  routeId?: string
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const std = (xs: number[]) => {
  if (xs.length < 2) return 0
  const m = avg(xs)
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)))
}
const r1 = (n: number) => Math.round(n * 10) / 10

/** z-score with a floor on the spread so a perfectly steady history does not flag tiny wobbles. */
export function zScore(value: number, history: number[], minSpread = 0.75): number {
  if (history.length < 3) return 0
  return (value - avg(history)) / Math.max(std(history), minSpread)
}

const doneTrips = (d: TransitData, from: number, to: number): Trip[] =>
  d.trips.filter((t) => t.status === 'completed' && t.endTime != null && (t.endTime as number) >= from && (t.endTime as number) < to)

export function computeInsights(d: TransitData, now: number): Insight[] {
  const out: Insight[] = []
  const t0 = new Date(now)
  t0.setHours(0, 0, 0, 0)
  const today0 = t0.getTime()
  const todayTrips = doneTrips(d, today0, now + 1)
  const historyDays = Array.from({ length: 6 }, (_, i) => today0 - (i + 1) * DAY)

  for (const r of d.routes) {
    const todays = todayTrips.filter((t) => t.routeId === r.id)
    const perDay = historyDays
      .map((from) => doneTrips(d, from, from + DAY).filter((t) => t.routeId === r.id))
      .filter((ts) => ts.length > 0)
      .map((ts) => avg(ts.map((t) => t.delayMinutes)))
    if (todays.length >= 2 && perDay.length >= 3) {
      const today = avg(todays.map((t) => t.delayMinutes))
      const z = zScore(today, perDay)
      const base = avg(perDay)
      if (z >= 2 && today - base >= 1.5) {
        out.push({
          id: `delay-anomaly-${r.id}`,
          kind: 'anomaly',
          severity: z >= 3 ? 'act' : 'watch',
          title: `Route ${r.code} is running later than usual today`,
          why: `Today's average delay is ${z.toFixed(1)} standard deviations above this route's own recent days.`,
          evidence: [
            { label: 'Today', value: `${r1(today)} min` },
            { label: `Usual (${perDay.length} days)`, value: `${r1(base)} min` },
            { label: 'Trips today', value: String(todays.length) },
          ],
          routeId: r.id,
        })
      }
    }

    const durs = historyDays.flatMap((from) => doneTrips(d, from, from + DAY).filter((t) => t.routeId === r.id).map(actualMinutes))
    if (todays.length >= 2 && durs.length >= 8) {
      const today = avg(todays.map(actualMinutes))
      const z = zScore(today, durs, 1.5)
      if (z >= 2.5 && today / avg(durs) >= 1.15) {
        out.push({
          id: `duration-anomaly-${r.id}`,
          kind: 'anomaly',
          severity: 'watch',
          title: `Route ${r.code} trips are taking longer than normal`,
          why: `Today's trips take ${Math.round((today / avg(durs) - 1) * 100)}% longer than the route's recent average.`,
          evidence: [
            { label: 'Today', value: `${Math.round(today)} min` },
            { label: 'Recent average', value: `${Math.round(avg(durs))} min` },
          ],
          routeId: r.id,
        })
      }
    }

    // Historical comparison: today's trip count against the average of the previous days.
    const dayCounts = historyDays.map((from) => doneTrips(d, from, from + DAY).filter((t) => t.routeId === r.id).length)
    const hoursIn = Math.max(1, (now - today0) / 36e5)
    const expectedSoFar = (avg(dayCounts) * Math.min(hoursIn, 18)) / 18
    if (avg(dayCounts) >= 6 && hoursIn >= 8 && todays.length < expectedSoFar * 0.6) {
      out.push({
        id: `volume-${r.id}`,
        kind: 'comparison',
        severity: 'watch',
        title: `Route ${r.code} has run fewer trips than usual by now`,
        why: 'Completed trips so far today are well below the typical pace for this time of day.',
        evidence: [
          { label: 'Completed today', value: String(todays.length) },
          { label: 'Typical by now', value: String(Math.round(expectedSoFar)) },
        ],
        routeId: r.id,
      })
    }

    // Recommendation: sustained load at one hour.
    const week = historyDays.flatMap((from) => doneTrips(d, from, from + DAY).filter((t) => t.routeId === r.id))
    const byHour = new Map<number, Trip[]>()
    for (const t of week) byHour.set(new Date(t.startTime).getHours(), [...(byHour.get(new Date(t.startTime).getHours()) ?? []), t])
    const worst = [...byHour.entries()].map(([h, ts]) => ({ h, o: avg(ts.map((t) => t.peakOccupancy)), n: ts.length, days: new Set(ts.map((t) => new Date(t.startTime).toDateString())).size })).filter((x) => x.n >= 3 && x.days >= 3).sort((a, b) => b.o - a.o)[0]
    if (worst && worst.o >= 85) {
      out.push({
        id: `load-${r.id}-${worst.h}`,
        kind: 'recommendation',
        severity: worst.o >= 92 ? 'act' : 'watch',
        title: `Add capacity on Route ${r.code} around ${String(worst.h).padStart(2, '0')}:00`,
        why: `Buses at this hour were close to full on ${worst.days} of the last 6 days. A gap of ${r.frequencyMin} minutes is too long for that load.`,
        evidence: [
          { label: 'Average peak load', value: `${Math.round(worst.o)}%` },
          { label: 'Days seen', value: `${worst.days} of 6` },
          { label: 'Current gap', value: `${r.frequencyMin} min` },
        ],
        routeId: r.id,
      })
    }
  }

  const rank = { act: 0, watch: 1, info: 2 } as const
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
}

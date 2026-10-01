import { describe, expect, it } from 'vitest'
import { applyAction, canDo, etaToStop, reconcile, viewBus, viewData, diffStopEvents, GPS_STALE_MS, type Action, type Actor } from './engine'
import { computeAnalytics, predictDurationMin } from './analytics'
import { geoToXY, projectOnRoute, xyToGeo } from './geo'
import { createSeedData } from './seed'
import type { TransitData } from './types'

// Mid-morning on a Wednesday so the seeded "Route A is late at 08:00" pattern is in the past for today.
const NOW = new Date(2026, 9, 7, 10, 30, 0).getTime()
const seed = () => createSeedData(NOW)

const driver: Actor = { userId: 'u-driver', role: 'driver', name: 'Imran Khoso' }
const driver2: Actor = { userId: 'u-driver2', role: 'driver', name: 'Sana Memon' }
const rider: Actor = { userId: 'u-rider', role: 'rider', name: 'Demo Rider' }
const operator: Actor = { userId: 'u-operator', role: 'operator', name: 'Omar Dispatcher' }
const admin: Actor = { userId: 'u-admin', role: 'admin', name: 'Amina Admin' }

function run(d: TransitData, a: Action, who: Actor | null, at = NOW) {
  const r = applyAction(d, a, who, at)
  if (!r.ok) throw new Error(`${a.type} failed: ${r.code} ${r.message}`)
  return r.data
}
const err = (d: TransitData, a: Action, who: Actor | null, at = NOW) => {
  const r = applyAction(d, a, who, at)
  if (r.ok) throw new Error(`${a.type} should have failed`)
  return r
}

describe('seed data', () => {
  const d = seed()
  it('is internally consistent', () => {
    for (const r of d.routes) for (const id of r.stopIds) expect(d.stops.find((s) => s.id === id), `${r.id} -> ${id}`).toBeTruthy()
    for (const b of d.buses) expect(d.routes.find((r) => r.id === b.routeId)).toBeTruthy()
    for (const b of d.buses.filter((x) => x.status === 'active' || x.status === 'delayed')) expect(d.trips.find((t) => t.id === b.tripId && !t.endTime), b.id).toBeTruthy()
  })
  it('covers the five bus statuses from the brief', () => {
    expect(new Set(d.buses.map((b) => b.status))).toEqual(new Set(['available', 'active', 'delayed', 'break', 'offline']))
  })
  it('maps schematic coordinates to lat/lng and back', () => {
    const s = d.stops[0]
    const back = geoToXY(s.lat, s.lng)
    expect(Math.abs(back.x - s.x)).toBeLessThan(0.5)
    expect(Math.abs(back.y - s.y)).toBeLessThan(0.5)
    expect(xyToGeo({ x: 130, y: 150 }).lat).toBeCloseTo(25.4167, 2)
  })
})

describe('live view and reconcile', () => {
  it('moves simulated buses forward with the clock', () => {
    const d = seed()
    const bus = d.buses.find((b) => b.id === 'BUS-104')!
    const a = viewBus(d, bus, NOW).progress
    const b = viewBus(d, bus, NOW + 20_000).progress
    expect(b).toBeGreaterThan(a)
  })

  it('completes a finished trip and restarts auto-run buses', () => {
    const d = seed()
    const later = NOW + 5 * 60_000 // 14x speed: well past one lap
    const { data, changed } = reconcile(d, later)
    expect(changed).toBe(true)
    const bus = data.buses.find((b) => b.id === 'BUS-104')!
    expect(bus.tripId).not.toBe(d.buses.find((b) => b.id === 'BUS-104')!.tripId)
    expect(data.trips.filter((t) => t.busId === 'BUS-104' && t.status === 'completed' && !t.sample).length).toBe(1)
    // Idempotent for the same instant.
    const again = reconcile(data, later)
    expect(again.changed).toBe(false)
  })

  it('emits stop-reached events by diffing states', () => {
    const d = seed()
    const next = reconcile(d, NOW + 90_000).data
    const events = diffStopEvents(d, next)
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toMatchObject({ kind: 'stop-reached' })
  })

  it('computes an ETA from distance, speed and progress', () => {
    const d = seed()
    const v = viewData(d, NOW)
    const bus = v.buses.find((b) => b.id === 'BUS-104')!
    const eta = etaToStop(v, bus, 'terminal')!
    expect(eta).toBeGreaterThan(10)
    expect(eta).toBeLessThan(45)
    const slow = etaToStop(v, { ...bus, speedKmh: 10 }, 'terminal')!
    expect(slow).toBeGreaterThan(eta)
  })
})

describe('driver trip workflow', () => {
  it('runs start, delay, stop, resume and end with alerts for riders', () => {
    let d = seed()
    d = run(d, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver)
    const bus = () => d.buses.find((b) => b.id === 'BUS-112')!
    expect(bus().status).toBe('active')
    const trip = d.trips.find((t) => t.id === bus().tripId)!
    expect(trip.locSource).toBe('simulated')
    expect(d.drivers.find((x) => x.id === 'd-08')!.currentTripId).toBe(trip.id)

    d = run(d, { type: 'trip/update', tripId: trip.id, kind: 'traffic-delay', delayMin: 15, note: 'Road works' }, driver, NOW + 5_000)
    expect(bus().status).toBe('delayed')
    expect(d.alerts[0].title).toBe('Route A is delayed by approximately 15 minutes')

    d = run(d, { type: 'trip/update', tripId: trip.id, kind: 'temporary-stop' }, driver, NOW + 10_000)
    expect(bus().status).toBe('break')
    const frozen = viewBus(d, bus(), NOW + 10_000).progress
    expect(viewBus(d, bus(), NOW + 60_000).progress).toBe(frozen)

    d = run(d, { type: 'trip/update', tripId: trip.id, kind: 'resume' }, driver, NOW + 60_000)
    expect(bus().status).toBe('delayed')
    expect(viewBus(d, bus(), NOW + 80_000).progress).toBeGreaterThan(frozen)

    d = run(d, { type: 'trip/end', tripId: trip.id }, driver, NOW + 90_000)
    expect(bus().status).toBe('available')
    expect(d.trips.find((t) => t.id === trip.id)!.status).toBe('completed')
    expect(d.drivers.find((x) => x.id === 'd-08')!.currentTripId).toBeNull()
    expect(d.alerts.some((a) => a.kind === 'trip-ended' && a.busId === 'BUS-112')).toBe(true)
  })

  it('a vehicle issue ends the trip and takes the bus offline', () => {
    let d = run(seed(), { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver)
    const tripId = d.buses.find((b) => b.id === 'BUS-112')!.tripId!
    d = run(d, { type: 'trip/update', tripId, kind: 'vehicle-issue', note: 'Flat tyre' }, driver, NOW + 4000)
    expect(d.buses.find((b) => b.id === 'BUS-112')!.status).toBe('offline')
    expect(d.trips.find((t) => t.id === tripId)!.status).toBe('ended-vehicle-issue')
    expect(d.alerts[0].title).toBe('BUS-112 has ended its trip due to a vehicle issue')
  })

  it('refuses invalid or unauthorised driver actions', () => {
    const d = seed()
    expect(err(d, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, rider).code).toBe('forbidden')
    expect(err(d, { type: 'trip/start', busId: 'BUS-120', source: 'simulated' }, driver).code).toBe('not-your-bus')
    expect(err(d, { type: 'trip/start', busId: 'BUS-104', source: 'simulated' }, driver).code).toBe('not-your-bus')
    expect(err(d, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, null).code).toBe('unauthenticated')
    const started = run(d, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver)
    expect(err(started, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver).code).toBe('trip-active')
    const tripId = started.buses.find((b) => b.id === 'BUS-112')!.tripId!
    expect(err(started, { type: 'trip/end', tripId }, driver2).code).toBe('forbidden')
    expect(err(started, { type: 'trip/update', tripId, kind: 'traffic-delay', delayMin: 0 }, driver).code).toBe('invalid')
    expect(err(started, { type: 'trip/update', tripId, kind: 'traffic-delay', delayMin: 999 }, driver).code).toBe('invalid')
  })

  it('an unfinished simulated trip completes itself on arrival', () => {
    let d = run(seed(), { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver)
    const tripId = d.buses.find((b) => b.id === 'BUS-112')!.tripId!
    d = reconcile(d, NOW + 6 * 60_000).data
    expect(d.trips.find((t) => t.id === tripId)!.status).toBe('completed')
    expect(d.buses.find((b) => b.id === 'BUS-112')!.status).toBe('available')
  })
})

describe('phone GPS', () => {
  const startGps = () => run(seed(), { type: 'trip/start', busId: 'BUS-112', source: 'gps' }, driver)
  const point = (d: TransitData, frac: number) => {
    const route = d.routes.find((r) => r.id === 'route-a')!
    const a = d.stops.find((s) => s.id === route.stopIds[1])!
    const b = d.stops.find((s) => s.id === route.stopIds[2])!
    return { lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac }
  }

  it('projects a fix onto the route and updates the bus', () => {
    let d = startGps()
    const p = point(d, 0.5)
    d = run(d, { type: 'driver/location', busId: 'BUS-112', ...p, speedKmh: 42 }, driver, NOW + 3000)
    const bus = d.buses.find((b) => b.id === 'BUS-112')!
    expect(bus.progress).toBeGreaterThan(0.2)
    expect(bus.progress).toBeLessThan(0.6)
    expect(viewBus(d, bus, NOW + 4000).speedKmh).toBe(42)
  })

  it('rejects a fix far from the route', () => {
    const d = startGps()
    const r = err(d, { type: 'driver/location', busId: 'BUS-112', lat: 24.86, lng: 67.0, speedKmh: 30 }, driver, NOW + 3000)
    expect(r.code).toBe('off-route')
    expect(projectOnRoute({ points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], cumulative: [0, 10], total: 10, lengthKm: 1, stopProgress: [0, 1] }, { x: 5, y: 3 }).missUnits).toBe(3)
  })

  it('flags "location temporarily unavailable" when the GPS goes quiet', () => {
    let d = startGps()
    d = run(d, { type: 'driver/location', busId: 'BUS-112', ...point(d, 0.3), speedKmh: 30 }, driver, NOW + 2000)
    const fresh = viewBus(d, d.buses.find((b) => b.id === 'BUS-112')!, NOW + 5000)
    expect(fresh.locationLost).toBe(false)
    const quiet = NOW + 2000 + GPS_STALE_MS + 5000
    const stale = viewBus(d, d.buses.find((b) => b.id === 'BUS-112')!, quiet)
    expect(stale.locationLost).toBe(true)
    expect(stale.speedKmh).toBe(0)
    d = reconcile(d, quiet).data
    expect(d.buses.find((b) => b.id === 'BUS-112')!.locationLost).toBe(true)
    // A new fix restores it.
    d = run(d, { type: 'driver/location', busId: 'BUS-112', ...point(d, 0.4), speedKmh: 28 }, driver, quiet + 1000)
    expect(d.buses.find((b) => b.id === 'BUS-112')!.locationLost).toBe(false)
  })

  it('goes offline after five minutes of silence', () => {
    let d = startGps()
    d = run(d, { type: 'driver/location', busId: 'BUS-112', ...point(d, 0.3), speedKmh: 30 }, driver, NOW + 2000)
    d = reconcile(d, NOW + 6 * 60_000).data
    expect(d.buses.find((b) => b.id === 'BUS-112')!.status).toBe('offline')
  })

  it('rejects GPS fixes on a simulated trip', () => {
    const d = run(seed(), { type: 'trip/start', busId: 'BUS-112', source: 'simulated' }, driver)
    expect(err(d, { type: 'driver/location', busId: 'BUS-112', ...point(d, 0.2) }, driver, NOW + 1000).code).toBe('invalid')
  })
})

describe('operator management', () => {
  it('creates, edits and deletes buses with validation', () => {
    let d = seed()
    const bad = err(d, { type: 'bus/create', bus: { routeId: 'route-a', plate: '!!', model: 'Hino', capacity: 50, accessible: true } }, operator)
    expect(bad.code).toBe('invalid')
    expect(err(d, { type: 'bus/create', bus: { routeId: 'route-a', plate: 'SKR-3104', model: 'Hino', capacity: 50, accessible: true } }, operator).code).toBe('duplicate')
    const r = applyAction(d, { type: 'bus/create', bus: { routeId: 'route-c', plate: 'skr-7777', model: 'Yutong ZK6', capacity: 45, accessible: true } }, operator, NOW)
    if (!r.ok) throw new Error(r.message)
    d = r.data
    expect(r.created).toMatch(/^BUS-\d{3}$/)
    expect(d.buses.find((b) => b.id === r.created)!.plate).toBe('SKR-7777')
    d = run(d, { type: 'bus/update', busId: r.created!, patch: { capacity: 60 } }, operator)
    expect(d.buses.find((b) => b.id === r.created)!.capacity).toBe(60)
    expect(err(d, { type: 'bus/delete', busId: 'BUS-104' }, operator).code).toBe('trip-active')
    d = run(d, { type: 'bus/delete', busId: r.created! }, operator)
    expect(d.buses.find((b) => b.id === r.created)).toBeUndefined()
  })

  it('assigns drivers and prevents double assignment during a trip', () => {
    let d = seed()
    d = run(d, { type: 'bus/assign', busId: 'BUS-120', driverId: 'd-08' }, operator)
    expect(d.buses.find((b) => b.id === 'BUS-120')!.driverId).toBe('d-08')
    expect(d.buses.find((b) => b.id === 'BUS-112')!.driverId).toBeNull()
    expect(err(d, { type: 'bus/assign', busId: 'BUS-104', driverId: 'd-08' }, operator).code).toBe('trip-active')
  })

  it('creates a route and protects stops and buses that are in use', () => {
    let d = seed()
    d = run(d, { type: 'route/create', route: { code: 'E', name: 'Latifabad → Tando Jam', from: 'Latifabad', to: 'Tando Jam', stopIds: ['latifabad', 'terminal', 'tando-jam'], durationMin: 28, frequencyMin: 20, firstDeparture: '07:00', lastDeparture: '19:00', fare: 100 } }, operator)
    expect(d.routes.some((r) => r.code === 'E')).toBe(true)
    expect(err(d, { type: 'route/create', route: { code: 'E', name: 'Duplicate route', from: 'a', to: 'b', stopIds: ['latifabad', 'terminal'], durationMin: 20, frequencyMin: 10, firstDeparture: '07:00', lastDeparture: '19:00', fare: 50 } }, operator).code).toBe('invalid')
    expect(err(d, { type: 'route/create', route: { code: 'F', name: 'Bad stops', from: 'a', to: 'b', stopIds: ['latifabad', 'nowhere'], durationMin: 20, frequencyMin: 10, firstDeparture: '07:00', lastDeparture: '19:00', fare: 50 } }, operator).message).toMatch(/does not exist/)
    expect(err(d, { type: 'stop/delete', stopId: 'terminal' }, operator).code).toBe('in-use')
    expect(err(d, { type: 'route/delete', routeId: 'route-a' }, operator).code).toBe('in-use')
    d = run(d, { type: 'route/delete', routeId: 'route-e' }, operator)
    expect(d.routes.some((r) => r.code === 'E')).toBe(false)
  })

  it('adds a stop from coordinates and rejects ones outside the map', () => {
    let d = seed()
    const g = xyToGeo({ x: 600, y: 300 })
    const r = applyAction(d, { type: 'stop/create', stop: { name: 'Test Stop', ...g, kind: 'town' } }, operator, NOW)
    if (!r.ok) throw new Error(r.message)
    d = r.data
    expect(d.stops.find((s) => s.id === r.created)!.x).toBeCloseTo(600, 0)
    expect(err(d, { type: 'stop/create', stop: { name: 'Far Away', lat: 10, lng: 10, kind: 'town' } }, operator).code).toBe('out-of-area')
    d = run(d, { type: 'stop/delete', stopId: r.created! }, operator)
  })

  it('closing a stop publishes an alert and reopening resolves it', () => {
    let d = run(seed(), { type: 'stop/close', stopId: 'qasimabad', closed: true, reason: 'Road closure' }, operator)
    expect(d.stops.find((s) => s.id === 'qasimabad')!.closed).toBe(true)
    expect(d.alerts[0]).toMatchObject({ kind: 'stop-closed', title: 'Qasimabad is temporarily unavailable', active: true })
    d = run(d, { type: 'stop/close', stopId: 'qasimabad', closed: false }, operator)
    expect(d.alerts.find((a) => a.kind === 'stop-closed')!.active).toBe(false)
  })

  it('publishes, sanitises and resolves service alerts', () => {
    let d = seed()
    d = run(d, { type: 'alert/publish', title: 'Route A <b>delay</b>', body: 'Expect 15 minutes extra‮ today', routeId: 'route-a' }, operator)
    expect(d.alerts[0].title).toBe('Route A bdelay/b')
    expect(d.alerts[0].body).not.toContain('‮')
    expect(err(d, { type: 'alert/publish', title: 'x', body: 'short message', routeId: 'route-a' }, operator).code).toBe('invalid')
    expect(err(d, { type: 'alert/publish', title: 'Valid title', body: 'Valid body text', routeId: 'route-zz' }, operator).code).toBe('not-found')
    d = run(d, { type: 'alert/resolve', alertId: d.alerts[0].id }, operator)
    expect(d.alerts[0].active).toBe(false)
  })

  it('cancelling a trip frees the bus and alerts riders', () => {
    const d0 = seed()
    const tripId = d0.buses.find((b) => b.id === 'BUS-104')!.tripId!
    const d = run(d0, { type: 'trip/cancel', tripId, reason: 'Driver unavailable' }, operator)
    expect(d.buses.find((b) => b.id === 'BUS-104')!.status).toBe('available')
    expect(d.alerts[0].kind).toBe('trip-cancelled')
  })
})

describe('roles and permissions', () => {
  it('limits sensitive actions by role', () => {
    expect(canDo('rider', 'bus/create')).toBe(false)
    expect(canDo('driver', 'bus/create')).toBe(false)
    expect(canDo('operator', 'bus/create')).toBe(true)
    expect(canDo('operator', 'user/setRole')).toBe(false)
    expect(canDo('admin', 'user/setRole')).toBe(true)
    expect(canDo('operator', 'trip/start')).toBe(false)
    expect(canDo(undefined, 'crowd/report')).toBe(false)
  })

  it('protects the last admin and self-changes', () => {
    const d = seed()
    expect(err(d, { type: 'user/setRole', userId: 'u-admin', role: 'rider' }, admin).message).toMatch(/own role/)
    expect(err(d, { type: 'user/setActive', userId: 'u-admin', active: false }, admin).message).toMatch(/own account/)
    const promoted = run(d, { type: 'user/setRole', userId: 'u-rider', role: 'driver' }, admin)
    expect(promoted.drivers.some((x) => x.userId === 'u-rider')).toBe(true)
    expect(err(d, { type: 'user/setRole', userId: 'u-rider', role: 'admin' }, operator).code).toBe('forbidden')
    expect(err(d, { type: 'user/create', name: 'Dup', email: 'admin@busly.app', role: 'rider' }, admin).code).toBe('duplicate')
  })

  it('lets riders report crowding and issues', () => {
    let d = run(seed(), { type: 'crowd/report', busId: 'BUS-104', level: 'full' }, rider)
    expect(d.buses.find((b) => b.id === 'BUS-104')!.occupancy).toBeGreaterThan(64)
    d = run(d, { type: 'issue/report', busId: 'BUS-104', category: 'Running late', note: 'Waited 20 minutes' }, rider)
    expect(d.reports[0].busId).toBe('BUS-104')
    expect(err(d, { type: 'crowd/report', busId: 'BUS-112', level: 'full' }, rider).code).toBe('invalid')
  })
})

describe('analytics', () => {
  const d = seed()
  const a = computeAnalytics(d, NOW)
  it('summarises the fleet and the day', () => {
    expect(a.fleet.total).toBe(11)
    expect(a.fleet.delayed).toBe(2)
    expect(a.tripsCompletedToday).toBeGreaterThan(0)
    expect(a.avgTripDurationMin).toBeGreaterThan(15)
    expect(a.completionRate).toBeGreaterThan(90)
  })
  it('finds the most used routes and stops from trip data', () => {
    expect(a.mostUsedRoutes.length).toBe(4)
    expect(a.mostUsedStops[0].visits).toBeGreaterThan(0)
    expect(a.mostDelayedRoutes[0].code).toBe('A')
  })
  it('detects a repeating delay pattern and scores ETA accuracy', () => {
    expect(a.patterns.some((p) => p.includes('Route A') && p.includes('08:00'))).toBe(true)
    expect(a.etaAccuracy).toBeGreaterThan(60)
    expect(a.etaAccuracy).toBeLessThanOrEqual(100)
  })
  it('predicts trip duration from history', () => {
    expect(predictDurationMin(d, 'route-a', 8)).toBeGreaterThan(predictDurationMin(d, 'route-a', 11) - 1)
  })
})

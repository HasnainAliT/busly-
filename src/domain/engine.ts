import { etaMinutes, geoToXY, isValidLatLng, KM_PER_UNIT, pointAt, progressPerSecond, projectOnRoute, routeGeometryFor, stopIndexAt, xyToGeo, type RouteGeometry } from './geo'
import { predictDurationMin } from './analytics'
import type { Role, BusRecord, BusStatus, LocationSource, Route, ServiceAlert, Stop, TransitData, Trip, TripStatus, AlertKind } from './types'

/* ------------------------------------------------------------------ *
 * Tunables
 * ------------------------------------------------------------------ */
export const GPS_STALE_MS = 20_000
export const GPS_OFFLINE_MS = 5 * 60_000
export const OFF_ROUTE_UNITS = 60 // ~1.4 km on the schematic map
export const MAX_TRIPS_KEPT = 4000

export const BUS_ID_RE = /^BUS-\d{3,4}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const MOVING: BusStatus[] = ['active', 'delayed']

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g
/** Strips control and bidi characters and angle brackets. React escapes output too; this keeps stored text clean. */
export const clean = (s: unknown, max = 200): string => (typeof s === 'string' ? s.replace(CONTROL, '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const hash = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export const routeOf = (d: TransitData, id: string) => d.routes.find((r) => r.id === id)
export const stopOf = (d: TransitData, id: string) => d.stops.find((s) => s.id === id)
export const busOf = (d: TransitData, id: string) => d.buses.find((b) => b.id === id)

export function stopsOfRoute(d: TransitData, route: Route): Stop[] {
  return route.stopIds.map((id) => stopOf(d, id)).filter((s): s is Stop => !!s)
}

export function geometryOf(d: TransitData, route: Route): RouteGeometry {
  return routeGeometryFor(route, stopsOfRoute(d, route))
}

/* ------------------------------------------------------------------ *
 * Live view: positions are computed from the persisted anchor and the
 * clock, so any number of clients agree without a stream of coordinates.
 * ------------------------------------------------------------------ */

export function liveProgress(d: TransitData, bus: BusRecord, now: number): number {
  const route = routeOf(d, bus.routeId)
  if (!route || !MOVING.includes(bus.status) || bus.locSource !== 'simulated') return bus.progress
  const g = geometryOf(d, route)
  const elapsed = Math.max(0, now - bus.simAt) / 1000
  return clamp(bus.simProgress + elapsed * progressPerSecond(g, bus.cruiseKmh, d.simSpeed), 0, 1)
}

export function viewBus(d: TransitData, bus: BusRecord, now: number): BusRecord {
  const h = hash(bus.id)
  const moving = MOVING.includes(bus.status)
  const gpsLost = bus.locSource === 'gps' && moving && now - (bus.lastGpsAt ?? 0) > GPS_STALE_MS
  const progress = liveProgress(d, bus, now)
  let speedKmh = bus.speedKmh
  let lastUpdated = bus.lastUpdated
  if (moving && bus.locSource === 'simulated') {
    speedKmh = Math.max(8, Math.round(bus.cruiseKmh + 3 * Math.sin(now / 6000 + h)))
    lastUpdated = now - ((now + h * 1000) % 6000)
  }
  if (gpsLost) speedKmh = 0
  const occupancy = bus.occupancy > 0 ? clamp(Math.round(bus.occupancy + 3 * Math.sin(now / 17000 + h)), 0, 100) : 0
  return { ...bus, progress, speedKmh, occupancy, lastUpdated, locationLost: bus.locationLost || gpsLost }
}

export function viewBuses(d: TransitData, now: number): BusRecord[] {
  return d.buses.map((b) => viewBus(d, b, now))
}

/** The persisted data with live-computed buses, which is what the UI renders. */
export function viewData(d: TransitData, now: number): TransitData {
  return { ...d, buses: viewBuses(d, now) }
}

/* ------------------------------------------------------------------ *
 * Reconcile: deterministic state transitions driven by time.
 * Safe to run from several tabs or the server; running it twice at the
 * same instant yields the same result.
 * ------------------------------------------------------------------ */

const newTripId = (bus: BusRecord, at: number) => `T-${bus.id.slice(4)}-${at.toString(36)}`

function closeTrip(trip: Trip, status: TripStatus, at: number, type: 'completed' | 'cancelled' | 'vehicle-issue', note?: string) {
  trip.status = status
  trip.endTime = at
  trip.events.push({ at, type, note })
}

export function reconcile(input: TransitData, now: number): { data: TransitData; changed: boolean } {
  let d = input
  let changed = false
  const mutate = () => {
    if (!changed) {
      d = clone(input)
      changed = true
    }
  }

  for (const original of input.buses) {
    const route = routeOf(input, original.routeId)
    if (!route) continue
    const moving = MOVING.includes(original.status)

    /* GPS staleness */
    if (original.locSource === 'gps' && moving && original.lastGpsAt != null) {
      const silentFor = now - original.lastGpsAt
      const shouldBeLost = silentFor > GPS_STALE_MS
      if (shouldBeLost !== original.locationLost || silentFor > GPS_OFFLINE_MS) {
        mutate()
        const bus = busOf(d, original.id)!
        const trip = d.trips.find((t) => t.id === bus.tripId)
        if (shouldBeLost !== bus.locationLost) {
          bus.locationLost = shouldBeLost
          trip?.events.push({ at: now, type: shouldBeLost ? 'location-lost' : 'location-restored' })
        }
        if (silentFor > GPS_OFFLINE_MS) {
          bus.status = 'offline'
          bus.speedKmh = 0
          if (trip && !trip.endTime) trip.events.push({ at: now, type: 'location-lost', note: 'Marked offline after 5 minutes without GPS' })
        }
      }
      continue
    }

    if (!moving || original.locSource !== 'simulated') continue

    const progress = liveProgress(input, original, now)
    const g = geometryOf(input, route)

    /* Stop reached */
    const trip = input.trips.find((t) => t.id === original.tripId)
    if (trip && !trip.endTime) {
      const idx = stopIndexAt(g, progress)
      const stopId = route.stopIds[idx]
      if (stopId && stopId !== trip.currentStopId) {
        mutate()
        const t = d.trips.find((x) => x.id === trip.id)!
        t.currentStopId = stopId
        if (!t.stopsServed.includes(stopId)) t.stopsServed.push(stopId)
        t.events.push({ at: now, type: 'stop-reached', note: stopId })
        t.peakOccupancy = Math.max(t.peakOccupancy, viewBus(input, original, now).occupancy)
      }
    }

    /* Arrival */
    if (progress >= 0.9999) {
      mutate()
      const bus = busOf(d, original.id)!
      const finishAt = Math.min(now, bus.simAt + Math.round(((1 - bus.simProgress) / progressPerSecond(g, bus.cruiseKmh, d.simSpeed)) * 1000))
      const t = d.trips.find((x) => x.id === bus.tripId)
      if (t && !t.endTime) {
        if (!t.stopsServed.includes(route.stopIds[route.stopIds.length - 1])) t.stopsServed.push(route.stopIds[route.stopIds.length - 1])
        t.currentStopId = route.stopIds[route.stopIds.length - 1]
        closeTrip(t, 'completed', finishAt, 'completed')
      }
      const delayed = bus.status === 'delayed'
      if (bus.autoRun) {
        const startAt = now - finishAt > 30_000 ? now : finishAt
        const id = newTripId(bus, startAt)
        bus.simProgress = 0
        bus.progress = 0
        bus.simAt = startAt
        bus.tripId = id
        bus.lastUpdated = now
        d.trips.push({
          id,
          busId: bus.id,
          routeId: route.id,
          driverId: bus.driverId,
          startTime: startAt,
          endTime: null,
          status: delayed ? 'delayed' : 'on-route',
          currentStopId: route.stopIds[0],
          delayMinutes: bus.delayMin,
          locSource: 'simulated',
          predictedMin: predictDurationMin(d, route.id, new Date(startAt).getHours()),
          peakOccupancy: bus.occupancy,
          stopsServed: [route.stopIds[0]],
          scale: d.simSpeed,
          events: [{ at: startAt, type: 'started' }],
        })
        const drv = d.drivers.find((x) => x.id === bus.driverId)
        if (drv) drv.currentTripId = id
      } else {
        bus.status = 'available'
        bus.progress = 0
        bus.simProgress = 0
        bus.simAt = now
        bus.speedKmh = 0
        bus.delayMin = 0
        bus.tripId = null
        bus.locSource = null
        bus.driverStatus = 'off-duty'
        const drv = d.drivers.find((x) => x.id === bus.driverId)
        if (drv) {
          drv.currentTripId = null
          drv.status = 'off-duty'
        }
        pushAlert(d, { kind: 'trip-ended', title: `${bus.id} completed its trip`, body: `${bus.id} reached ${stopOf(d, route.stopIds[route.stopIds.length - 1])?.name ?? 'the last stop'} on Route ${route.code}.`, routeId: route.id, busId: bus.id, createdBy: 'System', active: false }, now)
      }
    }
  }

  if (changed) {
    d.version = input.version + 1
    if (d.trips.length > MAX_TRIPS_KEPT) d.trips = d.trips.slice(d.trips.length - MAX_TRIPS_KEPT)
  }
  return { data: d, changed }
}

/* ------------------------------------------------------------------ *
 * Events for notifications, derived by comparing two states so every
 * client (and every tab) sees the same events without a message bus.
 * ------------------------------------------------------------------ */

export interface StopReachedEvent {
  kind: 'stop-reached'
  busId: string
  stopName: string
  nextStopName: string | null
}

export function diffStopEvents(prev: TransitData, next: TransitData): StopReachedEvent[] {
  const events: StopReachedEvent[] = []
  for (const bus of next.buses) {
    const before = prev.buses.find((b) => b.id === bus.id)
    if (!before || !bus.tripId || before.tripId !== bus.tripId) continue
    const t1 = prev.trips.find((t) => t.id === bus.tripId)
    const t2 = next.trips.find((t) => t.id === bus.tripId)
    if (!t1 || !t2 || t1.currentStopId === t2.currentStopId) continue
    const route = routeOf(next, bus.routeId)
    if (!route) continue
    const idx = route.stopIds.indexOf(t2.currentStopId)
    if (idx <= 0) continue
    events.push({
      kind: 'stop-reached',
      busId: bus.id,
      stopName: stopOf(next, t2.currentStopId)?.name ?? t2.currentStopId,
      nextStopName: idx + 1 < route.stopIds.length ? (stopOf(next, route.stopIds[idx + 1])?.name ?? null) : null,
    })
  }
  return events
}

export function newAlerts(prev: TransitData, next: TransitData): ServiceAlert[] {
  const known = new Set(prev.alerts.map((a) => a.id))
  return next.alerts.filter((a) => !known.has(a.id))
}

/* ------------------------------------------------------------------ *
 * Actions
 * ------------------------------------------------------------------ */

export type TripUpdateKind = 'traffic-delay' | 'vehicle-issue' | 'route-blocked' | 'temporary-stop' | 'resume'

export interface RouteInput {
  code: string
  name: string
  from: string
  to: string
  stopIds: string[]
  durationMin: number
  frequencyMin: number
  firstDeparture: string
  lastDeparture: string
  fare: number
  active?: boolean
}

export interface BusInput {
  routeId: string
  plate: string
  model: string
  capacity: number
  accessible: boolean
}

export type Action =
  | { type: 'trip/start'; busId: string; routeId?: string; source: LocationSource }
  | { type: 'trip/update'; tripId: string; kind: TripUpdateKind; delayMin?: number; note?: string }
  | { type: 'trip/end'; tripId: string }
  | { type: 'trip/cancel'; tripId: string; reason?: string }
  | { type: 'driver/location'; busId: string; lat: number; lng: number; speedKmh?: number; accuracy?: number }
  | { type: 'bus/create'; bus: BusInput }
  | { type: 'bus/update'; busId: string; patch: Partial<BusInput> }
  | { type: 'bus/delete'; busId: string }
  | { type: 'bus/assign'; busId: string; driverId: string | null }
  | { type: 'bus/status'; busId: string; status: 'available' | 'offline' | 'break' }
  | { type: 'route/create'; route: RouteInput }
  | { type: 'route/update'; routeId: string; patch: Partial<RouteInput> }
  | { type: 'route/delete'; routeId: string }
  | { type: 'stop/create'; stop: { name: string; lat: number; lng: number; kind: Stop['kind'] } }
  | { type: 'stop/update'; stopId: string; patch: { name?: string; lat?: number; lng?: number; kind?: Stop['kind'] } }
  | { type: 'stop/delete'; stopId: string }
  | { type: 'stop/close'; stopId: string; closed: boolean; reason?: string }
  | { type: 'alert/publish'; kind?: AlertKind; title: string; body: string; routeId?: string; stopId?: string; busId?: string }
  | { type: 'alert/resolve'; alertId: string }
  | { type: 'crowd/report'; busId: string; level: 'seats' | 'filling' | 'full' }
  | { type: 'issue/report'; busId: string; category: string; note: string }
  | { type: 'issue/resolve'; reportId: string }
  | { type: 'driver/create'; name: string; phone: string }
  | { type: 'driver/update'; driverId: string; patch: { name?: string; phone?: string } }
  | { type: 'user/setRole'; userId: string; role: Role }
  | { type: 'user/setActive'; userId: string; active: boolean }
  | { type: 'user/create'; name: string; email: string; role: Role }
  | { type: 'sim/speed'; simSpeed: number }

export type ActionType = Action['type']

export interface Actor {
  userId: string
  role: Role
  name: string
}

export type ActionResult = { ok: true; data: TransitData; created?: string } | { ok: false; code: string; message: string }

const fail = (code: string, message: string): ActionResult => ({ ok: false, code, message })

/** Who may call what. The server enforces this; the client uses it to hide controls. */
export const PERMISSIONS: Record<ActionType, Role[]> = {
  'trip/start': ['driver'],
  'trip/update': ['driver'],
  'trip/end': ['driver'],
  'driver/location': ['driver'],
  'trip/cancel': ['operator', 'admin'],
  'bus/create': ['operator', 'admin'],
  'bus/update': ['operator', 'admin'],
  'bus/delete': ['operator', 'admin'],
  'bus/assign': ['operator', 'admin'],
  'bus/status': ['operator', 'admin'],
  'route/create': ['operator', 'admin'],
  'route/update': ['operator', 'admin'],
  'route/delete': ['operator', 'admin'],
  'stop/create': ['operator', 'admin'],
  'stop/update': ['operator', 'admin'],
  'stop/delete': ['operator', 'admin'],
  'stop/close': ['operator', 'admin'],
  'alert/publish': ['operator', 'admin'],
  'alert/resolve': ['operator', 'admin'],
  'issue/resolve': ['operator', 'admin'],
  'driver/create': ['operator', 'admin'],
  'driver/update': ['operator', 'admin'],
  'sim/speed': ['operator', 'admin'],
  'crowd/report': ['rider', 'driver', 'operator', 'admin'],
  'issue/report': ['rider', 'driver', 'operator', 'admin'],
  'user/setRole': ['admin'],
  'user/setActive': ['admin'],
  'user/create': ['admin'],
}

export const canDo = (role: Role | undefined, type: ActionType) => !!role && PERMISSIONS[type].includes(role)

export const ROLE_CAPABILITIES: Record<Role, string[]> = {
  rider: ['Search routes and stops', 'Track buses and ETAs', 'Save favourites', 'Receive service alerts', 'Report crowding and issues'],
  driver: ['Log in to the driver app', 'Select assigned bus and route', 'Start and end a trip', 'Share location (phone GPS or simulated)', 'Report delays and problems'],
  operator: ['Manage buses, routes and stops', 'Assign drivers', 'Monitor active and delayed buses', 'Manage schedules', 'Publish service announcements', 'View analytics'],
  admin: ['Everything an operator can do', 'Manage users and roles', 'Manage drivers', 'View system-wide analytics', 'Monitor route performance', 'Manage permissions'],
}

function pushAlert(d: TransitData, a: Omit<ServiceAlert, 'id' | 'createdAt' | 'active'> & { active?: boolean }, now: number): ServiceAlert {
  const alert: ServiceAlert = { id: `al-${now.toString(36)}-${d.alerts.length}`, createdAt: now, active: true, ...a }
  d.alerts.unshift(alert)
  if (d.alerts.length > 120) d.alerts.length = 120
  return alert
}

function resolveAlerts(d: TransitData, match: (a: ServiceAlert) => boolean, now: number) {
  for (const a of d.alerts) if (a.active && match(a)) {
    a.active = false
    a.resolvedAt = now
  }
}

const SLUG = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'stop'

function validateRouteInput(d: TransitData, r: Partial<RouteInput>, existing?: Route): string | null {
  if (r.code !== undefined && !/^[A-Z0-9]{1,3}$/.test(r.code)) return 'Route code must be 1 to 3 letters or digits (A-Z, 0-9).'
  if (r.code !== undefined && d.routes.some((x) => x.code === r.code && x.id !== existing?.id)) return `Route ${r.code} already exists.`
  if (r.name !== undefined && (r.name.length < 3 || r.name.length > 80)) return 'Route name must be 3 to 80 characters.'
  if (r.from !== undefined && (r.from.length < 1 || r.from.length > 40)) return 'Enter where the route starts.'
  if (r.to !== undefined && (r.to.length < 1 || r.to.length > 40)) return 'Enter where the route ends.'
  if (r.stopIds !== undefined) {
    if (r.stopIds.length < 2) return 'A route needs at least two stops.'
    if (new Set(r.stopIds).size !== r.stopIds.length) return 'A stop can only appear once on a route.'
    if (r.stopIds.some((id) => !stopOf(d, id))) return 'One of the selected stops does not exist.'
  }
  if (r.durationMin !== undefined && !(Number.isFinite(r.durationMin) && r.durationMin >= 5 && r.durationMin <= 240)) return 'Duration must be between 5 and 240 minutes.'
  if (r.frequencyMin !== undefined && !(Number.isFinite(r.frequencyMin) && r.frequencyMin >= 3 && r.frequencyMin <= 120)) return 'Frequency must be between 3 and 120 minutes.'
  if (r.firstDeparture !== undefined && !HHMM.test(r.firstDeparture)) return 'First departure must be a time like 06:30.'
  if (r.lastDeparture !== undefined && !HHMM.test(r.lastDeparture)) return 'Last departure must be a time like 21:00.'
  if (r.fare !== undefined && !(Number.isFinite(r.fare) && r.fare >= 0 && r.fare <= 5000)) return 'Fare must be between 0 and 5000 PKR.'
  return null
}

function validateBusInput(d: TransitData, b: Partial<BusInput>): string | null {
  if (b.routeId !== undefined && !routeOf(d, b.routeId)) return 'Choose a route that exists.'
  if (b.plate !== undefined && !/^[A-Z0-9][A-Z0-9 -]{3,11}$/i.test(b.plate)) return 'Plate must be 4 to 12 letters, digits, spaces or dashes.'
  if (b.model !== undefined && (b.model.length < 2 || b.model.length > 40)) return 'Model must be 2 to 40 characters.'
  if (b.capacity !== undefined && !(Number.isInteger(b.capacity) && b.capacity >= 8 && b.capacity <= 120)) return 'Capacity must be a whole number from 8 to 120.'
  return null
}

function syncBusDriverFlags(d: TransitData) {
  for (const bus of d.buses) {
    const drv = d.drivers.find((x) => x.id === bus.driverId)
    bus.driverStatus = drv?.status ?? 'off-duty'
  }
}

/**
 * Applies one action to a copy of the data. Returns the new data or a typed error.
 * Authorisation is checked here so the server and the in-browser store behave identically.
 */
export function applyAction(input: TransitData, action: Action, actor: Actor | null, now: number): ActionResult {
  if (!actor) return fail('unauthenticated', 'Sign in to continue.')
  if (!canDo(actor.role, action.type)) return fail('forbidden', "Your account doesn't have permission to do that.")

  // Bring positions up to date before acting so a freeze/resume uses the true current progress.
  const reconciled = reconcile(input, now).data
  const d = clone(reconciled)
  d.version = input.version + 1
  const drivers = d.drivers
  const myDriver = actor.role === 'driver' ? drivers.find((x) => x.userId === actor.userId) : undefined
  const sim = (bus: BusRecord) => viewBus(d, bus, now)

  const needBus = (id: string) => busOf(d, id)
  const needTrip = (id: string) => d.trips.find((t) => t.id === id)

  switch (action.type) {
    /* ------------------------------ driver ------------------------------ */
    case 'trip/start': {
      if (!myDriver) return fail('no-driver-profile', 'Your account is not linked to a driver profile. Ask an operator to set it up.')
      if (myDriver.currentTripId) return fail('trip-active', 'You already have a trip running. End it before starting another.')
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      if (bus.driverId && bus.driverId !== myDriver.id) return fail('not-your-bus', 'That bus is assigned to another driver.')
      if (bus.status !== 'available') return fail('bus-unavailable', `${bus.id} is ${bus.status === 'offline' ? 'offline' : 'not available'} right now.`)
      const routeId = action.routeId ?? bus.routeId
      const route = routeOf(d, routeId)
      if (!route) return fail('not-found', 'That route does not exist.')
      if (!route.active) return fail('route-inactive', `Route ${route.code} is not in service.`)
      if (action.source !== 'gps' && action.source !== 'simulated') return fail('invalid', 'Choose phone GPS or simulated GPS.')
      const id = newTripId(bus, now)
      bus.routeId = route.id
      bus.driverId = myDriver.id
      bus.status = 'active'
      bus.tripId = id
      bus.locSource = action.source
      bus.progress = 0
      bus.simProgress = 0
      bus.simAt = now
      bus.speedKmh = 0
      bus.delayMin = 0
      bus.locationLost = false
      bus.lastGpsAt = action.source === 'gps' ? now : null
      bus.lastUpdated = now
      bus.occupancy = bus.occupancy || 12
      bus.cruiseKmh = bus.cruiseKmh || 36
      myDriver.assignedBusId = bus.id
      myDriver.currentTripId = id
      myDriver.status = 'on-duty'
      d.trips.push({
        id,
        busId: bus.id,
        routeId: route.id,
        driverId: myDriver.id,
        startTime: now,
        endTime: null,
        status: 'on-route',
        currentStopId: route.stopIds[0],
        delayMinutes: 0,
        locSource: action.source,
        predictedMin: predictDurationMin(d, route.id, new Date(now).getHours()),
        peakOccupancy: bus.occupancy,
        stopsServed: [route.stopIds[0]],
        scale: action.source === 'simulated' ? d.simSpeed : 1,
        events: [{ at: now, type: 'started', note: action.source === 'gps' ? 'Phone GPS' : 'Simulated GPS' }],
      })
      pushAlert(d, { kind: 'trip-start', title: `${bus.id} started on Route ${route.code}`, body: `${bus.id} left ${stopOf(d, route.stopIds[0])?.name ?? 'the first stop'} heading to ${stopOf(d, route.stopIds[route.stopIds.length - 1])?.name ?? 'the last stop'}.`, routeId: route.id, busId: bus.id, createdBy: myDriver.name, active: false }, now)
      syncBusDriverFlags(d)
      return { ok: true, data: d, created: id }
    }

    case 'trip/update': {
      const trip = needTrip(action.tripId)
      if (!trip || trip.endTime) return fail('not-found', 'That trip is not running.')
      if (!myDriver || trip.driverId !== myDriver.id) return fail('forbidden', 'This is not your trip.')
      const bus = needBus(trip.busId)!
      const route = routeOf(d, trip.routeId)!
      const note = clean(action.note, 140)
      const live = sim(bus)
      const where = stopOf(d, trip.currentStopId)?.name ?? 'the route'
      const freeze = () => {
        bus.progress = live.progress
        bus.simProgress = live.progress
        bus.simAt = now
      }

      switch (action.kind) {
        case 'traffic-delay': {
          const mins = Math.round(Number(action.delayMin))
          if (!Number.isFinite(mins) || mins < 1 || mins > 120) return fail('invalid', 'Enter a delay between 1 and 120 minutes.')
          freeze()
          bus.delayMin = clamp(bus.delayMin + mins, 0, 240)
          bus.status = 'delayed'
          bus.cruiseKmh = Math.max(12, Math.round(bus.cruiseKmh * 0.75))
          trip.status = 'delayed'
          trip.delayMinutes = bus.delayMin
          trip.events.push({ at: now, type: 'traffic-delay', note: note || `${mins} min` })
          resolveAlerts(d, (a) => a.kind === 'delay' && a.busId === bus.id, now)
          pushAlert(d, { kind: 'delay', title: `Route ${route.code} is delayed by approximately ${bus.delayMin} minutes`, body: `${bus.id} reported ${note || 'a traffic delay'} near ${where}.`, routeId: route.id, busId: bus.id, createdBy: myDriver.name }, now)
          break
        }
        case 'route-blocked': {
          freeze()
          bus.delayMin = clamp(bus.delayMin + 10, 0, 240)
          bus.status = 'delayed'
          trip.status = 'delayed'
          trip.delayMinutes = bus.delayMin
          trip.events.push({ at: now, type: 'route-blocked', note })
          pushAlert(d, { kind: 'route-blocked', title: `Route ${route.code} is blocked near ${where}`, body: note || `${bus.id} cannot continue on the normal path. Expect extra delay.`, routeId: route.id, busId: bus.id, createdBy: myDriver.name }, now)
          break
        }
        case 'temporary-stop': {
          freeze()
          bus.status = 'break'
          bus.speedKmh = 0
          myDriver.status = 'break'
          trip.status = 'temporary-stop'
          trip.events.push({ at: now, type: 'temporary-stop', note })
          break
        }
        case 'resume': {
          if (bus.status !== 'break') return fail('invalid', 'The bus is not stopped.')
          bus.simProgress = bus.progress
          bus.simAt = now
          bus.status = bus.delayMin > 0 ? 'delayed' : 'active'
          myDriver.status = 'on-duty'
          trip.status = bus.delayMin > 0 ? 'delayed' : 'on-route'
          trip.events.push({ at: now, type: 'resumed' })
          break
        }
        case 'vehicle-issue': {
          freeze()
          bus.status = 'offline'
          bus.speedKmh = 0
          bus.tripId = null
          bus.locSource = null
          myDriver.currentTripId = null
          myDriver.status = 'off-duty'
          closeTrip(trip, 'ended-vehicle-issue', now, 'vehicle-issue', note)
          resolveAlerts(d, (a) => a.busId === bus.id && a.kind !== 'announcement', now)
          pushAlert(d, { kind: 'service-unavailable', title: `${bus.id} has ended its trip due to a vehicle issue`, body: `Route ${route.code} riders: the next bus on the route will pick you up.`, routeId: route.id, busId: bus.id, createdBy: myDriver.name }, now)
          break
        }
        default:
          return fail('invalid', 'Unknown trip update.')
      }
      bus.lastUpdated = now
      syncBusDriverFlags(d)
      return { ok: true, data: d }
    }

    case 'trip/end': {
      const trip = needTrip(action.tripId)
      if (!trip || trip.endTime) return fail('not-found', 'That trip is not running.')
      if (!myDriver || trip.driverId !== myDriver.id) return fail('forbidden', 'This is not your trip.')
      const bus = needBus(trip.busId)!
      const route = routeOf(d, trip.routeId)!
      const live = sim(bus)
      closeTrip(trip, 'completed', now, 'completed')
      trip.delayMinutes = bus.delayMin
      if (live.progress > 0.95) trip.currentStopId = route.stopIds[route.stopIds.length - 1]
      bus.status = 'available'
      bus.progress = 0
      bus.simProgress = 0
      bus.simAt = now
      bus.speedKmh = 0
      bus.delayMin = 0
      bus.tripId = null
      bus.locSource = null
      bus.locationLost = false
      bus.lastGpsAt = null
      bus.lastUpdated = now
      bus.cruiseKmh = bus.cruiseKmh < 20 ? 36 : bus.cruiseKmh
      myDriver.currentTripId = null
      myDriver.status = 'off-duty'
      resolveAlerts(d, (a) => a.busId === bus.id && a.kind !== 'announcement', now)
      pushAlert(d, { kind: 'trip-ended', title: `${bus.id} completed its trip`, body: `${bus.id} ended its run on Route ${route.code}.`, routeId: route.id, busId: bus.id, createdBy: myDriver.name, active: false }, now)
      syncBusDriverFlags(d)
      return { ok: true, data: d }
    }

    case 'driver/location': {
      if (!isValidLatLng(action.lat, action.lng)) return fail('invalid', 'That location is not valid.')
      const bus = needBus(action.busId)
      if (!bus || !bus.tripId) return fail('not-found', 'No active trip for that bus.')
      const trip = needTrip(bus.tripId)!
      if (!myDriver || trip.driverId !== myDriver.id) return fail('forbidden', 'This is not your trip.')
      if (trip.locSource !== 'gps') return fail('invalid', 'This trip uses simulated GPS.')
      const route = routeOf(d, bus.routeId)!
      const g = geometryOf(d, route)
      const { progress, missUnits } = projectOnRoute(g, geoToXY(action.lat, action.lng))
      if (missUnits > OFF_ROUTE_UNITS) {
        return fail('off-route', `Your location is about ${(missUnits * KM_PER_UNIT).toFixed(1)} km from Route ${route.code}, so it can't be shown on this route. Switch to simulated GPS to demonstrate the trip.`)
      }
      const speed = clamp(Math.round(Number(action.speedKmh ?? 0)), 0, 120)
      bus.progress = Math.max(progress, bus.progress - 0.02)
      bus.simProgress = bus.progress
      bus.simAt = now
      bus.speedKmh = bus.status === 'break' ? 0 : speed
      bus.lastGpsAt = now
      bus.lastUpdated = now
      if (bus.locationLost) {
        bus.locationLost = false
        trip.events.push({ at: now, type: 'location-restored' })
      }
      const idx = stopIndexAt(g, bus.progress)
      const stopId = route.stopIds[idx]
      if (stopId !== trip.currentStopId) {
        trip.currentStopId = stopId
        if (!trip.stopsServed.includes(stopId)) trip.stopsServed.push(stopId)
        trip.events.push({ at: now, type: 'stop-reached', note: stopId })
      }
      d.version = input.version + 1
      return { ok: true, data: d }
    }

    /* ------------------------------ operator ----------------------------- */
    case 'trip/cancel': {
      const trip = needTrip(action.tripId)
      if (!trip || trip.endTime) return fail('not-found', 'That trip is not running.')
      const bus = needBus(trip.busId)!
      const route = routeOf(d, trip.routeId)!
      closeTrip(trip, 'cancelled', now, 'cancelled', clean(action.reason, 140))
      bus.status = 'available'
      bus.progress = 0
      bus.simProgress = 0
      bus.simAt = now
      bus.speedKmh = 0
      bus.delayMin = 0
      bus.tripId = null
      bus.locSource = null
      const drv = d.drivers.find((x) => x.id === trip.driverId)
      if (drv) {
        drv.currentTripId = null
        drv.status = 'off-duty'
      }
      resolveAlerts(d, (a) => a.busId === bus.id && a.kind !== 'announcement', now)
      pushAlert(d, { kind: 'trip-cancelled', title: `${bus.id} trip on Route ${route.code} was cancelled`, body: clean(action.reason, 140) || 'The operator cancelled this trip.', routeId: route.id, busId: bus.id, createdBy: actor.name }, now)
      syncBusDriverFlags(d)
      return { ok: true, data: d }
    }

    case 'bus/create': {
      const b = { routeId: action.bus.routeId, plate: clean(action.bus.plate, 12).toUpperCase(), model: clean(action.bus.model, 40), capacity: Math.round(Number(action.bus.capacity)), accessible: !!action.bus.accessible }
      const err = validateBusInput(d, b)
      if (err) return fail('invalid', err)
      if (d.buses.some((x) => x.plate === b.plate)) return fail('duplicate', `A bus with plate ${b.plate} already exists.`)
      const next = Math.max(99, ...d.buses.map((x) => Number(x.id.slice(4)) || 0)) + 1
      const id = `BUS-${next}`
      d.buses.push({
        id,
        busNumber: String(next),
        ...b,
        driverStatus: 'off-duty',
        driverId: null,
        tripId: null,
        progress: 0,
        speedKmh: 0,
        occupancy: 0,
        status: 'available',
        delayMin: 0,
        lastUpdated: now,
        locSource: null,
        locationLost: false,
        autoRun: false,
        simProgress: 0,
        simAt: now,
        cruiseKmh: 36,
        lastGpsAt: null,
      })
      return { ok: true, data: d, created: id }
    }

    case 'bus/update': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      const p = action.patch
      const patch: Partial<BusInput> = {}
      if (p.plate !== undefined) patch.plate = clean(p.plate, 12).toUpperCase()
      if (p.model !== undefined) patch.model = clean(p.model, 40)
      if (p.capacity !== undefined) patch.capacity = Math.round(Number(p.capacity))
      if (p.accessible !== undefined) patch.accessible = !!p.accessible
      if (p.routeId !== undefined) patch.routeId = p.routeId
      const err = validateBusInput(d, patch)
      if (err) return fail('invalid', err)
      if (patch.routeId && patch.routeId !== bus.routeId && bus.tripId) return fail('trip-active', 'This bus is on a trip. Wait for it to finish before moving it to another route.')
      if (patch.plate && d.buses.some((x) => x.plate === patch.plate && x.id !== bus.id)) return fail('duplicate', `A bus with plate ${patch.plate} already exists.`)
      Object.assign(bus, patch)
      return { ok: true, data: d }
    }

    case 'bus/delete': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      if (bus.tripId) return fail('trip-active', 'This bus is on a trip. Cancel the trip first.')
      d.buses = d.buses.filter((b) => b.id !== bus.id)
      for (const drv of d.drivers) if (drv.assignedBusId === bus.id) drv.assignedBusId = null
      return { ok: true, data: d }
    }

    case 'bus/assign': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      if (bus.tripId) return fail('trip-active', 'This bus is on a trip. Change the driver after it ends.')
      if (action.driverId) {
        const drv = d.drivers.find((x) => x.id === action.driverId)
        if (!drv) return fail('not-found', 'That driver does not exist.')
        if (drv.currentTripId) return fail('trip-active', `${drv.name} is on a trip right now.`)
        for (const other of d.buses) if (other.driverId === drv.id) other.driverId = null
        drv.assignedBusId = bus.id
      }
      const prev = d.drivers.find((x) => x.id === bus.driverId)
      if (prev && prev.id !== action.driverId) prev.assignedBusId = null
      bus.driverId = action.driverId
      syncBusDriverFlags(d)
      return { ok: true, data: d }
    }

    case 'bus/status': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      if (bus.tripId) return fail('trip-active', 'This bus is on a trip. Cancel the trip first.')
      if (!['available', 'offline', 'break'].includes(action.status)) return fail('invalid', 'Unknown status.')
      bus.status = action.status
      bus.speedKmh = 0
      bus.lastUpdated = now
      return { ok: true, data: d }
    }

    case 'route/create': {
      const r = action.route
      const route: Route = {
        id: `route-${clean(r.code, 3).toLowerCase()}`,
        code: clean(r.code, 3).toUpperCase(),
        name: clean(r.name, 80),
        from: clean(r.from, 40),
        to: clean(r.to, 40),
        stopIds: Array.isArray(r.stopIds) ? r.stopIds.map((s) => clean(s, 40)) : [],
        durationMin: Math.round(Number(r.durationMin)),
        frequencyMin: Math.round(Number(r.frequencyMin)),
        firstDeparture: clean(r.firstDeparture, 5),
        lastDeparture: clean(r.lastDeparture, 5),
        fare: Math.round(Number(r.fare)),
        hue: (hash(r.code) * 47) % 360,
        active: r.active !== false,
      }
      const err = validateRouteInput(d, route)
      if (err) return fail('invalid', err)
      d.routes.push(route)
      return { ok: true, data: d, created: route.id }
    }

    case 'route/update': {
      const route = routeOf(d, action.routeId)
      if (!route) return fail('not-found', 'That route does not exist.')
      const p = action.patch
      const patch: Partial<RouteInput> = {}
      if (p.name !== undefined) patch.name = clean(p.name, 80)
      if (p.from !== undefined) patch.from = clean(p.from, 40)
      if (p.to !== undefined) patch.to = clean(p.to, 40)
      if (p.stopIds !== undefined) patch.stopIds = p.stopIds.map((s) => clean(s, 40))
      if (p.durationMin !== undefined) patch.durationMin = Math.round(Number(p.durationMin))
      if (p.frequencyMin !== undefined) patch.frequencyMin = Math.round(Number(p.frequencyMin))
      if (p.firstDeparture !== undefined) patch.firstDeparture = clean(p.firstDeparture, 5)
      if (p.lastDeparture !== undefined) patch.lastDeparture = clean(p.lastDeparture, 5)
      if (p.fare !== undefined) patch.fare = Math.round(Number(p.fare))
      const err = validateRouteInput(d, patch, route)
      if (err) return fail('invalid', err)
      const stopsChanged = patch.stopIds && patch.stopIds.join() !== route.stopIds.join()
      if (stopsChanged && d.buses.some((b) => b.routeId === route.id && b.tripId)) return fail('trip-active', 'Buses are running this route. Change its stops after their trips end.')
      Object.assign(route, patch)
      if (p.active !== undefined) {
        if (!p.active && d.buses.some((b) => b.routeId === route.id && b.tripId)) return fail('trip-active', 'Buses are running this route. Deactivate it after their trips end.')
        route.active = !!p.active
      }
      return { ok: true, data: d }
    }

    case 'route/delete': {
      const route = routeOf(d, action.routeId)
      if (!route) return fail('not-found', 'That route does not exist.')
      if (d.buses.some((b) => b.routeId === route.id)) return fail('in-use', 'Buses are assigned to this route. Move them to another route first.')
      d.routes = d.routes.filter((r) => r.id !== route.id)
      return { ok: true, data: d }
    }

    case 'stop/create': {
      const name = clean(action.stop.name, 60)
      if (name.length < 2) return fail('invalid', 'Enter a stop name.')
      if (!isValidLatLng(action.stop.lat, action.stop.lng)) return fail('invalid', 'Enter valid coordinates.')
      const xy = geoToXY(action.stop.lat, action.stop.lng)
      if (xy.x < 0 || xy.x > 1000 || xy.y < 0 || xy.y > 700) return fail('out-of-area', 'That location is outside the service map area.')
      if (d.stops.some((s) => s.name.toLowerCase() === name.toLowerCase())) return fail('duplicate', `A stop called ${name} already exists.`)
      let id = SLUG(name)
      while (stopOf(d, id)) id += '-2'
      d.stops.push({ id, name, x: xy.x, y: xy.y, lat: action.stop.lat, lng: action.stop.lng, kind: action.stop.kind })
      return { ok: true, data: d, created: id }
    }

    case 'stop/update': {
      const stop = stopOf(d, action.stopId)
      if (!stop) return fail('not-found', 'That stop does not exist.')
      const p = action.patch
      if (p.name !== undefined) {
        const name = clean(p.name, 60)
        if (name.length < 2) return fail('invalid', 'Enter a stop name.')
        if (d.stops.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== stop.id)) return fail('duplicate', `A stop called ${name} already exists.`)
        stop.name = name
      }
      if (p.kind !== undefined) stop.kind = p.kind
      if (p.lat !== undefined || p.lng !== undefined) {
        const lat = p.lat ?? stop.lat
        const lng = p.lng ?? stop.lng
        if (!isValidLatLng(lat, lng)) return fail('invalid', 'Enter valid coordinates.')
        if (d.buses.some((b) => b.tripId && routeOf(d, b.routeId)?.stopIds.includes(stop.id))) return fail('trip-active', 'Buses are running a route through this stop. Move it after their trips end.')
        const xy = geoToXY(lat, lng)
        if (xy.x < 0 || xy.x > 1000 || xy.y < 0 || xy.y > 700) return fail('out-of-area', 'That location is outside the service map area.')
        stop.lat = lat
        stop.lng = lng
        stop.x = xy.x
        stop.y = xy.y
      }
      return { ok: true, data: d }
    }

    case 'stop/delete': {
      const stop = stopOf(d, action.stopId)
      if (!stop) return fail('not-found', 'That stop does not exist.')
      const using = d.routes.find((r) => r.stopIds.includes(stop.id))
      if (using) return fail('in-use', `Route ${using.code} uses this stop. Remove it from the route first.`)
      d.stops = d.stops.filter((s) => s.id !== stop.id)
      return { ok: true, data: d }
    }

    case 'stop/close': {
      const stop = stopOf(d, action.stopId)
      if (!stop) return fail('not-found', 'That stop does not exist.')
      const reason = clean(action.reason, 140)
      if (action.closed) {
        stop.closed = true
        stop.closedReason = reason || 'Temporarily unavailable'
        const route = d.routes.find((r) => r.stopIds.includes(stop.id))
        pushAlert(d, { kind: 'stop-closed', title: `${stop.name} is temporarily unavailable`, body: reason || 'Use the nearest open stop.', stopId: stop.id, routeId: route?.id, createdBy: actor.name }, now)
      } else {
        stop.closed = false
        stop.closedReason = undefined
        resolveAlerts(d, (a) => a.kind === 'stop-closed' && a.stopId === stop.id, now)
      }
      return { ok: true, data: d }
    }

    case 'alert/publish': {
      const title = clean(action.title, 90)
      const body = clean(action.body, 280)
      if (title.length < 4) return fail('invalid', 'Enter a title of at least 4 characters.')
      if (body.length < 4) return fail('invalid', 'Write a short message for riders.')
      if (action.routeId && !routeOf(d, action.routeId)) return fail('not-found', 'That route does not exist.')
      if (action.stopId && !stopOf(d, action.stopId)) return fail('not-found', 'That stop does not exist.')
      if (action.busId && !busOf(d, action.busId)) return fail('not-found', 'That bus does not exist.')
      const kind: AlertKind = action.kind && ['announcement', 'route-change', 'delay', 'stop-closed', 'service-unavailable'].includes(action.kind) ? action.kind : 'announcement'
      const alert = pushAlert(d, { kind, title, body, routeId: action.routeId, stopId: action.stopId, busId: action.busId, createdBy: actor.name }, now)
      return { ok: true, data: d, created: alert.id }
    }

    case 'alert/resolve': {
      const alert = d.alerts.find((a) => a.id === action.alertId)
      if (!alert) return fail('not-found', 'That alert does not exist.')
      alert.active = false
      alert.resolvedAt = now
      return { ok: true, data: d }
    }

    /* ------------------------------ riders ------------------------------ */
    case 'crowd/report': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      if (!MOVING.includes(bus.status)) return fail('invalid', 'That bus is not running.')
      const target = action.level === 'seats' ? 35 : action.level === 'filling' ? 70 : 95
      if (!['seats', 'filling', 'full'].includes(action.level)) return fail('invalid', 'Unknown crowding level.')
      // Rider reports nudge the estimate rather than replacing it.
      bus.occupancy = clamp(Math.round(sim(bus).occupancy * 0.7 + target * 0.3), 0, 100)
      return { ok: true, data: d }
    }

    case 'issue/report': {
      const bus = needBus(action.busId)
      if (!bus) return fail('not-found', 'That bus does not exist.')
      const category = clean(action.category, 40)
      const note = clean(action.note, 280)
      if (!category) return fail('invalid', 'Choose what went wrong.')
      d.reports.unshift({ id: `r-${now.toString(36)}-${d.reports.length}`, busId: bus.id, category, note, createdAt: now, status: 'open' })
      if (d.reports.length > 200) d.reports.length = 200
      return { ok: true, data: d }
    }

    case 'issue/resolve': {
      const r = d.reports.find((x) => x.id === action.reportId)
      if (!r) return fail('not-found', 'That report does not exist.')
      r.status = 'resolved'
      return { ok: true, data: d }
    }

    /* ------------------------------ drivers ----------------------------- */
    case 'driver/create': {
      const name = clean(action.name, 60)
      const phone = clean(action.phone, 20)
      if (name.length < 2) return fail('invalid', 'Enter the driver name.')
      if (!/^[0-9+\- ]{7,20}$/.test(phone)) return fail('invalid', 'Enter a valid phone number.')
      const next = Math.max(0, ...d.drivers.map((x) => Number(x.id.slice(2)) || 0)) + 1
      const id = `d-${String(next).padStart(2, '0')}`
      d.drivers.push({ id, userId: null, name, phone, assignedBusId: null, currentTripId: null, status: 'off-duty' })
      return { ok: true, data: d, created: id }
    }

    case 'driver/update': {
      const drv = d.drivers.find((x) => x.id === action.driverId)
      if (!drv) return fail('not-found', 'That driver does not exist.')
      if (action.patch.name !== undefined) {
        const n = clean(action.patch.name, 60)
        if (n.length < 2) return fail('invalid', 'Enter the driver name.')
        drv.name = n
      }
      if (action.patch.phone !== undefined) {
        const p = clean(action.patch.phone, 20)
        if (!/^[0-9+\- ]{7,20}$/.test(p)) return fail('invalid', 'Enter a valid phone number.')
        drv.phone = p
      }
      return { ok: true, data: d }
    }

    /* ------------------------------ admin ------------------------------- */
    case 'user/setRole': {
      const u = d.users.find((x) => x.id === action.userId)
      if (!u) return fail('not-found', 'That user does not exist.')
      if (!['rider', 'driver', 'operator', 'admin'].includes(action.role)) return fail('invalid', 'Unknown role.')
      if (u.id === actor.userId) return fail('invalid', "You can't change your own role.")
      if (u.role === 'admin' && action.role !== 'admin' && d.users.filter((x) => x.role === 'admin' && x.active).length <= 1) return fail('invalid', 'There must be at least one active admin.')
      u.role = action.role
      if (action.role === 'driver' && !d.drivers.some((x) => x.userId === u.id)) {
        const next = Math.max(0, ...d.drivers.map((x) => Number(x.id.slice(2)) || 0)) + 1
        d.drivers.push({ id: `d-${String(next).padStart(2, '0')}`, userId: u.id, name: u.name, phone: '', assignedBusId: null, currentTripId: null, status: 'off-duty' })
      }
      return { ok: true, data: d }
    }

    case 'user/setActive': {
      const u = d.users.find((x) => x.id === action.userId)
      if (!u) return fail('not-found', 'That user does not exist.')
      if (u.id === actor.userId) return fail('invalid', "You can't deactivate your own account.")
      if (!action.active && u.role === 'admin' && d.users.filter((x) => x.role === 'admin' && x.active).length <= 1) return fail('invalid', 'There must be at least one active admin.')
      u.active = !!action.active
      return { ok: true, data: d }
    }

    case 'user/create': {
      const name = clean(action.name, 60)
      const email = clean(action.email, 120).toLowerCase()
      if (name.length < 2) return fail('invalid', 'Enter the name.')
      if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return fail('invalid', 'Enter a valid email address.')
      if (!['rider', 'driver', 'operator', 'admin'].includes(action.role)) return fail('invalid', 'Unknown role.')
      if (d.users.some((x) => x.email === email)) return fail('duplicate', 'An account with that email already exists.')
      const id = `u-${now.toString(36)}-${d.users.length}`
      d.users.push({ id, name, email, role: action.role, active: true, createdAt: now })
      if (action.role === 'driver') {
        const next = Math.max(0, ...d.drivers.map((x) => Number(x.id.slice(2)) || 0)) + 1
        d.drivers.push({ id: `d-${String(next).padStart(2, '0')}`, userId: id, name, phone: '', assignedBusId: null, currentTripId: null, status: 'off-duty' })
      }
      return { ok: true, data: d, created: id }
    }

    case 'sim/speed': {
      const v = Math.round(Number(action.simSpeed))
      if (![1, 4, 14, 30].includes(v)) return fail('invalid', 'Choose 1x, 4x, 14x or 30x.')
      // Re-anchor every simulated bus so changing speed does not make buses jump.
      for (const bus of d.buses) {
        if (MOVING.includes(bus.status) && bus.locSource === 'simulated') {
          const p = liveProgress(d, bus, now)
          bus.simProgress = p
          bus.progress = p
          bus.simAt = now
        }
      }
      d.simSpeed = v
      return { ok: true, data: d }
    }
  }
}

/** Pure helper used by the UI and the API: ETA to a given stop for a view bus. */
export function etaToStop(d: TransitData, bus: BusRecord, stopId: string): number | null {
  const route = routeOf(d, bus.routeId)
  if (!route) return null
  const g = geometryOf(d, route)
  const idx = route.stopIds.indexOf(stopId)
  if (idx < 0) return null
  const target = g.stopProgress[idx]
  if (bus.progress > target + 0.0001) return null
  return etaMinutes(g, route, bus, target)
}

export { pointAt, xyToGeo }

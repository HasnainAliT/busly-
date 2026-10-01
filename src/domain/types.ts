/**
 * Domain model shared by the browser and the Node backend.
 * Nothing in src/domain may import from React, the DOM or the `@/` alias, so the same code runs in both places.
 */

export type BusStatus = 'available' | 'active' | 'delayed' | 'break' | 'offline'
export type Role = 'rider' | 'driver' | 'operator' | 'admin'
export type LocationSource = 'simulated' | 'gps'

export interface Point {
  x: number
  y: number
}

export interface Stop {
  id: string
  name: string
  /** Position in the schematic map space (0-1000 x 0-700). Derived from lat/lng by geoToXY. */
  x: number
  y: number
  lat: number
  lng: number
  kind: 'campus' | 'hospital' | 'bridge' | 'terminal' | 'interchange' | 'town' | 'station'
  /** Set by an operator when a stop is temporarily unavailable (road closure etc.). */
  closed?: boolean
  closedReason?: string
}

export interface Route {
  id: string
  code: string
  name: string
  from: string
  to: string
  stopIds: string[]
  /** Typical end-to-end duration in minutes. */
  durationMin: number
  /** Hue used for the route line on the map. */
  hue: number
  frequencyMin: number
  firstDeparture: string
  lastDeparture: string
  /** Adult fare in PKR for the full route. Partial journeys are charged per stop travelled. */
  fare: number
  active: boolean
}

export interface BusRecord {
  id: string
  /** Short number shown to riders, e.g. "104". */
  busNumber: string
  routeId: string
  plate: string
  model: string
  capacity: number
  driverStatus: 'on-duty' | 'break' | 'off-duty'
  driverId: string | null
  tripId: string | null
  /** Route progress, 0 (origin) to 1 (destination). Computed for the live view; persisted as the last known value. */
  progress: number
  speedKmh: number
  occupancy: number
  status: BusStatus
  /** Minutes behind schedule. */
  delayMin: number
  lastUpdated: number
  accessible: boolean
  locSource: LocationSource | null
  /** True when the driver's GPS stopped reporting. The UI shows "Location temporarily unavailable". */
  locationLost: boolean
  /** Simulated fleet buses restart a trip automatically when they finish one. */
  autoRun: boolean
  /** Persisted simulation anchor: progress at simAt (epoch ms). */
  simProgress: number
  simAt: number
  /** Typical cruising speed used by the simulator and ETA fallback. */
  cruiseKmh: number
  lastGpsAt: number | null
}

export type DriverStatus = 'on-duty' | 'break' | 'off-duty'

export interface Driver {
  id: string
  userId: string | null
  name: string
  phone: string
  assignedBusId: string | null
  currentTripId: string | null
  status: DriverStatus
}

export type TripStatus = 'on-route' | 'delayed' | 'temporary-stop' | 'completed' | 'cancelled' | 'ended-vehicle-issue'

export interface TripEvent {
  at: number
  type: 'started' | 'traffic-delay' | 'vehicle-issue' | 'route-blocked' | 'temporary-stop' | 'resumed' | 'completed' | 'cancelled' | 'stop-reached' | 'location-lost' | 'location-restored'
  note?: string
}

export interface Trip {
  id: string
  busId: string
  routeId: string
  driverId: string | null
  startTime: number
  endTime: number | null
  status: TripStatus
  currentStopId: string
  delayMinutes: number
  locSource: LocationSource
  /** Predicted duration when the trip started, used to score ETA accuracy afterwards. */
  predictedMin: number
  /** Peak occupancy seen on the trip (percent). */
  peakOccupancy: number
  /** Stop ids the bus has served, for most-used-stop analytics. */
  stopsServed: string[]
  events: TripEvent[]
  /** Demo time multiplier in force when the trip started (simulated trips only). Real durations = elapsed * scale. */
  scale?: number
  /** True for generated sample history so it can be labelled as such. */
  sample?: boolean
}

export type AlertKind = 'delay' | 'stop-closed' | 'trip-ended' | 'trip-start' | 'trip-cancelled' | 'route-change' | 'service-unavailable' | 'announcement' | 'route-blocked'

export interface ServiceAlert {
  id: string
  kind: AlertKind
  title: string
  body: string
  createdAt: number
  createdBy: string
  routeId?: string
  stopId?: string
  busId?: string
  active: boolean
  resolvedAt?: number
}

export interface UserAccount {
  id: string
  name: string
  email: string
  role: Role
  active: boolean
  createdAt: number
}

export interface IssueReport {
  id: string
  busId: string
  category: string
  note: string
  createdAt: number
  status: 'open' | 'resolved'
}

export interface TransitData {
  /** Increments on every change so clients can cheaply detect updates. */
  version: number
  stops: Stop[]
  routes: Route[]
  buses: BusRecord[]
  drivers: Driver[]
  trips: Trip[]
  alerts: ServiceAlert[]
  users: UserAccount[]
  reports: IssueReport[]
  /** Demo time multiplier for simulated GPS. 1 = real time. */
  simSpeed: number
}

export type FeedStatus = 'connecting' | 'live' | 'offline' | 'error'

export interface FeedSnapshot {
  buses: BusRecord[]
  status: FeedStatus
  lastSync: number
  data: TransitData
}

export type NotificationKind = 'approach' | 'delay' | 'active' | 'update' | 'security' | 'alert'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  at: number
  read: boolean
  busId?: string
  routeId?: string
}

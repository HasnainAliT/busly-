import { routeGeometryFor, xyToGeo } from './geo'
import type { BusRecord, Driver, IssueReport, Route, ServiceAlert, Stop, TransitData, Trip, UserAccount } from './types'

const stop = (id: string, name: string, x: number, y: number, kind: Stop['kind']): Stop => ({ id, name, x, y, ...xyToGeo({ x, y }), kind })

/** Schematic Jamshoro - Kotri - Hyderabad corridor. */
export const seedStops = (): Stop[] => [
  stop('muet', 'MUET Main Gate', 130, 150, 'campus'),
  stop('sindh-uni', 'Sindh University', 250, 92, 'campus'),
  stop('lumhs', 'LUMHS Hospital', 270, 215, 'hospital'),
  stop('bypass', 'Jamshoro Bypass', 392, 275, 'interchange'),
  stop('kotri-bridge', 'Kotri Bridge', 530, 362, 'bridge'),
  stop('kotri-station', 'Kotri Station', 470, 452, 'station'),
  stop('autobahn', 'Autobahn Interchange', 668, 432, 'interchange'),
  stop('qasimabad', 'Qasimabad', 790, 470, 'town'),
  stop('latifabad', 'Latifabad Unit 7', 905, 430, 'town'),
  stop('terminal', 'Hyderabad Terminal', 825, 560, 'terminal'),
  stop('hyd-bypass', 'Hyderabad Bypass', 700, 622, 'interchange'),
  stop('tando-jam', 'Tando Jam', 585, 648, 'town'),
]

export const seedRoutes = (): Route[] => [
  { id: 'route-a', code: 'A', name: 'MUET → Autobahn → Hyderabad', from: 'MUET', to: 'Hyderabad', stopIds: ['muet', 'bypass', 'kotri-bridge', 'autobahn', 'qasimabad', 'terminal'], durationMin: 32, hue: 199, frequencyMin: 12, firstDeparture: '06:30', lastDeparture: '21:00', fare: 120, active: true },
  { id: 'route-b', code: 'B', name: 'Sindh University → Latifabad', from: 'Sindh University', to: 'Latifabad', stopIds: ['sindh-uni', 'lumhs', 'bypass', 'kotri-bridge', 'autobahn', 'qasimabad', 'latifabad'], durationMin: 41, hue: 258, frequencyMin: 15, firstDeparture: '06:45', lastDeparture: '20:30', fare: 140, active: true },
  { id: 'route-c', code: 'C', name: 'Kotri Station → MUET', from: 'Kotri Station', to: 'MUET', stopIds: ['kotri-station', 'kotri-bridge', 'bypass', 'lumhs', 'muet'], durationMin: 24, hue: 160, frequencyMin: 10, firstDeparture: '06:15', lastDeparture: '21:30', fare: 90, active: true },
  { id: 'route-d', code: 'D', name: 'Hyderabad Terminal → Tando Jam', from: 'Hyderabad Terminal', to: 'Tando Jam', stopIds: ['terminal', 'hyd-bypass', 'tando-jam'], durationMin: 22, hue: 36, frequencyMin: 20, firstDeparture: '07:00', lastDeparture: '19:30', fare: 80, active: true },
]

interface BusSeed {
  id: string
  routeId: string
  model: string
  capacity: number
  progress: number
  speed: number
  occupancy: number
  status: BusRecord['status']
  delayMin: number
  accessible: boolean
  ageSec: number
  driverId: string | null
  autoRun: boolean
}

const busSeeds: BusSeed[] = [
  { id: 'BUS-104', routeId: 'route-a', model: 'Hino AK1J', capacity: 52, progress: 0.12, speed: 38, occupancy: 64, status: 'active', delayMin: 0, accessible: true, ageSec: 12, driverId: 'd-03', autoRun: true },
  { id: 'BUS-108', routeId: 'route-a', model: 'Hino AK1J', capacity: 52, progress: 0.58, speed: 21, occupancy: 88, status: 'delayed', delayMin: 6, accessible: false, ageSec: 7, driverId: 'd-04', autoRun: true },
  { id: 'BUS-112', routeId: 'route-a', model: 'Yutong ZK6', capacity: 48, progress: 0, speed: 0, occupancy: 0, status: 'available', delayMin: 0, accessible: true, ageSec: 31, driverId: 'd-08', autoRun: false },
  { id: 'BUS-120', routeId: 'route-b', model: 'Yutong ZK6', capacity: 48, progress: 0, speed: 0, occupancy: 0, status: 'available', delayMin: 0, accessible: true, ageSec: 20, driverId: 'd-11', autoRun: false },
  { id: 'BUS-201', routeId: 'route-b', model: 'Yutong ZK6', capacity: 48, progress: 0.22, speed: 34, occupancy: 41, status: 'active', delayMin: 0, accessible: true, ageSec: 4, driverId: 'd-05', autoRun: true },
  { id: 'BUS-205', routeId: 'route-b', model: 'Hino AK1J', capacity: 52, progress: 0.71, speed: 44, occupancy: 73, status: 'active', delayMin: 0, accessible: false, ageSec: 9, driverId: 'd-06', autoRun: true },
  { id: 'BUS-207', routeId: 'route-b', model: 'Hino AK1J', capacity: 52, progress: 0.44, speed: 0, occupancy: 0, status: 'offline', delayMin: 0, accessible: false, ageSec: 14 * 60, driverId: 'd-12', autoRun: false },
  { id: 'BUS-310', routeId: 'route-c', model: 'Yutong ZK6', capacity: 48, progress: 0.35, speed: 40, occupancy: 57, status: 'active', delayMin: 0, accessible: true, ageSec: 6, driverId: 'd-07', autoRun: true },
  { id: 'BUS-314', routeId: 'route-c', model: 'Hino AK1J', capacity: 52, progress: 0.02, speed: 0, occupancy: 0, status: 'break', delayMin: 0, accessible: true, ageSec: 48, driverId: 'd-13', autoRun: false },
  { id: 'BUS-401', routeId: 'route-d', model: 'Yutong ZK6', capacity: 48, progress: 0.4, speed: 36, occupancy: 33, status: 'active', delayMin: 0, accessible: true, ageSec: 11, driverId: 'd-09', autoRun: true },
  { id: 'BUS-405', routeId: 'route-d', model: 'Hino AK1J', capacity: 52, progress: 0.78, speed: 18, occupancy: 91, status: 'delayed', delayMin: 9, accessible: false, ageSec: 5, driverId: 'd-10', autoRun: true },
]

const plateFor = (id: string) => `SKR-${Number(id[4]) + 2}${id.slice(4)}`

export const seedBusIds = (): string[] => busSeeds.map((b) => b.id)

export const seedDrivers = (): Driver[] => {
  const name: Record<string, [string, string]> = {
    'd-03': ['Driver 03', '0300-1110003'],
    'd-04': ['Driver 04', '0300-1110004'],
    'd-05': ['Driver 05', '0300-1110005'],
    'd-06': ['Driver 06', '0300-1110006'],
    'd-07': ['Driver 07', '0300-1110007'],
    'd-08': ['Imran Khoso', '0300-1110008'],
    'd-09': ['Driver 09', '0300-1110009'],
    'd-10': ['Driver 10', '0300-1110010'],
    'd-11': ['Sana Memon', '0300-1110011'],
    'd-12': ['Driver 12', '0300-1110012'],
    'd-13': ['Driver 13', '0300-1110013'],
  }
  const userFor: Record<string, string> = { 'd-08': 'u-driver', 'd-11': 'u-driver2' }
  return Object.entries(name).map(([id, [n, phone]]) => {
    const bus = busSeeds.find((b) => b.driverId === id) ?? null
    const status: Driver['status'] = !bus ? 'off-duty' : bus.status === 'offline' ? 'off-duty' : bus.status === 'break' ? 'break' : bus.status === 'available' ? 'off-duty' : 'on-duty'
    return { id, userId: userFor[id] ?? null, name: n, phone, assignedBusId: bus?.id ?? null, currentTripId: null, status }
  })
}

export const seedUsers = (now: number): UserAccount[] => [
  { id: 'u-admin', name: 'Amina Admin', email: 'admin@busly.app', role: 'admin', active: true, createdAt: now - 90 * 864e5 },
  { id: 'u-operator', name: 'Omar Dispatcher', email: 'operator@busly.app', role: 'operator', active: true, createdAt: now - 80 * 864e5 },
  { id: 'u-driver', name: 'Imran Khoso', email: 'driver@busly.app', role: 'driver', active: true, createdAt: now - 60 * 864e5 },
  { id: 'u-driver2', name: 'Sana Memon', email: 'driver2@busly.app', role: 'driver', active: true, createdAt: now - 45 * 864e5 },
  { id: 'u-rider', name: 'Demo Rider', email: 'rider@busly.app', role: 'rider', active: true, createdAt: now - 20 * 864e5 },
]

/** Deterministic PRNG so sample history is identical on every start. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2))
const PEAK: Record<number, number> = { 7: 0.8, 8: 1, 9: 0.75, 12: 0.6, 13: 0.8, 14: 0.7, 16: 0.7, 17: 0.95, 18: 0.8 }

/** Seven days of generated trip history so analytics are meaningful on first launch. Clearly flagged `sample`. */
export function seedTripHistory(now: number, routes: Route[]): Trip[] {
  const rand = mulberry32(20260930)
  const trips: Trip[] = []
  let n = 0
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  for (let day = 7; day >= 0; day--) {
    const dayStart = startOfToday.getTime() - day * 864e5
    const weekday = new Date(dayStart).getDay()
    const weekend = weekday === 0 || weekday === 5 // Sun and Fri are lighter service days
    for (const route of routes) {
      for (let h = hourOf(route.firstDeparture); h <= hourOf(route.lastDeparture); h++) {
        const perHour = weekend ? 1 : 2
        for (let k = 0; k < perHour; k++) {
          const startTime = dayStart + h * 36e5 + Math.floor(rand() * 50) * 6e4
          const peak = PEAK[h] ?? 0.35
          let delay = Math.round(rand() * 2)
          if (!weekend && route.id === 'route-a' && h === 8) delay += 5 + Math.round(rand() * 4)
          if (!weekend && route.id === 'route-b' && h === 17) delay += 3 + Math.round(rand() * 3)
          if (rand() < 0.04) delay += 8
          const actual = Math.max(8, Math.round(route.durationMin * (0.92 + rand() * 0.16) + delay))
          const endTime = startTime + actual * 6e4
          if (endTime > now) continue
          n++
          trips.push({
            id: `T-S-${n}`,
            busId: pickBus(route.id, n),
            routeId: route.id,
            driverId: null,
            startTime,
            endTime,
            status: rand() < 0.015 ? 'ended-vehicle-issue' : 'completed',
            currentStopId: route.stopIds[route.stopIds.length - 1],
            delayMinutes: delay,
            locSource: 'simulated',
            predictedMin: Math.max(8, Math.round(route.durationMin * (0.95 + rand() * 0.1))),
            peakOccupancy: Math.min(100, Math.round(25 + peak * 60 + rand() * 14)),
            stopsServed: [],
            events: [],
            sample: true,
          })
        }
      }
    }
  }
  return trips
}

const pickBus = (routeId: string, n: number) => {
  const pool = busSeeds.filter((b) => b.routeId === routeId)
  return pool[n % pool.length].id
}

export function seedAlerts(now: number): ServiceAlert[] {
  return [
    { id: 'al-1', kind: 'announcement', title: 'Route B timetable updated', body: 'Route B now runs every 15 minutes between 07:00 and 20:00. Last departure is 20:30.', createdAt: now - 3 * 36e5, createdBy: 'Omar Dispatcher', routeId: 'route-b', active: true },
    { id: 'al-2', kind: 'delay', title: 'Route A is running about 6 minutes late', body: 'Heavy traffic near Kotri Bridge is slowing BUS-108.', createdAt: now - 11 * 6e4, createdBy: 'System', routeId: 'route-a', busId: 'BUS-108', active: true },
  ]
}

export function seedReports(now: number): IssueReport[] {
  return [{ id: 'r-1', busId: 'BUS-108', category: 'Crowded', note: 'Standing room only after Jamshoro Bypass.', createdAt: now - 25 * 6e4, status: 'open' }]
}

export function createSeedData(now: number): TransitData {
  const stops = seedStops()
  const routes = seedRoutes()
  const drivers = seedDrivers()
  const trips = seedTripHistory(now, routes)
  const stopMap = new Map(stops.map((s) => [s.id, s]))

  const buses: BusRecord[] = busSeeds.map((b) => ({
    id: b.id,
    busNumber: b.id.slice(4),
    routeId: b.routeId,
    plate: plateFor(b.id),
    model: b.model,
    capacity: b.capacity,
    driverStatus: drivers.find((d) => d.id === b.driverId)?.status ?? 'off-duty',
    driverId: b.driverId,
    tripId: null,
    progress: b.progress,
    speedKmh: b.speed,
    occupancy: b.occupancy,
    status: b.status,
    delayMin: b.delayMin,
    lastUpdated: now - b.ageSec * 1000,
    accessible: b.accessible,
    locSource: b.status === 'active' || b.status === 'delayed' ? 'simulated' : null,
    locationLost: false,
    autoRun: b.autoRun,
    simProgress: b.progress,
    simAt: now,
    cruiseKmh: b.speed || 36,
    lastGpsAt: null,
  }))

  // Every moving bus belongs to an active trip record.
  for (const bus of buses) {
    if (bus.status !== 'active' && bus.status !== 'delayed') continue
    const route = routes.find((r) => r.id === bus.routeId)!
    const g = routeGeometryFor(route, route.stopIds.map((id) => stopMap.get(id)!))
    const tripId = `T-L-${bus.id.slice(4)}`
    bus.tripId = tripId
    const driver = drivers.find((d) => d.id === bus.driverId)
    if (driver) driver.currentTripId = tripId
    trips.push({
      id: tripId,
      busId: bus.id,
      routeId: route.id,
      driverId: bus.driverId,
      startTime: now - Math.round((bus.progress * route.durationMin * 6e4) / 14),
      endTime: null,
      status: bus.status === 'delayed' ? 'delayed' : 'on-route',
      currentStopId: route.stopIds[Math.max(0, g.stopProgress.findIndex((p) => p > bus.progress) - 1)] ?? route.stopIds[0],
      delayMinutes: bus.delayMin,
      locSource: 'simulated',
      predictedMin: route.durationMin,
      peakOccupancy: bus.occupancy,
      stopsServed: [],
      scale: 14,
      events: [{ at: now - Math.round((bus.progress * route.durationMin * 6e4) / 14), type: 'started' }],
    })
  }

  return {
    version: 1,
    stops,
    routes,
    buses,
    drivers,
    trips,
    alerts: seedAlerts(now),
    users: seedUsers(now),
    reports: seedReports(now),
    simSpeed: 14,
  }
}

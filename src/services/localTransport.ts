import { applyAction, reconcile, type Action, type Actor } from '@/domain/engine'
import { computeAnalytics, type Analytics } from '@/domain/analytics'
import { createSeedData } from '@/domain/seed'
import type { TransitData, Trip, UserAccount } from '@/types'
import type { DispatchResult, Transport, TransportSink } from './transitStore'

/**
 * Local transport: the same domain engine the server uses, running in the browser and persisted to
 * localStorage. Other tabs on this device receive changes through the `storage` event, which is what
 * lets a driver tab and a passenger tab on one laptop behave like two phones.
 * There is no server here, so nothing is verified. It is the zero-setup demo mode.
 */

const KEY = 'busly.transit.v2'

function isValid(d: unknown): d is TransitData {
  const x = d as TransitData | null
  return !!x && typeof x.version === 'number' && Array.isArray(x.buses) && Array.isArray(x.routes) && Array.isArray(x.stops) && Array.isArray(x.trips) && Array.isArray(x.users) && typeof x.buses[0]?.simAt === 'number'
}

function readStored(): TransitData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isValid(parsed) ? parsed : null
  } catch {
    return null
  }
}

export class LocalTransport implements Transport {
  readonly mode = 'local' as const
  private data: TransitData
  private sink: TransportSink | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private getActor: () => Actor | null

  constructor(getActor: () => Actor | null) {
    this.getActor = getActor
    this.data = readStored() ?? createSeedData(Date.now())
    this.persist(this.data)
  }

  /* ------------------------------ accounts (demo) ------------------------------ */

  findUser(email: string): UserAccount | undefined {
    this.adopt()
    return this.data.users.find((u) => u.email === email.trim().toLowerCase())
  }

  registerRider(name: string, email: string): UserAccount {
    this.adopt()
    const user: UserAccount = { id: `u-${Date.now().toString(36)}-${this.data.users.length}`, name, email: email.trim().toLowerCase(), role: 'rider', active: true, createdAt: Date.now() }
    this.commit({ ...this.data, users: [...this.data.users, user], version: this.data.version + 1 })
    return user
  }

  /* ------------------------------ transport ------------------------------ */

  start(sink: TransportSink) {
    this.sink = sink
    this.adopt()
    sink.data(this.data)
    sink.status('live')

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) this.adopt(true)
    }
    window.addEventListener('storage', onStorage)
    this.timer = setInterval(() => {
      this.adopt(true)
      const r = reconcile(this.data, Date.now())
      if (r.changed) this.commit(r.data)
    }, 1000)

    return () => {
      window.removeEventListener('storage', onStorage)
      if (this.timer) clearInterval(this.timer)
      this.timer = null
      this.sink = null
    }
  }

  async dispatch(action: Action): Promise<DispatchResult> {
    this.adopt()
    const result = applyAction(this.data, action, this.getActor(), Date.now())
    if (!result.ok) return { ok: false, code: result.code, message: result.message }
    this.commit(result.data)
    return { ok: true, created: result.created }
  }

  async analytics(): Promise<Analytics> {
    return computeAnalytics(this.data, Date.now())
  }

  async trips(limit: number): Promise<Trip[]> {
    const actor = this.getActor()
    const driver = actor?.role === 'driver' ? this.data.drivers.find((d) => d.userId === actor.userId) : null
    return this.data.trips
      .filter((t) => !driver || t.driverId === driver.id)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
  }

  reset() {
    this.commit(createSeedData(Date.now()))
  }

  /* ------------------------------ internals ------------------------------ */

  /** Pull in a newer version written by another tab. */
  private adopt(notify = false) {
    const stored = readStored()
    if (stored && stored.version > this.data.version) {
      this.data = stored
      if (notify) this.sink?.data(this.data)
    }
  }

  private commit(next: TransitData) {
    this.data = next
    this.persist(next)
    this.sink?.data(next)
  }

  private persist(d: TransitData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(d))
    } catch {
      /* storage blocked or full: the in-memory copy still works for this tab */
    }
  }
}

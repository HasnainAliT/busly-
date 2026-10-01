import { diffStopEvents, newAlerts, viewData, type Action, type StopReachedEvent } from '@/domain/engine'
import { computeAnalytics, type Analytics } from '@/domain/analytics'
import { createSeedData } from '@/domain/seed'
import { syncCatalog } from '@/data/mockRoutes'
import { syncKnownBusIds } from '@/data/mockBuses'
import type { FeedSnapshot, FeedStatus, ServiceAlert, TransitData, Trip } from '@/types'

export type FeedEvent = StopReachedEvent | { kind: 'alert'; alert: ServiceAlert }
export type ForcedState = 'offline' | 'error' | null
export type DispatchResult = { ok: true; created?: string } | { ok: false; code: string; message: string }

export interface TransportSink {
  data(d: TransitData, serverTime?: number): void
  status(s: 'live' | 'offline' | 'error'): void
}

/** How the store talks to a backend. Local keeps everything in the browser; API talks to server/. */
export interface Transport {
  readonly mode: 'local' | 'api'
  start(sink: TransportSink): () => void
  dispatch(action: Action, extra?: Record<string, unknown>): Promise<DispatchResult>
  analytics(): Promise<Analytics>
  trips(limit: number): Promise<Trip[]>
  /** Local mode only: wipe and reseed the demo data. */
  reset?(): void
}

/**
 * The contract the UI depends on. The store owns the latest persisted data, computes the live view
 * (bus positions, speeds) once a second from the clock, and exposes it with useSyncExternalStore.
 */
export interface LiveFeed {
  readonly mode: 'local' | 'api'
  subscribe(listener: () => void): () => void
  getSnapshot(): FeedSnapshot
  onEvent(listener: (e: FeedEvent) => void): () => void
  retry(): void
  /** Demo helper so reviewers can preview offline / error states. Not part of a real feed. */
  forceState(state: ForcedState): void
  getForcedState(): ForcedState
  dispatch(action: Action, extra?: Record<string, unknown>): Promise<DispatchResult>
  getAnalytics(): Promise<Analytics>
  getTrips(limit?: number): Promise<Trip[]>
  /** Reopen the connection (after sign-in or sign-out the server sends a different view). */
  reconnect(): void
  resetDemo(): void
}

const TICK_MS = 1000

export class TransitStore implements LiveFeed {
  private persisted: TransitData
  private snapshot: FeedSnapshot
  private listeners = new Set<() => void>()
  private eventListeners = new Set<(e: FeedEvent) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private stopTransport: (() => void) | null = null
  private forced: ForcedState = null
  private browserOffline = false
  private transportStatus: 'live' | 'offline' | 'error' = 'live'
  private offsetMs = 0
  private dataReady = false
  private everLoaded = false
  private lastSync = Date.now()

  private transport: Transport
  /** Local mode shows a short loading state on first launch so reviewers can see the skeletons. */
  private connectDelayMs: number

  constructor(transport: Transport, connectDelayMs = 0) {
    this.transport = transport
    this.connectDelayMs = connectDelayMs
    const now = Date.now()
    this.persisted = createSeedData(now)
    this.snapshot = this.compute('connecting')
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        this.browserOffline = true
        this.refreshStatus()
      })
      window.addEventListener('online', () => {
        this.browserOffline = false
        this.refreshStatus()
      })
      this.browserOffline = !navigator.onLine
    }
  }

  get mode() {
    return this.transport.mode
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.start()
    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stop()
    }
  }

  getSnapshot = () => this.snapshot

  onEvent = (listener: (e: FeedEvent) => void) => {
    this.eventListeners.add(listener)
    return () => this.eventListeners.delete(listener)
  }

  getForcedState = () => this.forced

  forceState = (state: ForcedState) => {
    this.forced = state
    this.refreshStatus()
  }

  retry = () => {
    this.forced = null
    this.setStatus('connecting')
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.connectTimer = setTimeout(() => this.refreshStatus(), 1100)
    if (this.transport.mode === 'api') this.reconnect()
  }

  reconnect = () => {
    if (!this.listeners.size) return
    this.stopTransport?.()
    this.stopTransport = this.transport.start(this.sink)
  }

  resetDemo = () => {
    this.transport.reset?.()
  }

  dispatch = async (action: Action, extra?: Record<string, unknown>) => {
    const result = await this.transport.dispatch(action, extra)
    if (result.ok) this.refreshView()
    return result
  }

  getAnalytics = async (): Promise<Analytics> => {
    if (this.transport.mode === 'local') return computeAnalytics(this.persisted, Date.now())
    return this.transport.analytics()
  }

  getTrips = (limit = 50) => this.transport.trips(limit)

  /* ------------------------------ internals ------------------------------ */

  private sink = {
    data: (d: TransitData, serverTime?: number) => this.receive(d, serverTime),
    status: (s: 'live' | 'offline' | 'error') => {
      this.transportStatus = s
      this.refreshStatus()
    },
  }

  private start() {
    this.stopTransport = this.transport.start(this.sink)
    this.timer = setInterval(() => this.refreshView(), TICK_MS)
  }

  private stop() {
    this.stopTransport?.()
    this.stopTransport = null
    if (this.timer) clearInterval(this.timer)
    if (this.connectTimer) clearTimeout(this.connectTimer)
    this.timer = null
    this.connectTimer = null
  }

  private receive(next: TransitData, serverTime?: number) {
    const prev = this.persisted
    const hadData = this.everLoaded
    this.everLoaded = true
    this.persisted = next
    this.offsetMs = serverTime ? serverTime - Date.now() : 0
    this.lastSync = Date.now()
    syncCatalog(next)
    syncKnownBusIds(next.buses.map((b) => b.id))

    if (hadData && prev.version !== next.version) {
      const events: FeedEvent[] = [...diffStopEvents(prev, next), ...newAlerts(prev, next).map((alert) => ({ kind: 'alert' as const, alert }))]
      this.snapshot = this.compute(this.resolveStatus())
      this.emit()
      events.forEach((e) => this.eventListeners.forEach((l) => l(e)))
    }

    if (!this.dataReady) {
      if (this.connectDelayMs === 0) this.dataReady = true
      else if (!this.connectTimer) {
        this.connectTimer = setTimeout(() => {
          this.connectTimer = null
          this.dataReady = true
          this.refreshStatus()
        }, this.connectDelayMs)
      }
    }
    if (!hadData || this.snapshot.status !== this.resolveStatus()) {
      this.snapshot = this.compute(this.resolveStatus())
      this.emit()
    }
  }

  private resolveStatus(): FeedStatus {
    if (this.forced === 'error' || (this.transportStatus === 'error' && !this.everLoaded)) return 'error'
    if (this.forced === 'offline' || this.browserOffline || this.transportStatus === 'offline') return 'offline'
    if (!this.dataReady) return 'connecting'
    return 'live'
  }

  private refreshStatus() {
    this.setStatus(this.resolveStatus())
  }

  private setStatus(status: FeedStatus) {
    if (this.snapshot.status === status) return
    this.snapshot = this.compute(status)
    this.emit()
  }

  private compute(status: FeedStatus): FeedSnapshot {
    const data = viewData(this.persisted, Date.now() + this.offsetMs)
    return { buses: data.buses, status, lastSync: status === 'live' ? Date.now() : this.lastSync, data }
  }

  private refreshView() {
    if (this.snapshot.status === 'live' || this.snapshot.status === 'connecting') {
      this.snapshot = this.compute(this.resolveStatus())
      this.emit()
    }
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }
}

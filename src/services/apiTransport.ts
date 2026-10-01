import type { Action } from '@/domain/engine'
import type { Analytics } from '@/domain/analytics'
import type { TransitData, Trip } from '@/types'
import type { DispatchResult, Transport, TransportSink } from './transitStore'

const HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'busly' }

export const NETWORK_MESSAGE = "We couldn't reach the Busly server. Check your connection and try again."

/**
 * API transport: talks to server/ over same-origin requests. The session lives in an HttpOnly cookie that
 * JavaScript can't read, and the live stream is Server-Sent Events (EventSource sends the cookie itself).
 */
export class ApiTransport implements Transport {
  readonly mode = 'api' as const
  onUnauthorized: (() => void) | null = null

  private base: string

  constructor(base = '') {
    this.base = base
  }

  start(sink: TransportSink) {
    let es: EventSource | null = null
    let closed = false
    let gotData = false

    const handle = (raw: string) => {
      try {
        const msg = JSON.parse(raw) as { data: TransitData; serverTime: number }
        gotData = true
        sink.data(msg.data, msg.serverTime)
        sink.status('live')
      } catch {
        /* ignore a malformed frame; the next one will replace it */
      }
    }

    // Plain fetch first: it fails fast when the server is unreachable, so the UI shows the error state.
    fetch(`${this.base}/api/state`, { credentials: 'same-origin' })
      .then(async (r) => {
        if (closed) return
        if (!r.ok) throw new Error(String(r.status))
        handle(JSON.stringify(await r.json()))
      })
      .catch(() => {
        if (!closed && !gotData) sink.status('error')
      })

    es = new EventSource(`${this.base}/api/stream`)
    es.addEventListener('state', (e) => handle((e as MessageEvent<string>).data))
    es.onerror = () => {
      if (!closed) sink.status(gotData ? 'offline' : 'error')
    }

    return () => {
      closed = true
      es?.close()
    }
  }

  private async post(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.base}${path}`, { method: 'POST', headers: HEADERS, credentials: 'same-origin', body: JSON.stringify(body) })
  }

  async dispatch(action: Action, extra: Record<string, unknown> = {}): Promise<DispatchResult> {
    try {
      const res = await this.post('/api/actions', { action, ...extra })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string; message?: string; created?: string | null }
      if (res.ok) return { ok: true, created: json.created ?? undefined }
      if (res.status === 401) this.onUnauthorized?.()
      return { ok: false, code: json.code ?? 'error', message: json.message ?? 'That did not work. Try again.' }
    } catch {
      return { ok: false, code: 'network', message: NETWORK_MESSAGE }
    }
  }

  async analytics(): Promise<Analytics> {
    const res = await fetch(`${this.base}/api/analytics`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(String(res.status))
    return ((await res.json()) as { analytics: Analytics }).analytics
  }

  async trips(limit: number): Promise<Trip[]> {
    const res = await fetch(`${this.base}/api/trips?limit=${limit}`, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(String(res.status))
    return ((await res.json()) as { trips: Trip[] }).trips
  }
}

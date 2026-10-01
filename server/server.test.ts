// @vitest-environment node
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createBuslyServer } from './index'
import type { Action } from '../src/domain/engine'

const PASSWORD = 'Test@1234'
let app: ReturnType<typeof createBuslyServer>
let base = ''

beforeAll(async () => {
  const staticDir = mkdtempSync(join(tmpdir(), 'busly-static-'))
  mkdirSync(join(staticDir, 'assets'))
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>Busly</title>')
  writeFileSync(join(staticDir, 'assets', 'app.js'), 'console.log(1)')
  app = createBuslyServer({ dataDir: null, demoPassword: PASSWORD, secret: 'x'.repeat(32), staticDir })
  await new Promise<void>((r) => app.server.listen(0, r))
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})
afterAll(async () => {
  await app.close()
})

interface Res {
  status: number
  json: any
  cookie: string
  headers: Headers
}

async function call(path: string, opts: { method?: string; body?: unknown; cookie?: string; csrf?: boolean; raw?: string; type?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = {}
  if (opts.cookie) headers.cookie = opts.cookie
  if (opts.csrf !== false && (opts.method ?? 'GET') !== 'GET') headers['x-requested-with'] = 'busly'
  if (opts.body !== undefined || opts.raw !== undefined) headers['content-type'] = opts.type ?? 'application/json'
  const res = await fetch(base + path, { method: opts.method ?? 'GET', headers, body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  const setCookie = res.headers.get('set-cookie') ?? ''
  return { status: res.status, json, cookie: setCookie.split(';')[0], headers: res.headers }
}

const login = async (email: string, password = PASSWORD) => call('/api/auth/login', { method: 'POST', body: { email, password } })
const act = (cookie: string, action: Action | { type: string }, extra: object = {}) => call('/api/actions', { method: 'POST', cookie, body: { action, ...extra } })

describe('health and headers', () => {
  it('reports itself and sets security headers', async () => {
    const r = await call('/api/health')
    expect(r.status).toBe(200)
    expect(r.json.app).toBe('busly')
    expect(r.headers.get('content-security-policy')).toContain("default-src 'self'")
    expect(r.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('authentication', () => {
  it('signs in with a real password and sets an HttpOnly SameSite cookie', async () => {
    const r = await login('rider@busly.app')
    expect(r.status).toBe(200)
    expect(r.json.user).toMatchObject({ email: 'rider@busly.app', role: 'rider' })
    const raw = r.headers.get('set-cookie') ?? ''
    expect(raw).toMatch(/HttpOnly/)
    expect(raw).toMatch(/SameSite=Lax/)
    expect(JSON.stringify(r.json)).not.toMatch(/hash|salt|password/i)
    const me = await call('/api/auth/me', { cookie: r.cookie })
    expect(me.json.user.role).toBe('rider')
  })

  it('rejects wrong passwords and unknown emails with the same message', async () => {
    const a = await login('rider@busly.app', 'WrongPass1')
    const b = await login('nobody@busly.app', 'WrongPass1')
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.json.message).toBe(b.json.message)
  })

  it('locks out after repeated failures', async () => {
    let last: Res = await login('lock@busly.app', 'x')
    for (let i = 0; i < 7; i++) last = await login('lock@busly.app', 'x')
    expect(last.status).toBe(429)
    expect(last.json.retryAfterSec).toBeGreaterThan(0)
  })

  it('blocks state-changing requests without the CSRF header or from another origin', async () => {
    expect((await call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD }, csrf: false })).status).toBe(403)
    const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'busly', origin: 'https://evil.example' }, body: '{}' })
    expect(res.status).toBe(403)
  })

  it('validates sign-up and creates a rider', async () => {
    expect((await call('/api/auth/signup', { method: 'POST', body: { name: 'A', email: 'bad', password: 'x' } })).status).toBe(422)
    expect((await call('/api/auth/signup', { method: 'POST', body: { name: 'New Rider', email: 'new@example.com', password: 'onlyletters' } })).json.message).toMatch(/number/)
    const ok = await call('/api/auth/signup', { method: 'POST', body: { name: 'New Rider', email: 'new@example.com', password: 'Secret123' } })
    expect(ok.status).toBe(201)
    expect(ok.json.user.role).toBe('rider')
    expect((await call('/api/auth/signup', { method: 'POST', body: { name: 'New Rider', email: 'new@example.com', password: 'Secret123' } })).status).toBe(409)
    expect((await login('new@example.com', 'Secret123')).status).toBe(200)
  })

  it('rejects malformed bodies', async () => {
    expect((await call('/api/auth/login', { method: 'POST', raw: '{nope', type: 'application/json' })).status).toBe(400)
    expect((await call('/api/auth/login', { method: 'POST', raw: 'a=1', type: 'text/plain' })).status).toBe(415)
    expect((await call('/api/auth/login', { method: 'POST', raw: JSON.stringify({ pad: 'x'.repeat(70_000) }) })).status).toBe(413)
  })

  it('logout clears the cookie', async () => {
    const r = await login('rider@busly.app')
    const out = await call('/api/auth/logout', { method: 'POST', cookie: r.cookie })
    expect(out.headers.get('set-cookie')).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/)
  })
})

describe('authorisation', () => {
  it('requires a session for actions and checks the role on the server', async () => {
    expect((await act('', { type: 'sim/speed', simSpeed: 4 })).status).toBe(401)
    const rider = (await login('rider@busly.app')).cookie
    const r = await act(rider, { type: 'bus/create', bus: { routeId: 'route-a', plate: 'SKR-9001', model: 'Hino', capacity: 50, accessible: true } })
    expect(r.status).toBe(403)
    expect((await act(rider, { type: 'nonsense' })).status).toBe(400)
    const driver = (await login('driver@busly.app')).cookie
    expect((await act(driver, { type: 'user/setRole', userId: 'u-rider', role: 'admin' })).status).toBe(403)
  })

  it('only staff can read analytics and only admins receive the user list', async () => {
    const driver = (await login('driver@busly.app')).cookie
    const operator = (await login('operator@busly.app')).cookie
    const admin = (await login('admin@busly.app')).cookie
    expect((await call('/api/analytics', { cookie: driver })).status).toBe(403)
    expect((await call('/api/analytics')).status).toBe(401)
    const a = await call('/api/analytics', { cookie: operator })
    expect(a.status).toBe(200)
    expect(a.json.analytics.fleet.total).toBeGreaterThan(5)
    expect((await call('/api/state', { cookie: operator })).json.data.users).toHaveLength(0)
    expect((await call('/api/state', { cookie: admin })).json.data.users.length).toBeGreaterThan(3)
    expect((await call('/api/state')).json.data.reports).toHaveLength(0)
    expect((await call('/api/trips')).status).toBe(401)
  })
})

describe('driver, operator and rider workflow over the API', () => {
  it('a driver starts and ends a trip and the rest of the system sees it', async () => {
    const driver = (await login('driver@busly.app')).cookie
    const start = await act(driver, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' })
    expect(start.status).toBe(200)
    const tripId = start.json.created as string

    const publicState = (await call('/api/state')).json.data
    expect(publicState.buses.find((b: any) => b.id === 'BUS-112').status).toBe('active')

    const delay = await act(driver, { type: 'trip/update', tripId, kind: 'traffic-delay', delayMin: 12, note: 'Accident ahead' })
    expect(delay.status).toBe(200)
    const alerts = (await call('/api/state')).json.data.alerts
    expect(alerts[0].title).toBe('Route A is delayed by approximately 12 minutes')

    expect((await act(driver, { type: 'trip/start', busId: 'BUS-112', source: 'simulated' })).status).toBe(409)
    const mine = await call('/api/trips?limit=5', { cookie: driver })
    expect(mine.json.trips[0].id).toBe(tripId)

    const end = await act(driver, { type: 'trip/end', tripId })
    expect(end.status).toBe(200)
    expect((await call('/api/state')).json.data.buses.find((b: any) => b.id === 'BUS-112').status).toBe('available')
  })

  it('a driver cannot use another driver\'s bus', async () => {
    const driver = (await login('driver@busly.app')).cookie
    const r = await act(driver, { type: 'trip/start', busId: 'BUS-120', source: 'simulated' })
    expect(r.status).toBe(409)
    expect(r.json.code).toBe('not-your-bus')
  })

  it('an operator manages the fleet and publishes alerts', async () => {
    const op = (await login('operator@busly.app')).cookie
    const created = await act(op, { type: 'bus/create', bus: { routeId: 'route-c', plate: 'SKR-8888', model: 'Yutong ZK6', capacity: 44, accessible: true } })
    expect(created.status).toBe(200)
    expect(created.json.created).toMatch(/^BUS-\d+$/)
    const dup = await act(op, { type: 'bus/create', bus: { routeId: 'route-c', plate: 'SKR-8888', model: 'Yutong ZK6', capacity: 44, accessible: true } })
    expect(dup.status).toBe(409)
    const invalid = await act(op, { type: 'bus/create', bus: { routeId: 'route-c', plate: '', model: 'Y', capacity: 1, accessible: true } })
    expect(invalid.status).toBe(422)
    const alert = await act(op, { type: 'alert/publish', title: 'Eid schedule', body: 'Reduced service on Friday.', routeId: 'route-a' })
    expect(alert.status).toBe(200)
    expect((await call('/api/state')).json.data.alerts[0].title).toBe('Eid schedule')
  })

  it('an admin creates users with passwords and deactivation ends their session', async () => {
    const admin = (await login('admin@busly.app')).cookie
    expect((await act(admin, { type: 'user/create', name: 'Temp Dispatcher', email: 'temp@busly.app', role: 'operator' })).status).toBe(422)
    const made = await act(admin, { type: 'user/create', name: 'Temp Dispatcher', email: 'temp@busly.app', role: 'operator' }, { password: 'Dispatch123' })
    expect(made.status).toBe(200)
    const temp = await login('temp@busly.app', 'Dispatch123')
    expect(temp.status).toBe(200)
    expect((await call('/api/analytics', { cookie: temp.cookie })).status).toBe(200)
    expect((await act(admin, { type: 'user/setActive', userId: made.json.created, active: false })).status).toBe(200)
    expect((await call('/api/analytics', { cookie: temp.cookie })).status).toBe(401)
    expect((await login('temp@busly.app', 'Dispatch123')).status).toBe(401)
  })
})

describe('live stream', () => {
  it('pushes the state and then updates when something changes', async () => {
    const ctrl = new AbortController()
    const res = await fetch(`${base}/api/stream`, { signal: ctrl.signal })
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/)
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    let buf = ''
    const next = async () => {
      for (;;) {
        const i = buf.indexOf('\n\n')
        if (i >= 0) {
          const chunk = buf.slice(0, i)
          buf = buf.slice(i + 2)
          const m = /data: (.*)/.exec(chunk)
          if (m) return JSON.parse(m[1])
          continue
        }
        const { value, done } = await reader.read()
        if (done) throw new Error('stream closed')
        buf += dec.decode(value)
      }
    }
    const first = await next()
    expect(first.data.buses.length).toBeGreaterThan(5)
    expect(typeof first.serverTime).toBe('number')
    const op = (await login('operator@busly.app')).cookie
    await act(op, { type: 'alert/publish', title: 'Stream test', body: 'Hello from the stream.' })
    let update = await next()
    while (update.data.alerts[0]?.title !== 'Stream test') update = await next()
    expect(update.data.version).toBeGreaterThan(first.data.version)
    ctrl.abort()
  })
})

describe('static files', () => {
  it('serves the app with an SPA fallback and refuses path traversal', async () => {
    const index = await call('/')
    expect(index.status).toBe(200)
    expect(String(index.json)).toContain('<title>Busly</title>')
    const deep = await call('/app/map')
    expect(String(deep.json)).toContain('<title>Busly</title>')
    const asset = await fetch(`${base}/assets/app.js`)
    expect(asset.headers.get('cache-control')).toMatch(/immutable/)
    const raw = await fetch(`${base}/..%2f..%2f..%2f..%2fetc%2fpasswd`)
    const text = await raw.text()
    expect(text).not.toContain('root:')
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405)
  })
})

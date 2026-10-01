// @vitest-environment node
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createBuslyServer } from './index'
import { resolveGoogleUser } from './auth'
import { FileRepo } from './repo/file'
import { sanitizeUserData } from './repo/types'
import { userSchema, activitySchema, userDataSchema, transitSchemas } from './repo/models'
import { model } from 'mongoose'

const PASSWORD = 'Test@1234'

async function boot(extra: Parameters<typeof createBuslyServer>[0] = {}) {
  const app = createBuslyServer({ dataDir: null, demoPassword: PASSWORD, secret: 'y'.repeat(32), staticDir: null, ...extra })
  await new Promise<void>((r) => app.server.listen(0, r))
  const base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
  const call = async (path: string, o: { method?: string; body?: unknown; cookie?: string } = {}) => {
    const headers: Record<string, string> = {}
    if (o.cookie) headers.cookie = o.cookie
    if ((o.method ?? 'GET') !== 'GET') headers['x-requested-with'] = 'busly'
    if (o.body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(base + path, { method: o.method ?? 'GET', headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined, redirect: 'manual' })
    const text = await res.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
    return { status: res.status, json, headers: res.headers, cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] }
  }
  return { app, call }
}

describe('email and password with Passport sessions', () => {
  let s: Awaited<ReturnType<typeof boot>>
  beforeAll(async () => {
    s = await boot()
  })
  afterAll(() => s.app.close())

  it('registers, signs in immediately, and the session persists across requests', async () => {
    const r = await s.call('/api/auth/signup', { method: 'POST', body: { name: 'Sana Khan', email: 'Sana@Example.com', password: 'Strong#123' } })
    expect(r.status).toBe(201)
    expect(r.json.user).toMatchObject({ email: 'sana@example.com', role: 'rider' })
    const a = await s.call('/api/auth/me', { cookie: r.cookie })
    const b = await s.call('/api/auth/me', { cookie: r.cookie })
    expect(a.json.user.email).toBe('sana@example.com')
    expect(b.json.user.email).toBe('sana@example.com')
  })

  it('stores a hash, never the password, and can sign in again with it', async () => {
    const u = s.app.repo.transit.users.find((x) => x.email === 'sana@example.com')!
    const cred = await s.app.repo.getCredential(u.id)
    expect(cred?.hash).toBeTruthy()
    expect(JSON.stringify(cred)).not.toContain('Strong#123')
    const login = await s.call('/api/auth/login', { method: 'POST', body: { email: 'sana@example.com', password: 'Strong#123' } })
    expect(login.status).toBe(200)
  })

  it('rejects a duplicate account, case-insensitively', async () => {
    const r = await s.call('/api/auth/signup', { method: 'POST', body: { name: 'Other', email: 'SANA@example.com', password: 'Strong#123' } })
    expect(r.status).toBe(409)
    expect(r.json.code).toBe('duplicate')
  })

  it('rejects weak passwords, bad emails and short names with readable messages', async () => {
    const weak = await s.call('/api/auth/signup', { method: 'POST', body: { name: 'Al Ba', email: 'weak@example.com', password: 'short' } })
    expect(weak.status).toBe(422)
    expect(weak.json.message).toMatch(/8 characters/)
    expect((await s.call('/api/auth/signup', { method: 'POST', body: { name: 'Al Ba', email: 'nope', password: 'Strong#123' } })).status).toBe(422)
    expect((await s.call('/api/auth/signup', { method: 'POST', body: { name: 'A', email: 'a@example.com', password: 'Strong#123' } })).status).toBe(422)
  })

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrong = await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: 'Wrong#123' } })
    const unknown = await s.call('/api/auth/login', { method: 'POST', body: { email: 'nobody@busly.app', password: 'Wrong#123' } })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json.message).toBe(unknown.json.message)
  })

  it('logout ends the session on the server, not only in the browser', async () => {
    const login = await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD } })
    expect((await s.call('/api/auth/me', { cookie: login.cookie })).json.user).not.toBeNull()
    expect((await s.call('/api/auth/logout', { method: 'POST', cookie: login.cookie })).status).toBe(200)
    expect((await s.call('/api/auth/me', { cookie: login.cookie })).json.user).toBeNull()
  })

  it('protects private endpoints', async () => {
    for (const p of ['/api/analytics', '/api/trips', '/api/me/data', '/api/activity']) expect((await s.call(p)).status).toBe(401)
    expect((await s.call('/api/actions', { method: 'POST', body: { action: { type: 'sim/speed', simSpeed: 4 } } })).status).toBe(401)
  })

  it('refuses a new session cookie reuse after the account is disabled', async () => {
    const rider = await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD } })
    const admin = await s.call('/api/auth/login', { method: 'POST', body: { email: 'admin@busly.app', password: PASSWORD } })
    const uid = s.app.repo.transit.users.find((u) => u.email === 'rider@busly.app')!.id
    const off = await s.call('/api/actions', { method: 'POST', cookie: admin.cookie, body: { action: { type: 'user/setActive', userId: uid, active: false } } })
    expect(off.status).toBe(200)
    expect((await s.call('/api/auth/me', { cookie: rider.cookie })).json.user).toBeNull()
    expect((await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD } })).status).toBe(401)
  })
})

describe('saved data and activity timeline', () => {
  let s: Awaited<ReturnType<typeof boot>>
  beforeAll(async () => {
    s = await boot()
  })
  afterAll(() => s.app.close())

  it('keeps favourites per user, trims and caps input, drops unknown fields', async () => {
    const a = await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD } })
    const put = await s.call('/api/me/data', { method: 'PUT', cookie: a.cookie, body: { favorites: { bus: ['BUS-104', 'BUS-104', '  BUS-108  ', ''], route: ['route-a'], stop: [] }, recentSearches: [{ from: 'MUET', to: 'Hyderabad' }, { from: '', to: 'x' }], evil: '<script>' } })
    expect(put.status).toBe(200)
    expect(put.json.data.favorites.bus).toEqual(['BUS-104', 'BUS-108'])
    expect(put.json.data.recentSearches).toHaveLength(1)
    expect(put.json.data.evil).toBeUndefined()
    expect((await s.call('/api/me/data', { cookie: a.cookie })).json.data.favorites.route).toEqual(['route-a'])
    const b = await s.call('/api/auth/login', { method: 'POST', body: { email: 'driver@busly.app', password: PASSWORD } })
    expect((await s.call('/api/me/data', { cookie: b.cookie })).json.data.favorites.bus).toEqual([])
  })

  it('records sign-ins and actions, and only staff can read everyone\'s activity', async () => {
    const op = await s.call('/api/auth/login', { method: 'POST', body: { email: 'operator@busly.app', password: PASSWORD } })
    await s.call('/api/actions', { method: 'POST', cookie: op.cookie, body: { action: { type: 'alert/publish', title: 'Road work', body: 'Kotri Bridge' } } })
    const mine = await s.call('/api/activity', { cookie: op.cookie })
    const summaries = mine.json.activity.map((a: any) => a.summary)
    expect(summaries).toContain('Signed in')
    expect(summaries).toContain('Published alert "Road work"')
    const rider = await s.call('/api/auth/login', { method: 'POST', body: { email: 'rider@busly.app', password: PASSWORD } })
    expect((await s.call('/api/activity?scope=all', { cookie: rider.cookie })).status).toBe(403)
    const all = await s.call('/api/activity?scope=all', { cookie: op.cookie })
    expect(all.status).toBe(200)
    expect(all.json.activity.some((a: any) => a.userName !== mine.json.activity[0].userName)).toBe(true)
  })

  it('never writes GPS pings to the timeline', async () => {
    const before = (await s.app.repo.listActivity({ limit: 500 })).length
    const d = await s.call('/api/auth/login', { method: 'POST', body: { email: 'driver@busly.app', password: PASSWORD } })
    await s.call('/api/actions', { method: 'POST', cookie: d.cookie, body: { action: { type: 'driver/location', busId: 'BUS-104', lat: 25.4, lng: 68.2 } } })
    const after = await s.app.repo.listActivity({ limit: 500 })
    expect(after.filter((a) => a.summary.includes('location')).length).toBe(0)
    expect(after.length).toBe(before + 1) // only the sign-in
  })
})

describe('Google sign-in', () => {
  it('is reported as unavailable and redirects to a friendly error when not configured', async () => {
    const s = await boot()
    expect((await s.call('/api/auth/providers')).json.google).toBe(false)
    const r = await s.call('/api/auth/google')
    expect(r.status).toBe(302)
    expect(r.headers.get('location')).toBe('/login?error=google-unavailable')
    await s.app.close()
  })

  it('redirects to Google with the right client, scopes and a state value when configured', async () => {
    const s = await boot({ googleClientId: 'client-123.apps.googleusercontent.com', googleClientSecret: 'shh', googleCallbackUrl: 'http://localhost:8787/api/auth/google/callback' })
    expect((await s.call('/api/auth/providers')).json.google).toBe(true)
    const r = await s.call('/api/auth/google')
    expect(r.status).toBe(302)
    const url = new URL(r.headers.get('location') as string)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe('client-123.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8787/api/auth/google/callback')
    expect(url.searchParams.get('scope')).toContain('email')
    expect(url.searchParams.get('state')).toBeTruthy()
    await s.app.close()
  })

  it('a callback without a valid state is refused, not signed in', async () => {
    const s = await boot({ googleClientId: 'c', googleClientSecret: 's' })
    const r = await s.call('/api/auth/google/callback?code=abc&state=forged')
    expect(r.status).toBe(302)
    expect(String(r.headers.get('location'))).toMatch(/^\/login\?error=google-(failed|denied)/)
    await s.app.close()
  })

  describe('account resolution', () => {
    const profile = (id: string, email: string | null, verified: boolean | string = true) => ({ id, displayName: 'Hira Noor', emails: email ? [{ value: email, verified } as any] : undefined })

    it('creates a rider the first time, then recognises the same Google id', async () => {
      const repo = new FileRepo(null, PASSWORD)
      const first = await resolveGoogleUser(repo, profile('g-1', 'hira@example.com'))
      expect(first).toMatchObject({ created: true, user: { email: 'hira@example.com', role: 'rider' } })
      const again = await resolveGoogleUser(repo, profile('g-1', 'hira@example.com'))
      expect('user' in again && again.created).toBe(false)
      expect(repo.transit.users.filter((u) => u.email === 'hira@example.com')).toHaveLength(1)
    })

    it('links Google to an existing account with the same verified email instead of duplicating it', async () => {
      const repo = new FileRepo(null, PASSWORD)
      const before = repo.transit.users.length
      const r = await resolveGoogleUser(repo, profile('g-2', 'rider@busly.app'))
      expect(r).toMatchObject({ created: false, user: { id: repo.transit.users.find((u) => u.email === 'rider@busly.app')!.id } })
      expect(repo.transit.users.length).toBe(before)
      expect(await repo.findUserIdByGoogle('g-2')).toBeTruthy()
    })

    it('refuses unverified addresses, missing emails and disabled accounts', async () => {
      const repo = new FileRepo(null, PASSWORD)
      expect(await resolveGoogleUser(repo, profile('g-3', 'x@example.com', false))).toEqual({ error: 'unverified' })
      expect(await resolveGoogleUser(repo, profile('g-4', null))).toEqual({ error: 'no-email' })
      repo.transit.users.find((u) => u.email === 'rider@busly.app')!.active = false
      expect(await resolveGoogleUser(repo, profile('g-5', 'rider@busly.app'))).toEqual({ error: 'disabled' })
    })
  })
})

describe('database models (validation runs without a connection)', () => {
  const User = model('UserT', userSchema)
  it('requires a valid email, a known role and a name', async () => {
    await expect(new User({ _id: 'u1', name: 'Ali Raza', email: 'ali@example.com', role: 'rider', createdAt: 1 }).validate()).resolves.toBeUndefined()
    const bad = (await new User({ _id: 'u2', name: 'A', email: 'nope', role: 'god', createdAt: 1 }).validate().catch((e: unknown) => e)) as { errors: Record<string, unknown> }
    expect(Object.keys(bad.errors).sort()).toEqual(['email', 'name', 'role'])
  })
  it('declares the indexes the app relies on', () => {
    const keys = (s: { indexes(): unknown[] }) => s.indexes().map((i) => JSON.stringify((i as unknown[])[0]))
    expect(keys(userSchema)).toContain('{"email":1}')
    expect(keys(activitySchema)).toContain('{"userId":1,"at":-1}')
    expect(keys(transitSchemas.trips)).toContain('{"busId":1,"startTime":-1}')
    const unique = userSchema.indexes().find((i) => JSON.stringify(i[0]) === '{"email":1}')
    expect(unique?.[1]).toMatchObject({ unique: true })
  })
  it('caps saved data sizes', async () => {
    const UD = model('UserDataT', userDataSchema)
    const tooMany = (await new UD({ _id: 'u', favorites: { bus: Array.from({ length: 61 }, (_, i) => `b${i}`) } }).validate().catch((e: unknown) => e)) as { errors: Record<string, unknown> }
    expect(tooMany.errors['favorites.bus']).toBeTruthy()
    expect(sanitizeUserData({ favorites: { bus: Array.from({ length: 200 }, (_, i) => `b${i}`) } }).favorites.bus).toHaveLength(60)
  })
})

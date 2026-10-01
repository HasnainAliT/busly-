import express, { type Express, type NextFunction, type Request, type Response } from 'express'
import session from 'express-session'
import { createServer, type Server } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { applyAction, PERMISSIONS, reconcile, clean, type Action, type Actor } from '../src/domain/engine'
import { computeAnalytics } from '../src/domain/analytics'
import type { Role, TransitData, UserAccount } from '../src/domain/types'
import { Limiter, hashPassword, passwordProblem } from './security'
import { configurePassport, EMAIL_RE, roleHome } from './auth'
import { describeAction } from './activity'
import { FileRepo } from './repo/file'
import { MongoRepo } from './repo/mongo'
import { sanitizeUserData, type Repo } from './repo/types'

/**
 * Busly backend (Express + Passport). REST + Server-Sent Events, role checks, and a pluggable store:
 * MongoDB Atlas when MONGODB_URI is set, a JSON file otherwise. It runs the same domain engine as the browser.
 */

export interface ServerOptions {
  /** Where db.json lives for the file store. null keeps everything in memory (tests). */
  dataDir?: string | null
  /** Use an already-opened store (for example MongoRepo). Defaults to a FileRepo. */
  repo?: Repo
  demoPassword?: string
  secret?: string
  /** Folder with the built frontend (dist). Served with an SPA fallback when it exists. */
  staticDir?: string | null
  secureCookie?: boolean
  trustProxy?: boolean
  googleClientId?: string
  googleClientSecret?: string
  googleCallbackUrl?: string
  log?: (msg: string) => void
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000
const COOKIE = 'busly.sid'
const DAY6H = 6 * 36e5

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join('; ')

type Json = Record<string, unknown>

class HttpError extends Error {
  status: number
  code: string
  extra: Json
  constructor(status: number, code: string, message: string, extra: Json = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

const publicUser = (u: UserAccount) => ({ id: u.id, name: u.name, email: u.email, role: u.role })

/** What each kind of viewer may see. Passwords never live in TransitData; users and reports are staff-only. */
export function projectState(t: TransitData, role: Role | null, now: number): TransitData {
  const staff = role === 'operator' || role === 'admin'
  return {
    ...t,
    users: role === 'admin' ? t.users : [],
    reports: staff ? t.reports : [],
    trips: t.trips.filter((x) => x.endTime == null || x.endTime > now - DAY6H),
  }
}

export function createBuslyServer(opts: ServerOptions = {}) {
  const log = opts.log ?? (() => {})
  const demoPassword = opts.demoPassword ?? process.env.BUSLY_DEMO_PASSWORD ?? 'Busly@2026'
  const dataDir = opts.dataDir === undefined ? resolve(process.cwd(), 'server/data') : opts.dataDir
  const repo: Repo = opts.repo ?? new FileRepo(dataDir, demoPassword)

  let secret = opts.secret ?? process.env.BUSLY_SECRET ?? process.env.SESSION_SECRET ?? ''
  if (!secret) {
    const file = dataDir ? join(dataDir, 'secret.key') : null
    if (file && existsSync(file)) secret = readFileSync(file, 'utf8').trim()
    else {
      secret = randomBytes(32).toString('hex')
      if (file) {
        mkdirSync(dataDir as string, { recursive: true })
        writeFileSync(file, secret, { mode: 0o600 })
      }
    }
  }

  const staticDir = opts.staticDir === undefined ? resolve(process.cwd(), 'dist') : opts.staticDir
  const loginLimiter = new Limiter(6, 60_000, 30_000)
  const signupLimiter = new Limiter(5, 10 * 60_000, 10 * 60_000)
  const actionLimiter = new Limiter(240, 60_000, 15_000)
  const clients = new Set<{ res: Response; role: Role | null }>()
  const transit = () => repo.transit

  const { passport, googleEnabled } = configurePassport({
    repo,
    googleClientId: opts.googleClientId ?? process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: opts.googleClientSecret ?? process.env.GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: opts.googleCallbackUrl ?? process.env.GOOGLE_CALLBACK_URL,
    onGoogleSignIn: (u, created) => repo.logActivity({ userId: u.id, userName: u.name, type: created ? 'auth.signup' : 'auth.google', summary: created ? 'Created an account with Google' : 'Signed in with Google', at: Date.now() }),
  })

  const app: Express = express()
  app.disable('x-powered-by')
  if (opts.trustProxy || process.env.TRUST_PROXY === '1') app.set('trust proxy', 1)

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self), microphone=()')
    res.setHeader('Content-Security-Policy', CSP)
    next()
  })

  const secureCookie = opts.secureCookie ?? (process.env.BUSLY_SECURE_COOKIE === '1' ? true : 'auto')
  app.use(
    session({
      name: COOKIE,
      secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: repo.sessionStore(),
      // Lax (not Strict) so the cookie survives the redirect back from Google. Writes are still protected by the CSRF header below.
      cookie: { httpOnly: true, sameSite: 'lax', secure: secureCookie, maxAge: SESSION_TTL_MS },
    }),
  )
  app.use(passport.initialize())
  app.use(passport.session())

  /* ------------------------------ helpers ------------------------------ */

  const ipOf = (req: Request) => req.ip ?? req.socket.remoteAddress ?? 'unknown'

  const ah = (fn: (req: Request, res: Response) => Promise<unknown> | unknown) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next)
  }

  /** State-changing requests must come from our own page: custom header + same-origin check. */
  const sameSite = (req: Request, _res: Response, next: NextFunction) => {
    if (req.headers['x-requested-with'] !== 'busly') return next(new HttpError(403, 'csrf', 'Request blocked.'))
    const origin = req.headers.origin
    if (origin) {
      try {
        if (new URL(origin).host !== req.headers.host) throw new Error('origin')
      } catch {
        return next(new HttpError(403, 'csrf', 'Request blocked.'))
      }
    }
    next()
  }

  const jsonOnly = (req: Request, _res: Response, next: NextFunction) => {
    const type = req.headers['content-type'] ?? ''
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined
    if (hasBody && !type.startsWith('application/json')) return next(new HttpError(415, 'bad-type', 'Send JSON.'))
    next()
  }

  const body = (req: Request): Json => {
    const b = req.body as unknown
    if (b === null || typeof b !== 'object' || Array.isArray(b)) throw new HttpError(400, 'bad-json', 'The request body is not valid JSON.')
    return b as Json
  }

  const needUser = (req: Request): UserAccount => {
    if (!req.isAuthenticated() || !req.user) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')
    return req.user
  }
  const needStaff = (req: Request) => {
    const u = needUser(req)
    if (u.role !== 'operator' && u.role !== 'admin') throw new HttpError(403, 'forbidden', "Your account doesn't have permission to do that.")
    return u
  }

  const variant = (role: Role | null) => (role === 'admin' ? 'admin' : role === 'operator' ? 'operator' : 'public')

  const broadcast = () => {
    if (!clients.size) return
    const now = Date.now()
    const cache = new Map<string, string>()
    for (const c of clients) {
      const key = variant(c.role)
      let payload = cache.get(key)
      if (!payload) {
        payload = `event: state\ndata: ${JSON.stringify({ data: projectState(transit(), c.role, now), serverTime: now })}\n\n`
        cache.set(key, payload)
      }
      c.res.write(payload)
    }
  }

  const commit = (data: TransitData) => {
    repo.transit = data
    repo.save()
    broadcast()
  }

  const logIn = (req: Request, user: UserAccount) =>
    new Promise<void>((done, fail) => req.logIn(user, (e) => (e ? fail(e) : done())))
  const logOut = (req: Request) => new Promise<void>((done, fail) => req.logout((e) => (e ? fail(e) : done())))

  /* ------------------------------ routes ------------------------------ */

  const api = express.Router()
  api.use(jsonOnly)
  api.use(express.json({ limit: '64kb' }))
  api.use((req, _res, next) => (req.method === 'GET' || req.method === 'HEAD' ? next() : sameSite(req, _res, next)))

  api.get(
    '/health',
    ah(async (_req, res) => {
      const db = await repo.health()
      res.status(db.ok ? 200 : 503).json({ app: 'busly', mode: 'api', db: repo.kind, dbOk: db.ok, version: transit().version, time: Date.now() })
    }),
  )

  api.get('/auth/providers', (_req, res) => res.json({ local: true, google: googleEnabled }))

  api.get('/auth/me', (req, res) => res.json({ user: req.isAuthenticated() && req.user ? publicUser(req.user) : null }))

  api.post(
    '/auth/login',
    ah(async (req, res) => {
      const b = body(req)
      const email = clean(b.email, 120).toLowerCase()
      const wait = loginLimiter.take(`${ipOf(req)}|${email}`)
      if (wait) throw new HttpError(429, 'rate-limited', `Too many attempts. Try again in ${Math.ceil(wait / 1000)} seconds.`, { retryAfterSec: Math.ceil(wait / 1000) })
      b.email = email
      const user = await new Promise<UserAccount | false>((done, fail) => {
        passport.authenticate('local', (err: unknown, u: UserAccount | false) => (err ? fail(err) : done(u)))(req, res, () => {})
      })
      if (!user) throw new HttpError(401, 'invalid', "That email and password don't match. Check them and try again.")
      loginLimiter.clear(`${ipOf(req)}|${email}`)
      await logIn(req, user)
      repo.logActivity({ userId: user.id, userName: user.name, type: 'auth.login', summary: 'Signed in', at: Date.now() })
      res.json({ user: publicUser(user) })
    }),
  )

  api.post(
    '/auth/signup',
    ah(async (req, res) => {
      const b = body(req)
      const wait = signupLimiter.take(ipOf(req))
      if (wait) throw new HttpError(429, 'rate-limited', 'Too many sign-ups from this network. Try again later.', { retryAfterSec: Math.ceil(wait / 1000) })
      const now = Date.now()
      const name = clean(b.name, 60)
      const email = clean(b.email, 120).toLowerCase()
      if (name.length < 2) throw new HttpError(422, 'invalid', 'Enter your name.')
      if (!EMAIL_RE.test(email)) throw new HttpError(422, 'invalid', 'Enter a valid email address.')
      const problem = passwordProblem(b.password)
      if (problem) throw new HttpError(422, 'invalid', problem)
      if (transit().users.some((u) => u.email === email)) throw new HttpError(409, 'duplicate', 'An account with that email already exists.')
      const user: UserAccount = { id: `u-${randomBytes(6).toString('hex')}`, name, email, role: 'rider', active: true, createdAt: now }
      commit({ ...transit(), users: [...transit().users, user], version: transit().version + 1 })
      await repo.flush()
      await repo.setCredential(user.id, hashPassword(b.password as string))
      await logIn(req, user)
      repo.logActivity({ userId: user.id, userName: user.name, type: 'auth.signup', summary: 'Created an account', at: now })
      res.status(201).json({ user: publicUser(user) })
    }),
  )

  api.post(
    '/auth/logout',
    ah(async (req, res) => {
      const u = req.user
      if (req.isAuthenticated()) await logOut(req)
      await new Promise<void>((done) => (req.session ? req.session.destroy(() => done()) : done()))
      res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' })
      if (u) repo.logActivity({ userId: u.id, userName: u.name, type: 'auth.logout', summary: 'Signed out', at: Date.now() })
      res.json({ ok: true })
    }),
  )

  /* Google sign-in: a browser redirect flow, so these are GET routes outside the JSON/CSRF rules. */
  const gate = (_req: Request, res: Response, next: NextFunction) => (googleEnabled ? next() : res.redirect('/login?error=google-unavailable'))
  app.get('/api/auth/google', gate, (req, res, next) => passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next))
  app.get('/api/auth/google/callback', gate, (req, res, next) => {
    passport.authenticate('google', (err: unknown, user: UserAccount | false) => {
      if (err) {
        log(`google sign-in failed: ${String((err as Error)?.message ?? err)}`)
        return res.redirect('/login?error=google-failed')
      }
      if (!user) return res.redirect('/login?error=google-denied')
      logIn(req, user).then(
        () => res.redirect(roleHome(user.role)),
        () => res.redirect('/login?error=google-failed'),
      )
    })(req, res, next)
  })

  api.get('/state', (req, res) => {
    res.json({ data: projectState(transit(), req.user?.role ?? null, Date.now()), serverTime: Date.now() })
  })

  api.get('/stream', (req, res) => {
    if (clients.size >= 300) throw new HttpError(503, 'busy', 'Too many live connections.')
    const now = Date.now()
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
    const client = { res, role: req.user?.role ?? null }
    clients.add(client)
    res.write(`retry: 2000\nevent: state\ndata: ${JSON.stringify({ data: projectState(transit(), client.role, now), serverTime: now })}\n\n`)
    req.on('close', () => clients.delete(client))
  })

  api.get('/analytics', (req, res) => {
    needStaff(req)
    res.json({ analytics: computeAnalytics(transit(), Date.now()) })
  })

  api.get('/trips', (req, res) => {
    const u = needUser(req)
    if (u.role === 'rider') throw new HttpError(403, 'forbidden', "Your account doesn't have permission to do that.")
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50))
    const busId = typeof req.query.busId === 'string' ? req.query.busId : null
    const driver = u.role === 'driver' ? transit().drivers.find((d) => d.userId === u.id) : null
    const list = transit()
      .trips.filter((t) => (!busId || t.busId === busId) && (!driver || t.driverId === driver.id))
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
    res.json({ trips: list })
  })

  /* Saved data: favourites, recent searches and read notifications follow the person across devices. */
  api.get(
    '/me/data',
    ah(async (req, res) => {
      res.json({ data: await repo.getUserData(needUser(req).id) })
    }),
  )
  api.put(
    '/me/data',
    ah(async (req, res) => {
      const u = needUser(req)
      res.json({ data: await repo.putUserData(u.id, sanitizeUserData(body(req))) })
    }),
  )

  /* Activity timeline: your own events, or everyone's for staff with ?scope=all. */
  api.get(
    '/activity',
    ah(async (req, res) => {
      const u = needUser(req)
      const all = req.query.scope === 'all'
      if (all) needStaff(req)
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30))
      res.json({ activity: await repo.listActivity({ userId: all ? undefined : u.id, limit }) })
    }),
  )

  api.post(
    '/actions',
    ah(async (req, res) => {
      const u = needUser(req)
      const wait = actionLimiter.take(u.id)
      if (wait) throw new HttpError(429, 'rate-limited', 'You are sending requests too quickly. Wait a moment.', { retryAfterSec: Math.ceil(wait / 1000) })
      const b = body(req)
      const action = b.action as Action | undefined
      if (!action || typeof action !== 'object' || typeof action.type !== 'string' || !(action.type in PERMISSIONS)) throw new HttpError(400, 'bad-action', 'Unknown action.')

      // Passwords are handled here, not in the shared engine, so they never enter TransitData.
      let newPassword: string | null = null
      if (action.type === 'user/create') {
        const problem = passwordProblem(b.password)
        if (problem) throw new HttpError(422, 'invalid', problem)
        newPassword = b.password as string
      }

      const actor: Actor = { userId: u.id, role: u.role, name: u.name }
      const result = applyAction(transit(), action, actor, Date.now())
      if (!result.ok) {
        const status = result.code === 'unauthenticated' ? 401 : result.code === 'forbidden' ? 403 : result.code === 'not-found' ? 404 : ['duplicate', 'in-use', 'trip-active', 'bus-unavailable', 'not-your-bus'].includes(result.code) ? 409 : 422
        throw new HttpError(status, result.code, result.message)
      }
      commit(result.data)
      if (newPassword && result.created) {
        await repo.flush()
        await repo.setCredential(result.created, hashPassword(newPassword))
      }
      const summary = describeAction(action)
      if (summary) repo.logActivity({ userId: u.id, userName: u.name, type: 'action', summary, at: Date.now() })
      res.json({ ok: true, created: result.created ?? null, version: result.data.version })
    }),
  )

  api.use((_req, _res, next) => next(new HttpError(404, 'not-found', 'No such endpoint.')))
  app.use('/api', api)

  /* ------------------------------ static app ------------------------------ */

  if (staticDir && existsSync(staticDir)) {
    const root = resolve(staticDir)
    app.use(
      express.static(root, {
        index: false,
        dotfiles: 'ignore',
        setHeaders: (res, file) => {
          res.setHeader('Cache-Control', file.includes(`${join(root, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache')
        },
      }),
    )
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      res.setHeader('Cache-Control', 'no-cache')
      res.sendFile(join(root, 'index.html'))
    })
  } else {
    app.get('/', (_req, res) => res.status(404).type('text').send('Busly API is running. Build the frontend (npm run build) to serve it from here.'))
  }
  app.use((_req, res) => res.status(405).end())

  app.use((e: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void _next
    const err = e as { type?: string; status?: number; statusCode?: number; message?: string }
    if (e instanceof HttpError) return void res.status(e.status).json({ ok: false, code: e.code, message: e.message, ...e.extra })
    if (err.type === 'entity.too.large') return void res.status(413).set('Connection', 'close').json({ ok: false, code: 'too-large', message: 'Request is too large.' })
    if (err.type === 'entity.parse.failed') return void res.status(400).json({ ok: false, code: 'bad-json', message: 'The request body is not valid JSON.' })
    log(`error: ${(e as Error)?.stack ?? String(e)}`)
    res.status(500).json({ ok: false, code: 'server-error', message: 'Something went wrong on our side. Try again.' })
  })

  const server: Server = createServer(app)

  /* Time-driven transitions (arrivals, stop events, GPS timeouts). */
  const tick = setInterval(() => {
    loginLimiter.sweep()
    signupLimiter.sweep()
    actionLimiter.sweep()
    const { data, changed } = reconcile(transit(), Date.now())
    if (changed) commit(data)
  }, 1000)
  const keepAlive = setInterval(() => {
    for (const c of clients) c.res.write(': ping\n\n')
  }, 20_000)

  const close = () =>
    new Promise<void>((done) => {
      clearInterval(tick)
      clearInterval(keepAlive)
      for (const c of clients) c.res.end()
      clients.clear()
      server.close(() => void repo.close().then(() => done(), () => done()))
      server.closeAllConnections?.()
    })

  return { server, app, repo, close, demoPassword, googleEnabled }
}

/** Opens MongoDB Atlas when MONGODB_URI is set (falls back to the JSON file only if explicitly allowed). */
export async function openRepo(log: (m: string) => void = console.error): Promise<Repo> {
  const demoPassword = process.env.BUSLY_DEMO_PASSWORD ?? 'Busly@2026'
  const uri = process.env.MONGODB_URI
  if (!uri) return new FileRepo(resolve(process.cwd(), 'server/data'), demoPassword)
  try {
    const repo = await MongoRepo.open({ uri, dbName: process.env.MONGODB_DB ?? 'busly', demoPassword, log, seed: process.env.BUSLY_SEED !== '0' })
    log('Connected to MongoDB Atlas.')
    return repo
  } catch (e) {
    if (process.env.BUSLY_ALLOW_FILE_FALLBACK === '1') {
      log(`${(e as Error).message}\nContinuing with the local JSON file because BUSLY_ALLOW_FILE_FALLBACK=1.`)
      return new FileRepo(resolve(process.cwd(), 'server/data'), demoPassword)
    }
    throw e
  }
}

/* Run directly: `npm run server` */
const invoked = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false
if (invoked) {
  void (async () => {
    try {
      try {
        process.loadEnvFile('.env')
      } catch {
        /* no .env file: use the shell environment */
      }
      const repo = await openRepo()
      const port = Number(process.env.PORT) || 8787
      const app = createBuslyServer({ repo, log: (m) => console.error(m) })
      app.server.listen(port, () => {
        console.log(`Busly on http://localhost:${port}  (database: ${repo.kind}${repo.kind === 'file' ? ', set MONGODB_URI to use MongoDB Atlas' : ''})`)
        console.log(`Google sign-in: ${app.googleEnabled ? 'enabled' : 'disabled (set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)'}`)
        console.log(`Demo accounts (password: ${app.demoPassword}): rider@busly.app, driver@busly.app, operator@busly.app, admin@busly.app`)
        if (!process.env.BUSLY_DEMO_PASSWORD) console.log('Using the default demo password. Set BUSLY_DEMO_PASSWORD before any shared deployment.')
      })
      const stop = () => app.close().then(() => process.exit(0))
      process.on('SIGINT', stop)
      process.on('SIGTERM', stop)
    } catch (e) {
      console.error(`\nBusly could not start: ${(e as Error).message}\nCheck MONGODB_URI, the database user, and that your IP is allowed in Atlas Network Access.\nTo develop without a database, unset MONGODB_URI.`)
      process.exit(1)
    }
  })()
}

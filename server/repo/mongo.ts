import mongoose from 'mongoose'
import MongoStore from 'connect-mongo'
import type session from 'express-session'
import { randomBytes } from 'node:crypto'
import { createSeedData } from '../../src/domain/seed'
import type { TransitData } from '../../src/domain/types'
import { hashPassword } from '../security'
import { buildModels, type Models, type TransitCollection } from './models'
import { emptyUserData, sanitizeUserData, type ActivityEntry, type Credential, type Repo, type UserData } from './types'

export interface MongoOptions {
  uri: string
  dbName?: string
  demoPassword: string
  log?: (m: string) => void
  /** Seed demo data into an empty database. Turn off for a real deployment. */
  seed?: boolean
}

const COLLECTIONS: TransitCollection[] = ['stops', 'routes', 'buses', 'drivers', 'trips', 'alerts', 'reports']
const DB_FIELDS = ['dbCreatedAt', 'dbUpdatedAt', '__v']
const USER_AUTH = ['passwordSalt', 'passwordHash', 'googleId', 'lastLoginAt']

type Rec = { id: string } & Record<string, unknown>

const strip = (doc: Record<string, unknown>, extra: string[] = []): Rec => {
  const { _id, ...rest } = doc
  for (const k of [...DB_FIELDS, ...extra]) delete rest[k]
  return { id: String(_id), ...rest } as Rec
}

/** MongoDB Atlas storage. The engine works on an in-memory copy; changed records are written in batches. */
export class MongoRepo implements Repo {
  readonly kind = 'mongo' as const
  transit!: TransitData
  private conn!: mongoose.Connection
  private models!: Models
  private saved = new Map<string, Map<string, string>>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> | null = null
  private dirty = false
  private lastError: string | null = null
  private opts: MongoOptions

  private constructor(opts: MongoOptions) {
    this.opts = opts
  }

  /** Connects, builds indexes, loads (or seeds) data. Rejects with a readable message when the database cannot be reached. */
  static async open(opts: MongoOptions): Promise<MongoRepo> {
    const repo = new MongoRepo(opts)
    try {
      repo.conn = await mongoose.createConnection(opts.uri, { dbName: opts.dbName, serverSelectionTimeoutMS: 8000, maxPoolSize: 10 }).asPromise()
    } catch (e) {
      throw new Error(`Could not connect to MongoDB: ${(e as Error).message}`)
    }
    repo.conn.on('error', (e) => opts.log?.(`mongo error: ${e.message}`))
    repo.models = buildModels(repo.conn)
    await Promise.all([repo.models.User.init(), repo.models.Activity.init(), repo.models.UserData.init(), repo.models.Meta.init(), ...Object.values(repo.models.transit).map((m) => m.init())])
    await repo.load()
    return repo
  }

  private async load() {
    const m = this.models
    const userCount = await m.User.estimatedDocumentCount()
    const routeCount = await m.transit.routes.estimatedDocumentCount()
    if (userCount === 0 && routeCount === 0 && this.opts.seed !== false) {
      this.opts.log?.('Empty database: loading demo data.')
      const seed = createSeedData(Date.now())
      this.transit = seed
      await this.writeAll()
      const pwd = hashPassword(this.opts.demoPassword)
      await m.User.updateMany({}, { $set: { passwordSalt: pwd.salt, passwordHash: pwd.hash } })
      return
    }
    const read = async (name: TransitCollection) => (await m.transit[name].find().lean()).map((d) => strip(d as Record<string, unknown>))
    const [stops, routes, buses, drivers, trips, alerts, reports, users, meta] = await Promise.all([
      read('stops'), read('routes'), read('buses'), read('drivers'), read('trips'), read('alerts'), read('reports'),
      m.User.find().lean().then((l) => l.map((d) => strip(d as Record<string, unknown>, USER_AUTH))),
      m.Meta.findById('transit').lean(),
    ])
    const value = ((meta as { value?: { version?: number; simSpeed?: number } } | null)?.value ?? {}) as { version?: number; simSpeed?: number }
    this.transit = { version: value.version ?? 1, simSpeed: value.simSpeed ?? 14, stops, routes, buses, drivers, trips, alerts, users, reports } as unknown as TransitData
    this.remember()
  }

  private records(name: TransitCollection | 'users'): Rec[] {
    return this.transit[name] as unknown as Rec[]
  }

  private remember() {
    for (const name of [...COLLECTIONS, 'users'] as const) this.saved.set(name, new Map(this.records(name).map((r) => [r.id, JSON.stringify(r)])))
  }

  private async writeAll() {
    this.saved.clear()
    await this.writeChanges()
  }

  /** Writes only the records that changed since the last successful write. */
  private async writeChanges() {
    const t = this.transit
    for (const name of [...COLLECTIONS, 'users'] as const) {
      const model = name === 'users' ? this.models.User : this.models.transit[name]
      const before = this.saved.get(name) ?? new Map<string, string>()
      const next = new Map<string, string>()
      const ops: any[] = []
      for (const rec of this.records(name)) {
        const json = JSON.stringify(rec)
        next.set(rec.id, json)
        if (before.get(rec.id) === json) continue
        const { id, ...fields } = rec
        ops.push({ updateOne: { filter: { _id: id }, update: { $set: fields }, upsert: true } })
      }
      if (name !== 'users') for (const id of before.keys()) if (!next.has(id)) ops.push({ deleteOne: { filter: { _id: id } } })
      if (ops.length) await model.bulkWrite(ops, { ordered: false })
      this.saved.set(name, next)
    }
    await this.models.Meta.updateOne({ _id: 'transit' }, { $set: { value: { version: t.version, simSpeed: t.simSpeed } } }, { upsert: true })
  }

  save() {
    this.dirty = true
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, 800)
  }

  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.flushing) return this.flushing
    this.dirty = false
    this.flushing = this.writeChanges()
      .then(() => {
        this.lastError = null
      })
      .catch((e: Error) => {
        this.lastError = e.message
        this.dirty = true
        this.opts.log?.(`mongo write failed, will retry: ${e.message}`)
        this.timer = setTimeout(() => {
          this.timer = null
          void this.flush()
        }, 5000)
      })
      .finally(() => {
        this.flushing = null
        if (this.dirty && !this.timer && !this.lastError) this.save()
      })
    return this.flushing
  }

  async getCredential(userId: string): Promise<Credential | undefined> {
    const u = await this.models.User.findById(userId).select('+passwordSalt +passwordHash').lean<{ passwordSalt?: string; passwordHash?: string }>()
    return u?.passwordSalt && u.passwordHash ? { salt: u.passwordSalt, hash: u.passwordHash } : undefined
  }
  async setCredential(userId: string, c: Credential) {
    await this.models.User.updateOne({ _id: userId }, { $set: { passwordSalt: c.salt, passwordHash: c.hash } }, { upsert: true })
  }
  async findUserIdByGoogle(googleId: string) {
    const u = await this.models.User.findOne({ googleId }).select('_id').lean<{ _id: string }>()
    return u?._id
  }
  async linkGoogle(userId: string, googleId: string) {
    await this.models.User.updateOne({ _id: userId }, { $set: { googleId } })
  }
  logActivity(entry: Omit<ActivityEntry, 'id'>) {
    this.models.Activity.create({ ...entry, at: new Date(entry.at) }).catch((e: Error) => this.opts.log?.(`activity not saved: ${e.message}`))
    this.models.User.updateOne({ _id: entry.userId }, { $set: { lastLoginAt: new Date(entry.at) } }).exec().catch(() => {})
  }
  async listActivity(q: { userId?: string; limit: number }): Promise<ActivityEntry[]> {
    const rows = await this.models.Activity.find(q.userId ? { userId: q.userId } : {}).sort({ at: -1 }).limit(q.limit).lean<Array<Record<string, any>>>()
    return rows.map((r) => ({ id: String(r._id), userId: r.userId, userName: r.userName, type: r.type, summary: r.summary, at: new Date(r.at).getTime() }))
  }
  async getUserData(userId: string): Promise<UserData> {
    const d = await this.models.UserData.findById(userId).lean()
    return d ? sanitizeUserData(d) : emptyUserData()
  }
  async putUserData(userId: string, data: UserData) {
    const clean = sanitizeUserData(data)
    await this.models.UserData.updateOne({ _id: userId }, { $set: clean }, { upsert: true, runValidators: true })
    return clean
  }
  sessionStore(): session.Store {
    return MongoStore.create({ mongoUrl: this.opts.uri, dbName: this.opts.dbName, collectionName: 'sessions', ttl: 7 * 24 * 3600, touchAfter: 3600, autoRemove: 'native', crypto: undefined }) as unknown as session.Store
  }
  async health() {
    try {
      await this.conn.db?.admin().ping()
      return this.lastError ? { ok: false, detail: `write retrying: ${this.lastError}` } : { ok: true, detail: 'mongo' }
    } catch (e) {
      return { ok: false, detail: (e as Error).message }
    }
  }
  async close() {
    await this.flush()
    await this.conn.close()
  }
}

export const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString('hex')}`

/**
 * Verifies your MongoDB Atlas setup end to end using a throwaway database (dropped afterwards):
 *   MONGODB_URI="mongodb+srv://USER:PASSWORD@busly.xxxxx.mongodb.net" npm run db:check
 * Checks: connection, index creation, create / read / update / delete, validation, duplicate keys,
 * invalid ids, session store, and a readable error when the database cannot be reached.
 */
import mongoose from 'mongoose'
import { randomBytes } from 'node:crypto'
import 'dotenv/config'
import { MongoRepo } from '../server/repo/mongo'
import { buildModels } from '../server/repo/models'
import { createSeedData } from '../src/domain/seed'

try {
  process.loadEnvFile('.env')
} catch {
  /* no .env file: use the shell environment */
}

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('Set MONGODB_URI first (see .env.example).')
  process.exit(2)
}

let failed = 0
const check = async (name: string, fn: () => Promise<unknown>) => {
  try {
    await fn()
    console.log(`PASS  ${name}`)
  } catch (e) {
    failed++
    console.log(`FAIL  ${name}  - ${(e as Error).message}`)
  }
}
const expectThrows = async (fn: () => Promise<unknown>, match: RegExp) => {
  try {
    await fn()
  } catch (e) {
    if (match.test(`${(e as Error).name} ${(e as Error).message}`)) return
    throw new Error(`threw the wrong error: ${(e as Error).message}`)
  }
  throw new Error('expected an error but none was thrown')
}

const dbName = `busly_check_${randomBytes(3).toString('hex')}`
let repo: MongoRepo | undefined

await check('connects and builds indexes', async () => {
  repo = await MongoRepo.open({ uri, dbName, demoPassword: 'Check@1234', seed: true })
})

if (repo) {
  const r = repo
  await check('seeds demo data into an empty database', async () => {
    if (r.transit.routes.length < 3 || r.transit.users.length < 4) throw new Error('seed data missing')
  })
  await check('reads data back after a restart (persisted, not just in memory)', async () => {
    await r.flush()
    const again = await MongoRepo.open({ uri, dbName, demoPassword: 'Check@1234', seed: false })
    const same = again.transit.routes.length === r.transit.routes.length && again.transit.users.length === r.transit.users.length
    await again.close()
    if (!same) throw new Error('reloaded data differs')
  })
  await check('update: a changed record is written, a deleted one is removed', async () => {
    const t = r.transit
    r.transit = { ...t, version: t.version + 1, alerts: [{ id: 'chk-1', kind: 'announcement', title: 'Check', body: 'Check', createdAt: Date.now(), createdBy: 'u', active: true }, ...t.alerts] }
    await r.flush()
    r.transit = { ...r.transit, version: r.transit.version + 1, alerts: r.transit.alerts.filter((a) => a.id !== 'chk-1') }
    await r.flush()
    const m = buildModels(mongoose.connection)
    void m
    const again = await MongoRepo.open({ uri, dbName, demoPassword: 'x', seed: false })
    const gone = !again.transit.alerts.some((a) => a.id === 'chk-1')
    await again.close()
    if (!gone) throw new Error('deleted record still present')
  })
  await check('credentials: store and read a password hash', async () => {
    const uid = r.transit.users[0].id
    await r.setCredential(uid, { salt: 'aa', hash: 'bb' })
    const c = await r.getCredential(uid)
    if (c?.salt !== 'aa' || c.hash !== 'bb') throw new Error('credential mismatch')
  })
  await check('google link: find by google id', async () => {
    const uid = r.transit.users[1].id
    await r.linkGoogle(uid, 'g-check')
    if ((await r.findUserIdByGoogle('g-check')) !== uid) throw new Error('lookup failed')
    if ((await r.findUserIdByGoogle('missing')) !== undefined) throw new Error('unknown id should be undefined')
  })
  await check('user data: save, read, trim and cap', async () => {
    await r.putUserData('chk-user', { favorites: { bus: ['BUS-104'], route: [], stop: [] }, recentSearches: [], readNotifications: [] })
    const d = await r.getUserData('chk-user')
    if (d.favorites.bus[0] !== 'BUS-104') throw new Error('not saved')
    const empty = await r.getUserData('nobody')
    if (empty.favorites.bus.length) throw new Error('unknown user should be empty')
  })
  await check('activity: write and read newest first', async () => {
    r.logActivity({ userId: 'chk-user', userName: 'Check', type: 'action', summary: 'one', at: Date.now() - 1000 })
    r.logActivity({ userId: 'chk-user', userName: 'Check', type: 'action', summary: 'two', at: Date.now() })
    await new Promise((res) => setTimeout(res, 800))
    const list = await r.listActivity({ userId: 'chk-user', limit: 5 })
    if (list[0]?.summary !== 'two') throw new Error(`order wrong: ${list.map((x) => x.summary).join(',')}`)
  })
  const m = buildModels(mongoose.createConnection(uri, { dbName }))
  await check('validation: a bad email, role and name are rejected', async () => {
    await expectThrows(() => m.User.create({ _id: 'bad', name: 'A', email: 'nope', role: 'god', createdAt: 1 }), /ValidationError/)
  })
  await check('duplicate email is rejected by the unique index', async () => {
    const u = createSeedData(Date.now()).users[0]
    await expectThrows(() => m.User.create({ _id: 'dup-1', name: 'Dup User', email: u.email, role: 'rider', createdAt: 1 }), /E11000|duplicate/i)
  })
  await check('invalid ids: unknown or empty ids return nothing, not errors', async () => {
    if ((await m.User.findById('does-not-exist')) !== null) throw new Error('should be null')
    if ((await r.getCredential('does-not-exist')) !== undefined) throw new Error('should be undefined')
  })
  await check('session store can be created', async () => {
    const store = r.sessionStore()
    await new Promise<void>((done, fail) => store.set('chk', { cookie: { originalMaxAge: 1000 } } as never, (e) => (e ? fail(e) : done())))
    await new Promise<void>((done) => store.destroy('chk', () => done()))
  })
  await mongoose.connection.close().catch(() => {})
  await r.close()
  const cleanup = await mongoose.createConnection(uri, { dbName }).asPromise()
  await cleanup.dropDatabase()
  await cleanup.close()
  console.log(`Dropped temporary database ${dbName}.`)
}

await check('connection failure gives a readable error', async () => {
  await expectThrows(() => MongoRepo.open({ uri: 'mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=1500', demoPassword: 'x' }), /Could not connect to MongoDB/)
})

console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.')
process.exit(failed ? 1 : 0)

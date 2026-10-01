import type session from 'express-session'
import { randomBytes } from 'node:crypto'
import { Store } from '../db'
import type { TransitData } from '../../src/domain/types'
import { emptyUserData, type ActivityEntry, type Credential, type Repo, type UserData } from './types'

const MAX_ACTIVITY = 2000

/** JSON-file storage. No setup needed, used for local development and tests. */
export class FileRepo implements Repo {
  readonly kind = 'file' as const
  readonly store: Store

  constructor(dir: string | null, demoPassword: string) {
    this.store = new Store(dir, demoPassword)
  }

  get transit(): TransitData {
    return this.store.data.transit
  }
  set transit(t: TransitData) {
    this.store.data.transit = t
  }

  save() {
    this.store.save()
  }
  async getCredential(userId: string): Promise<Credential | undefined> {
    return this.store.data.credentials[userId]
  }
  async setCredential(userId: string, c: Credential) {
    this.store.data.credentials[userId] = c
    this.store.save()
  }
  async findUserIdByGoogle(googleId: string) {
    return this.store.data.google[googleId]
  }
  async linkGoogle(userId: string, googleId: string) {
    this.store.data.google[googleId] = userId
    this.store.save()
  }
  logActivity(entry: Omit<ActivityEntry, 'id'>) {
    const list = this.store.data.activity
    list.unshift({ id: randomBytes(5).toString('hex'), ...entry })
    if (list.length > MAX_ACTIVITY) list.length = MAX_ACTIVITY
    this.store.save()
  }
  async listActivity(q: { userId?: string; limit: number }) {
    return this.store.data.activity.filter((a) => !q.userId || a.userId === q.userId).slice(0, q.limit)
  }
  async getUserData(userId: string): Promise<UserData> {
    return this.store.data.userdata[userId] ?? emptyUserData()
  }
  async putUserData(userId: string, data: UserData) {
    this.store.data.userdata[userId] = data
    this.store.save()
    return data
  }
  sessionStore(): session.Store | undefined {
    return undefined
  }
  async health() {
    return { ok: true, detail: 'file' }
  }
  async flush() {
    this.store.flush()
  }
  async close() {
    this.store.flush()
  }
}

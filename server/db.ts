import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createSeedData } from '../src/domain/seed'
import type { TransitData } from '../src/domain/types'
import { hashPassword } from './security'
import type { ActivityEntry, UserData } from './repo/types'

export interface Credentials {
  [userId: string]: { salt: string; hash: string }
}

export interface DbFile {
  transit: TransitData
  credentials: Credentials
  google: Record<string, string>
  activity: ActivityEntry[]
  userdata: Record<string, UserData>
}

/**
 * Tiny file-backed database: one JSON document written atomically. It keeps the demo dependency-free.
 * The Store interface is the seam to swap for PostgreSQL/SQLite; only load() and save() would change.
 */
export class Store {
  data: DbFile
  private timer: ReturnType<typeof setTimeout> | null = null
  private dirty = false

  constructor(
    private dir: string | null,
    demoPassword: string,
  ) {
    if (dir) mkdirSync(dir, { recursive: true })
    const file = dir ? join(dir, 'db.json') : null
    if (file && existsSync(file)) {
      const loaded = JSON.parse(readFileSync(file, 'utf8')) as Partial<DbFile> & Pick<DbFile, 'transit' | 'credentials'>
      this.data = { google: {}, activity: [], userdata: {}, ...loaded }
    } else {
      const transit = createSeedData(Date.now())
      const credentials: Credentials = {}
      for (const u of transit.users) credentials[u.id] = hashPassword(demoPassword)
      this.data = { transit, credentials, google: {}, activity: [], userdata: {} }
      this.flush()
    }
  }

  save() {
    this.dirty = true
    if (this.timer || !this.dir) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, 400)
  }

  flush() {
    if (!this.dir) return
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const file = join(this.dir, 'db.json')
    const tmp = `${file}.${process.pid}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data))
    renameSync(tmp, file)
    this.dirty = false
  }

  get isDirty() {
    return this.dirty
  }
}

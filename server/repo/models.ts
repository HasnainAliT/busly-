import { Schema, type Model, type Connection } from 'mongoose'

/**
 * MongoDB collections. Every document keeps the app's own string id as `_id`, so the engine's ids stay stable.
 * Transit entities are validated on the fields the app relies on; the rest of each record is stored as sent.
 */

/** Database bookkeeping fields are renamed so they never clash with the app's own createdAt values. */
const STAMPS = { createdAt: 'dbCreatedAt', updatedAt: 'dbUpdatedAt' }

const entity = (fields: Record<string, unknown>, indexes: Record<string, 1 | -1>[] = []) => {
  const schema = new Schema({ _id: { type: String, required: true }, ...fields } as never, { timestamps: STAMPS, strict: false, versionKey: false })
  for (const i of indexes) schema.index(i)
  return schema
}

export const userSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, lowercase: true, trim: true, match: /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/ },
    role: { type: String, required: true, enum: ['rider', 'driver', 'operator', 'admin'], default: 'rider' },
    active: { type: Boolean, default: true },
    createdAt: { type: Number, required: true },
    // Authentication data. Never sent to the browser.
    passwordSalt: { type: String, select: false },
    passwordHash: { type: String, select: false },
    googleId: { type: String },
    lastLoginAt: { type: Date },
  },
  { timestamps: STAMPS, versionKey: false },
)
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ googleId: 1 }, { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } })
userSchema.index({ role: 1, active: 1 })

export const activitySchema = new Schema(
  {
    userId: { type: String, required: true },
    userName: { type: String, required: true, maxlength: 80 },
    type: { type: String, required: true, enum: ['auth.signup', 'auth.login', 'auth.google', 'auth.logout', 'action'] },
    summary: { type: String, required: true, maxlength: 200 },
    at: { type: Date, required: true },
  },
  { versionKey: false },
)
activitySchema.index({ userId: 1, at: -1 })
activitySchema.index({ at: -1 })
// Activity older than 90 days is removed by MongoDB itself.
activitySchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 3600 })

export const userDataSchema = new Schema(
  {
    _id: { type: String, required: true },
    favorites: {
      bus: { type: [String], default: [], validate: (v: string[]) => v.length <= 60 },
      route: { type: [String], default: [], validate: (v: string[]) => v.length <= 60 },
      stop: { type: [String], default: [], validate: (v: string[]) => v.length <= 60 },
    },
    recentSearches: { type: [{ from: { type: String, maxlength: 40 }, to: { type: String, maxlength: 40 }, _id: false }], default: [] },
    readNotifications: { type: [String], default: [], validate: (v: string[]) => v.length <= 200 },
  },
  { timestamps: STAMPS, versionKey: false },
)

export const metaSchema = new Schema({ _id: { type: String, required: true }, value: { type: Schema.Types.Mixed } }, { timestamps: STAMPS, versionKey: false })

export const transitSchemas = {
  stops: entity({ name: { type: String, required: true }, lat: { type: Number, required: true, min: -90, max: 90 }, lng: { type: Number, required: true, min: -180, max: 180 } }),
  routes: entity({ code: { type: String, required: true }, name: { type: String, required: true }, stopIds: { type: [String], required: true }, fare: { type: Number, min: 0 }, active: Boolean }, [{ code: 1 }]),
  buses: entity({ routeId: { type: String, required: true }, status: { type: String, required: true } }, [{ routeId: 1 }, { status: 1 }]),
  drivers: entity({ name: { type: String, required: true }, assignedBusId: String }, [{ userId: 1 }]),
  trips: entity({ busId: { type: String, required: true }, routeId: { type: String, required: true }, startTime: { type: Number, required: true }, status: { type: String, required: true } }, [{ busId: 1, startTime: -1 }, { routeId: 1, startTime: -1 }, { endTime: 1 }]),
  alerts: entity({ title: { type: String, required: true }, body: { type: String, required: true }, active: Boolean, createdAt: Number }, [{ active: 1, createdAt: -1 }]),
  reports: entity({ busId: { type: String, required: true }, category: { type: String, required: true }, status: { type: String, required: true } }, [{ status: 1 }]),
} as const

export type TransitCollection = keyof typeof transitSchemas

export interface Models {
  User: Model<any>
  Activity: Model<any>
  UserData: Model<any>
  Meta: Model<any>
  transit: Record<TransitCollection, Model<any>>
}

export function buildModels(conn: Connection): Models {
  const transit = {} as Record<TransitCollection, Model<any>>
  for (const [name, schema] of Object.entries(transitSchemas)) transit[name as TransitCollection] = conn.model(name, schema, name) as unknown as Model<any>
  return {
    User: conn.model('User', userSchema, 'users') as unknown as Model<any>,
    Activity: conn.model('Activity', activitySchema, 'activity') as unknown as Model<any>,
    UserData: conn.model('UserData', userDataSchema, 'userdata') as unknown as Model<any>,
    Meta: conn.model('Meta', metaSchema, 'meta') as unknown as Model<any>,
    transit,
  }
}

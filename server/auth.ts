import { Passport } from 'passport'
import { Strategy as LocalStrategy } from 'passport-local'
import { Strategy as GoogleStrategy, type Profile } from 'passport-google-oauth20'
import { randomBytes } from 'node:crypto'
import { clean } from '../src/domain/engine'
import type { Role, UserAccount } from '../src/domain/types'
import { verifyPassword } from './security'
import type { Repo } from './repo/types'

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends UserAccount {}
  }
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/

export const roleHome = (role: Role) => (role === 'driver' ? '/driver' : role === 'operator' || role === 'admin' ? '/operator' : '/app')

export type GoogleResult = { user: UserAccount; created: boolean } | { error: 'no-email' | 'unverified' | 'disabled' }

/**
 * Finds or creates the Busly account for a Google profile.
 *  1. Known Google id: sign that account in.
 *  2. Same verified email as an existing account: link Google to it (no duplicate account).
 *  3. Otherwise create a rider account that has no password.
 */
export async function resolveGoogleUser(repo: Repo, profile: Pick<Profile, 'id' | 'displayName' | 'emails'>, now = Date.now()): Promise<GoogleResult> {
  const mail = profile.emails?.[0]
  const email = clean(mail?.value, 120).toLowerCase()
  if (!email || !EMAIL_RE.test(email)) return { error: 'no-email' }
  // passport-google-oauth20 exposes `verified`; refuse addresses Google hasn't verified.
  if ((mail as { verified?: boolean | string } | undefined)?.verified === false || (mail as { verified?: string } | undefined)?.verified === 'false') return { error: 'unverified' }

  const t = repo.transit
  const byGoogle = await repo.findUserIdByGoogle(profile.id)
  let user = byGoogle ? t.users.find((u) => u.id === byGoogle) : undefined
  let created = false
  if (!user) {
    user = t.users.find((u) => u.email === email)
    if (user) await repo.linkGoogle(user.id, profile.id)
  }
  if (!user) {
    const name = clean(profile.displayName, 60) || email.split('@')[0]
    user = { id: `u-${randomBytes(6).toString('hex')}`, name: name.length >= 2 ? name : `${name} user`, email, role: 'rider', active: true, createdAt: now }
    repo.transit = { ...t, users: [...t.users, user], version: t.version + 1 }
    await repo.flush()
    await repo.linkGoogle(user.id, profile.id)
    created = true
  }
  if (!user.active) return { error: 'disabled' }
  return { user, created }
}

export interface AuthConfig {
  repo: Repo
  googleClientId?: string
  googleClientSecret?: string
  googleCallbackUrl?: string
  onGoogleSignIn?: (user: UserAccount, created: boolean) => void
}

/** Registers the Passport strategies. Google is only enabled when its credentials are configured. */
export function configurePassport(cfg: AuthConfig): { passport: InstanceType<typeof Passport>; googleEnabled: boolean } {
  const { repo } = cfg
  const passport = new Passport()

  passport.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, async (email, password, done) => {
      try {
        const mail = clean(email, 120).toLowerCase()
        const user = repo.transit.users.find((u) => u.email === mail)
        // Always run the hash comparison so timing does not reveal which emails exist.
        const ok = verifyPassword(String(password).slice(0, 128), user ? await repo.getCredential(user.id) : undefined)
        if (!user || !ok || !user.active) return done(null, false, { message: "That email and password don't match. Check them and try again." })
        done(null, user)
      } catch (e) {
        done(e)
      }
    }),
  )

  passport.serializeUser((user, done) => done(null, (user as UserAccount).id))
  passport.deserializeUser((id: string, done) => {
    const u = repo.transit.users.find((x) => x.id === id)
    // Returning false ends the session of a deleted or disabled account.
    done(null, u && u.active ? u : false)
  })

  const googleEnabled = !!(cfg.googleClientId && cfg.googleClientSecret)
  if (googleEnabled) {
    passport.use(
      new GoogleStrategy(
        { clientID: cfg.googleClientId as string, clientSecret: cfg.googleClientSecret as string, callbackURL: cfg.googleCallbackUrl ?? '/api/auth/google/callback', scope: ['profile', 'email'], state: true, proxy: true },
        (_access, _refresh, profile, done) => {
          resolveGoogleUser(repo, profile)
            .then((r) => {
              if ('error' in r) return done(null, false, { message: r.error })
              cfg.onGoogleSignIn?.(r.user, r.created)
              done(null, r.user)
            })
            .catch(done)
        },
      ),
    )
  }
  return { passport, googleEnabled }
}

// Real-browser authentication checks: register, duplicate, login, invalid, logout, protected routes, persistence, Google.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:8787'
const SHOTS = process.env.SHOTS ?? 'e2e/shots'
mkdirSync(SHOTS, { recursive: true })
const results = []
const errors = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`)
}
const seen = (loc, t = 6000) => loc.waitFor({ timeout: t }).then(() => true, () => false)

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

const email = `e2e.${Date.now()}@example.com`
const password = 'Sturdy-Pass-42'

// protected route while signed out
await page.goto(`${BASE}/app/favorites`)
check('signed-out visit to a protected page redirects to login', await seen(page.getByRole('heading', { name: 'Welcome back' })))
await page.goto(`${BASE}/operator/fleet`)
check('signed-out visit to the operator console redirects to login', await seen(page.getByRole('heading', { name: 'Welcome back' })))
const anonMe = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))
check('API /auth/me reports no user when signed out', anonMe.user === null)
const anonData = await page.evaluate(() => fetch('/api/me/data').then((r) => r.status))
check('API /me/data refuses anonymous callers (401)', anonData === 401, String(anonData))

// register with validation errors first
await page.goto(`${BASE}/signup`)
await page.getByRole('button', { name: 'Create account' }).click()
check('empty register form shows validation errors', await seen(page.getByRole('alert').first()))
await page.getByLabel('Full name').fill('E2E Rider')
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password', { exact: true }).fill('short')
await page.getByLabel(/I agree/).check()
await page.getByRole('button', { name: 'Create account' }).click()
check('weak password is refused', await seen(page.getByRole('alert').filter({ hasText: /password|character/i }).first()))

// register for real
await page.getByLabel('Password', { exact: true }).fill(password)
await page.getByRole('button', { name: 'Create account' }).click()
await page.waitForURL(/\/app/, { timeout: 10000 }).catch(() => {})
check('register creates an account and signs in', /\/app/.test(page.url()), page.url())
const cookies = await ctx.cookies()
const sid = cookies.find((c) => c.name === 'busly.sid')
check('session cookie is HttpOnly + SameSite=Lax', !!sid && sid.httpOnly && sid.sameSite === 'Lax', JSON.stringify(sid && { h: sid.httpOnly, s: sid.sameSite }))

// persistence: reload and open a new tab in the same context
await page.reload()
await page.waitForTimeout(1200)
check('session persists after reload', /\/app/.test(page.url()))
const page2 = await ctx.newPage()
await page2.goto(`${BASE}/app/profile`)
check('session is shared by a second tab', await seen(page2.getByText(email)))
await page2.close()
const me = await page.evaluate(() => fetch('/api/auth/me').then((r) => r.json()))
check('API /auth/me returns the new rider', me?.user?.email === email && me.user.role === 'rider')
await page.goto(`${BASE}/operator/fleet`)
check('rider cannot reach the operator console', await seen(page.getByText(/don.t have access/i)))

// favourites sync to the server and activity timeline shows account activity
await page.goto(`${BASE}/app/profile`)
check('profile shows the activity timeline', await seen(page.getByRole('list', { name: 'Activity timeline' }).or(page.getByText('No activity yet'))))

// logout
await page.goto(`${BASE}/app/profile`)
await page.getByRole('button', { name: 'Sign out' }).first().click()
check('logout returns to a public page', await seen(page.getByRole('heading', { name: /Welcome back|Know where your bus/ }).first()))
const afterOut = await page.evaluate(() => fetch('/api/me/data').then((r) => r.status))
check('session is gone on the server after logout (401)', afterOut === 401, String(afterOut))
await page.goto(`${BASE}/app/map`)
check('protected page is closed again after logout', await seen(page.getByRole('heading', { name: 'Welcome back' })))

// duplicate account
await page.goto(`${BASE}/signup`)
await page.getByLabel('Full name').fill('E2E Rider Again')
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password', { exact: true }).fill(password)
await page.getByLabel(/I agree/).check()
await page.getByRole('button', { name: 'Create account' }).click()
check('duplicate email is refused with a clear message', await seen(page.getByRole('alert').filter({ hasText: /already/i })))

// invalid credentials, then valid login
await page.goto(`${BASE}/login`)
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password', { exact: true }).fill('Wrong-Password-1')
await page.getByRole('button', { name: 'Sign in', exact: true }).click()
check('wrong password shows a generic error', await seen(page.getByRole('alert').filter({ hasText: /don.t match/i })))
await page.getByLabel('Password', { exact: true }).fill(password)
await page.getByRole('button', { name: 'Sign in', exact: true }).click()
await page.waitForURL(/\/app/, { timeout: 10000 }).catch(() => {})
check('valid email + password logs in', /\/app/.test(page.url()))
await page.screenshot({ path: `${SHOTS}/60-after-login.png` })

// Google: unconfigured server explains itself; button is present
await ctx.clearCookies()
await page.goto(`${BASE}/login`)
check('"Continue with Google" button is visible', await seen(page.getByRole('button', { name: 'Continue with Google' })))
await page.goto(`${BASE}/api/auth/google`)
await page.waitForURL(/\/login/, { timeout: 8000 }).catch(() => {})
const googleConfigured = /accounts\.google\.com/.test(page.url())
if (!googleConfigured) {
  check('Google route without credentials redirects to login with an explanation', /error=google-unavailable/.test(page.url()) && (await seen(page.getByRole('alert').filter({ hasText: /Google sign-in/ }))))
}

await browser.close()
const real = errors.filter((e) => !/status of (400|401|403|409|429)|ERR_TUNNEL_CONNECTION_FAILED/.test(e))
check('no unexpected console/page errors', real.length === 0, real.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} auth checks passed`)
process.exit(failed.length ? 1 : 0)

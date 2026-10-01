// Real-browser end-to-end check against the production build served by the Node server.
//   npm run build && npm run server   (in another shell)   then:   node e2e/run.mjs
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:8787'
const SHOTS = process.env.SHOTS ?? 'e2e/shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const errors = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  - ' + detail : ''}`)
}
const seen = async (loc, timeout = 6000) => loc.waitFor({ timeout }).then(() => true, () => false)
const watch = (page, tag) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] console: ${m.text()}`))
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`))
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })

async function login(page, label) {
  await page.goto(`${BASE}/login`)
  await page.getByRole('button', { name: label, exact: true }).click()
}

/* ---------- passenger ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await ctx.newPage()
  watch(page, 'rider')
  await page.goto(BASE)
  check('landing renders', await page.getByRole('heading', { level: 1 }).first().isVisible())
  await page.screenshot({ path: `${SHOTS}/01-landing.png` })
  await login(page, 'Passenger')
  await page.waitForURL(/\/app\/map/)
  await page.waitForSelector('[aria-label*="BUS-"], [role="button"][aria-label*="BUS-"]', { timeout: 10000 }).catch(() => {})
  check('passenger signs in through real API (cookie session)', (await ctx.cookies()).some((c) => c.httpOnly))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/02-live-map.png` })

  await page.goto(`${BASE}/app/routes?from=MUET&to=Hyderabad`)
  await page.getByText(/PKR \d+/).first().waitFor()
  check('route search shows fare', true)
  await page.screenshot({ path: `${SHOTS}/03-routes.png` })

  await page.goto(`${BASE}/app/routes?from=Kotri%20Station&to=Hyderabad`)
  const transfer = await seen(page.getByText(/need one change/))
  check('transfer recommendation when no direct bus', transfer)
  if (transfer) await page.screenshot({ path: `${SHOTS}/04-transfer.png` })

  await page.goto(`${BASE}/app/stops/bypass`)
  await page.getByRole('heading', { level: 1 }).waitFor()
  await page.waitForTimeout(800)
  check('stop page lists approaching buses', await page.getByLabel('Approaching buses').isVisible().catch(() => false))
  await page.screenshot({ path: `${SHOTS}/05-stop.png` })

  await page.goto(`${BASE}/app/buses/BUS-104`)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOTS}/07-bus-details.png` })
  await page.getByRole('group', { name: 'Report crowding' }).first().waitFor()
  await page.getByRole('button', { name: 'Filling up' }).first().click()
  check('crowd report accepted by server', await seen(page.getByText('Thanks, crowding updated')))

  // rider must not reach staff areas
  await page.goto(`${BASE}/operator`)
  check('rider blocked from /operator', await seen(page.getByText(/don.t have access/i)))
  await page.goto(`${BASE}/driver`)
  check('rider blocked from /driver', await seen(page.getByText(/don.t have access/i)))
  const forbidden = await page.evaluate(async () => {
    const r = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Busly-Client': '1' }, body: JSON.stringify({ action: { type: 'alert/publish', title: 'x', body: 'y' } }) })
    return r.status
  })
  check('server rejects rider publishing an alert (403/400)', forbidden === 403 || forbidden === 400, `status ${forbidden}`)

  // mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true })
  const mp = await m.newPage()
  watch(mp, 'rider-mobile')
  await login(mp, 'Passenger')
  await mp.waitForURL(/\/app\/map/)
  await mp.waitForTimeout(1500)
  await mp.screenshot({ path: `${SHOTS}/06-mobile-map.png` })
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('mobile: no horizontal scroll on map', !overflow)
  await m.close()
  await ctx.close()
}

/* ---------- driver with phone GPS ---------- */
let startedBus = null
{
  const ctx = await browser.newContext({ viewport: { width: 420, height: 880 }, permissions: ['geolocation'], geolocation: { latitude: 25.4096, longitude: 68.2589, accuracy: 10 } })
  const page = await ctx.newPage()
  watch(page, 'driver')
  await login(page, 'Driver')
  await page.waitForURL(/\/driver/)
  await page.getByRole('heading', { name: 'Driver app' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/10-driver-start.png` })
  await page.getByRole('button', { name: /Start trip/ }).click()
  await page.getByText('Next stop').first().waitFor({ timeout: 8000 })
  check('driver starts a trip (simulated GPS)', true)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/11-driver-active.png` })

  await page.getByRole('button', { name: 'Traffic delay' }).click()
  await page.getByRole('button', { name: /^(Report|Send|Confirm|Save)/ }).last().click().catch(() => {})
  await page.waitForTimeout(800)
  check('driver delay report accepted', await page.getByText(/delay/i).first().isVisible())
  await page.screenshot({ path: `${SHOTS}/12-driver-delay.png` })

  // driver cannot call operator actions
  const status = await page.evaluate(async () => (await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Busly-Client': '1' }, body: JSON.stringify({ action: { type: 'bus/delete', busId: 'BUS-104' } }) })).status)
  check('server rejects driver deleting a bus', status === 403, `status ${status}`)
  await ctx.close()
}

/* ---------- operator ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const page = await ctx.newPage()
  watch(page, 'operator')
  await login(page, 'Operator')
  await page.waitForURL(/\/operator$/)
  await page.getByRole('heading', { name: 'Operations overview' }).waitFor()
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${SHOTS}/20-op-overview.png` })
  check('operator overview shows the live trip started by the driver', (await page.getByText(/in progress/).first().innerText().catch(() => '')).length > 0)

  // publish alert
  await page.goto(`${BASE}/operator/alerts`)
  await page.getByLabel('Title').fill('Kotri Bridge slow traffic')
  await page.getByLabel('Message').fill('Expect 10 minute delays on routes A and C.')
  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByText('Alert published to riders').waitFor()
  check('operator publishes an alert', true)
  await page.screenshot({ path: `${SHOTS}/21-op-alerts.png` })

  // close a stop
  await page.goto(`${BASE}/operator/routes`)
  await page.getByRole('button', { name: 'Close Qasimabad' }).click().catch(async () => { await page.getByRole('button', { name: /^Close / }).first().click() })
  await page.getByLabel('Reason').fill('Road work')
  await page.getByRole('button', { name: 'Close stop' }).click()
  await page.getByText('Stop closed, riders notified').waitFor()
  check('operator closes a stop', true)
  await page.screenshot({ path: `${SHOTS}/22-op-routes.png` })

  // add bus
  await page.goto(`${BASE}/operator/fleet`)
  await page.getByRole('button', { name: 'Add bus' }).click()
  await page.getByLabel('Number plate').fill('HYD-9001')
  await page.getByLabel('Model').fill('Yutong ZK6')
  await page.getByRole('button', { name: 'Add bus' }).last().click()
  await page.getByText('Bus added').waitFor()
  check('operator adds a bus', true)
  await page.screenshot({ path: `${SHOTS}/23-op-fleet.png` })

  await page.goto(`${BASE}/operator/trips`)
  await page.getByText('In progress').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/24-op-trips.png` })

  await page.goto(`${BASE}/operator/analytics`)
  await page.getByRole('heading', { name: 'Analytics' }).waitFor()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${SHOTS}/25-op-analytics.png`, fullPage: true })
  check('analytics renders charts', (await page.locator('svg[role="img"]').count()) >= 2)

  check('operator has no Users tab', !(await page.getByRole('link', { name: 'Users and roles' }).isVisible().catch(() => false)))
  await page.goto(`${BASE}/operator/users`)
  check('operator blocked from admin users page', await seen(page.getByText(/don.t have access/i)))
  await ctx.close()
}

/* ---------- rider sees operator changes ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } })
  const page = await ctx.newPage()
  watch(page, 'rider2')
  await login(page, 'Passenger')
  await page.waitForURL(/\/app\/map/)
  await page.goto(`${BASE}/app`)
  await page.getByText('Kotri Bridge slow traffic').waitFor({ timeout: 8000 })
  check('rider sees the published alert', true)
  check('rider sees the closed stop', await seen(page.getByText(/Qasimabad/).first()))
  await page.screenshot({ path: `${SHOTS}/30-rider-alerts.png` })
  await ctx.close()
}

/* ---------- admin ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } })
  const page = await ctx.newPage()
  watch(page, 'admin')
  await login(page, 'Administrator')
  await page.waitForURL(/\/operator$/)
  await page.goto(`${BASE}/operator/users`)
  await page.getByRole('heading', { name: 'Users and roles' }).waitFor()
  await page.getByRole('button', { name: 'Add user' }).click()
  await page.getByLabel('Full name').fill('Test Driver')
  await page.getByLabel('Email').fill('test.driver@busly.app')
  await page.getByRole('button', { name: 'Create user' }).click()
  await page.getByText(/Temporary password/).waitFor()
  check('admin creates a user with a temporary password', true)
  await page.screenshot({ path: `${SHOTS}/40-admin-users.png` })
  await ctx.close()
}

await browser.close()

const realErrors = errors.filter((e) => !/Failed to load resource: (the server responded with a status of (401|403)|net::ERR_TUNNEL_CONNECTION_FAILED)/.test(e))
check('no unexpected console/page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)

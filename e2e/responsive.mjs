// Visits key pages at four viewports and fails on horizontal overflow or console errors.
import { chromium } from 'playwright'
const BASE = process.env.BASE_URL ?? 'http://localhost:8787'
const sizes = { desktop: [1440, 900], laptop: [1280, 720], tablet: [768, 1024], mobile: [390, 844] }
const roles = {
  none: ['/', '/login', '/signup', '/forgot-password', '/nope'],
  Passenger: ['/app/map', '/app/routes', '/app/buses', '/app/buses/BUS-104', '/app/favorites', '/app/notifications', '/app/profile', '/app/missing'],
  Operator: ['/operator', '/operator/fleet', '/operator/routes', '/operator/alerts', '/operator/trips', '/operator/analytics'],
  Driver: ['/driver'],
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
let bad = 0
let n = 0
for (const [size, [w, h]] of Object.entries(sizes)) {
  for (const [role, paths] of Object.entries(roles)) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL|status of (401|403)/.test(m.text()) && errs.push(m.text().slice(0, 120)))
    if (role !== 'none') {
      await p.goto(`${BASE}/login`)
      await p.getByRole('button', { name: role, exact: true }).click()
      await p.waitForTimeout(900)
    }
    for (const path of paths) {
      await p.goto(BASE + path)
      await p.waitForTimeout(900)
      await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)) } scrollTo(0, 0) })
      const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      n++
      if (over > 1) { bad++; console.log(`FAIL  ${size} ${role} ${path}: overflows by ${over}px`) }
    }
    if (errs.length) { bad++; console.log(`FAIL  ${size} ${role}: console errors`, errs.slice(0, 3)) }
    await ctx.close()
  }
}
await browser.close()
console.log(bad ? `\n${bad} problem(s) across ${n} page visits` : `\nAll ${n} page visits at 4 viewports: no horizontal overflow, no console errors`)
process.exit(bad ? 1 : 0)

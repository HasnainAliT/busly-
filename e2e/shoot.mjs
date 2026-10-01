// Screenshot helper for design review: node e2e/shoot.mjs <role> <w> <h> path1 path2 ...
import { chromium } from 'playwright'
const [role, w, h, ...paths] = process.argv.slice(2)
const BASE = process.env.BASE_URL ?? 'http://localhost:8787'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && !/ERR_TUNNEL/.test(m.text()) && errs.push(m.text().slice(0, 140)))
if (role !== 'none') {
  await p.goto(`${BASE}/login`)
  await p.getByRole('button', { name: role, exact: true }).click()
  await p.waitForTimeout(1200)
}
for (const path of paths) {
  await p.goto(BASE + path)
  await p.waitForTimeout(1800)
  if (process.env.FULL === '1') {
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) } scrollTo(0, 0) })
    await p.waitForTimeout(900)
  }
  const name = (role + path).replace(/[^a-z0-9]+/gi, '_')
  await p.screenshot({ path: `/tmp/shots/${name}_${w}.png`, fullPage: process.env.FULL === '1' })
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  console.log(name, w, ov ? 'HORIZONTAL OVERFLOW' : 'ok')
}
if (errs.length) console.log('ERRORS', errs)
await b.close()

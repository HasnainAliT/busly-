import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
const p = await (await b.newContext({ viewport: { width: 1200, height: 800 } })).newPage()
await p.goto('http://localhost:8787/login'); await p.getByRole('button', { name: 'Passenger', exact: true }).click(); await p.waitForURL(/app/)
await p.goto('http://localhost:8787/app/buses/BUS-104'); await p.waitForTimeout(1500)
console.log(await p.getByRole('group', { name: 'Report crowding' }).count())
await p.screenshot({ path: '/tmp/dbg2.png' })
console.log((await p.locator('body').innerText()).slice(0,900))
await b.close()

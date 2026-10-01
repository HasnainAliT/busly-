import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { parseTrackingPayload, sanitizeText, validateEmail, validatePassword } from '@/utils/security'

const signIn = () =>
  sessionStorage.setItem('busly.session.v1', JSON.stringify({ name: 'Demo Rider', email: 'demo@busly.app', role: 'rider', signedInAt: Date.now() }))

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  // Anything React complains about (keys, invalid DOM nesting, update loops) fails the test.
  const real = errorSpy.mock.calls.filter((c: unknown[]) => !String(c[0]).includes('not wrapped in act'))
  expect(real, real.map((c: unknown[]) => String(c[0]).slice(0, 200)).join('\n')).toHaveLength(0)
  errorSpy.mockRestore()
})

const open = (path: string) => {
  window.history.pushState({}, '', path)
  return render(<App />)
}

describe('public pages', () => {
  it('renders the landing page with the headline and demo CTA', async () => {
    open('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Know where your bus is/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Try the live demo/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: /Security you can inspect/ })).toBeInTheDocument()
  })

  it('redirects signed-out visitors from /app to login', async () => {
    open('/app/map')
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('shows validation errors on an empty login', async () => {
    open('/login')
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter a password.')).toBeInTheDocument()
  })

  it('shows the error state for the blocked demo account', async () => {
    open('/login')
    await userEvent.type(await screen.findByLabelText('Email'), 'blocked@busly.app')
    await userEvent.type(screen.getByLabelText('Password'), 'password123')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/don't match/, undefined, { timeout: 5000 })).toBeInTheDocument()
  })

  it('renders signup and forgot password', async () => {
    const { unmount } = open('/signup')
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    unmount()
    open('/forgot-password')
    expect(await screen.findByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
  })

  it('renders a public tracking page for a valid bus and rejects an invalid one', async () => {
    const { unmount } = open('/track/BUS-104')
    expect(await screen.findByText(/Route timeline/, undefined, { timeout: 6000 })).toBeInTheDocument()
    unmount()
    open('/track/not-a-bus')
    expect(await screen.findByText("This tracking link isn't valid")).toBeInTheDocument()
  })
})

describe('signed-in app', () => {
  beforeEach(signIn)

  it('renders the dashboard with live stats', async () => {
    open('/app')
    expect(await screen.findByText('Live buses', undefined, { timeout: 6000 })).toBeInTheDocument()
    expect(screen.getByText('Average ETA')).toBeInTheDocument()
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('lists buses on the live map and opens details on selection', async () => {
    open('/app/map')
    const card = await screen.findByRole('button', { name: /^BUS-104, Route A/, pressed: false }, { timeout: 6000 })
    await userEvent.click(card)
    expect(await screen.findByText(/Arrives at Hyderabad in/)).toBeInTheDocument()
    expect(screen.getByText('Upcoming stops')).toBeInTheDocument()
  })

  it('filters buses by search and shows the empty state', async () => {
    open('/app/map')
    const search = await screen.findByLabelText('Search buses, routes or stops', undefined, { timeout: 6000 })
    await userEvent.type(search, 'zzzz')
    expect(await screen.findByText('Nothing matches that search')).toBeInTheDocument()
  })

  it('finds MUET to Hyderabad routes', async () => {
    open('/app/routes?from=MUET&to=Hyderabad')
    expect((await screen.findAllByRole('heading', { name: 'Route A' }, { timeout: 6000 })).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /View route/ }).length).toBeGreaterThan(0)
  })

  it('shows no-route state for an impossible journey', async () => {
    open('/app/routes?from=Tando%20Jam&to=MUET')
    expect(await screen.findByText('No direct route found', undefined, { timeout: 6000 })).toBeInTheDocument()
  })

  it('renders bus details and handles an unknown bus', async () => {
    const { unmount } = open('/app/buses/BUS-104')
    expect(await screen.findByRole('heading', { name: 'BUS-104' }, { timeout: 6000 })).toBeInTheDocument()
    expect(screen.getByText('Route timeline')).toBeInTheDocument()
    unmount()
    open('/app/buses/BUS-999')
    expect(await screen.findByText("We can't find that bus", undefined, { timeout: 6000 })).toBeInTheDocument()
  })

  it('opens the QR scanner and completes a simulated scan', async () => {
    open('/app')
    await userEvent.click((await screen.findAllByRole('button', { name: /Scan/ }))[0])
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Scan this code/ }))
    expect(await within(dialog).findByRole('button', { name: /Open live tracking/ }, { timeout: 5000 })).toBeInTheDocument()
  })

  it('renders favorites, notifications and profile', async () => {
    const a = open('/app/favorites')
    expect(await screen.findByRole('heading', { name: 'Favorites' })).toBeInTheDocument()
    a.unmount()
    const b = open('/app/notifications')
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('BUS-104 is approaching your stop')).toBeInTheDocument()
    b.unmount()
    open('/app/profile')
    expect(await screen.findByRole('heading', { name: 'Privacy controls' })).toBeInTheDocument()
  })
})

describe('security helpers', () => {
  const origin = window.location.origin
  it('accepts only same-origin tracking links for known buses', () => {
    expect(parseTrackingPayload(`${origin}/track/BUS-104`)).toEqual({ ok: true, busId: 'BUS-104' })
    expect(parseTrackingPayload('busly://bus/BUS-201')).toEqual({ ok: true, busId: 'BUS-201' })
    expect(parseTrackingPayload('https://evil.example/track/BUS-104').ok).toBe(false)
    expect(parseTrackingPayload('javascript:alert(1)').ok).toBe(false)
    expect(parseTrackingPayload(`${origin}/track/BUS-999`).ok).toBe(false)
    expect(parseTrackingPayload(`${origin}/track/../admin`).ok).toBe(false)
  })

  it('sanitises user text and validates inputs', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>hello‮')).toBe('img src=x onerror=alert(1)hello')
    expect(validateEmail('nope')).not.toBeNull()
    expect(validateEmail('a@b.co')).toBeNull()
    expect(validatePassword('short')).not.toBeNull()
  })
})

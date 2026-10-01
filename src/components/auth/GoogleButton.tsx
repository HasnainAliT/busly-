import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getProviders } from '@/services/backend'
import { useAuth } from '@/context/AuthContext'

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
    <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.27-2.09 3.57-5.17 3.57-8.81Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4-3.1Z" />
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.43-3.43C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
  </svg>
)

/** "Continue with Google". A full-page redirect to the server, which runs the OAuth flow with Passport. */
export function GoogleButton({ label = 'Continue with Google', onUnavailable }: { label?: string; onUnavailable: (message: string) => void }) {
  const { mode } = useAuth()
  const [busy, setBusy] = useState(false)
  const go = () => {
    if (mode !== 'api') return onUnavailable('Google sign-in needs the Busly server. Run it with npm run start, or use the demo buttons.')
    if (!getProviders().google) return onUnavailable("Google sign-in isn't set up on this server yet. Use your email and password for now.")
    setBusy(true)
    window.location.assign('/api/auth/google')
  }
  return (
    <Button type="button" variant="outline" size="lg" className="w-full bg-card" onClick={go} disabled={busy}>
      <GoogleMark /> {busy ? 'Opening Google...' : label}
    </Button>
  )
}

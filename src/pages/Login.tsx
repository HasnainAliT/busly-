import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Loader2, Mail, Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { AuthShell, FormAlert } from '@/components/auth/AuthShell'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { googleErrorMessage } from '@/components/auth/googleErrors'
import { Field, PasswordField } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { AuthError, useAuth } from '@/context/AuthContext'
import { demoAccounts, useDemoLogin } from '@/hooks/useDemoLogin'
import type { Role } from '@/types'
import { isLocked, registerFailure, validateEmail, validatePassword, type LimiterState } from '@/utils/security'

function DemoButton({ role, disabled }: { role: Role; disabled: boolean }) {
  const demo = useDemoLogin(role)
  return (
    <Button type="button" variant="glass" className="w-full" onClick={demo.start} disabled={demo.pending || disabled}>
      <Play className="fill-current" /> {demoAccounts[role].label}
    </Button>
  )
}

export default function LoginPage() {
  const { login, mode } = useAuth()
  const [params] = useSearchParams()
  const googleError = googleErrorMessage(params.get('error'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({})
  const [formError, setFormError] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null)
  const [pending, setPending] = useState(false)
  const [googleNote, setGoogleNote] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [limiter, setLimiter] = useState<LimiterState>({ failures: 0, lockedUntil: 0 })
  const [now, setNow] = useState(Date.now())

  const locked = isLocked(limiter, now)
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [locked])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending || locked) return
    const next = { email: validateEmail(email), password: validatePassword(password) }
    setErrors(next)
    setFormError(null)
    if (next.email || next.password) return

    setPending(true)
    try {
      await login(email, password)
      setDone(true)
    } catch (err) {
      if (err instanceof AuthError && err.code === 'invalid') {
        const nextState = registerFailure(limiter)
        setLimiter(nextState)
        setNow(Date.now())
        setFormError({ tone: 'danger', text: err.message })
      } else {
        setFormError({ tone: 'warning', text: err instanceof Error ? err.message : 'Something went wrong. Try again.' })
      }
    } finally {
      setPending(false)
    }
  }

  const secondsLeft = Math.max(0, Math.ceil((limiter.lockedUntil - now) / 1000))

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to follow your buses and saved routes."
      footer={
        <>
          New to Busly?{' '}
          <Link to="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
        {locked && <FormAlert tone="warning">Too many attempts. You can try again in {secondsLeft} seconds.</FormAlert>}
        {formError && !locked && <FormAlert tone={formError.tone}>{formError.text}</FormAlert>}
        {!formError && (googleNote ?? googleError) && <FormAlert tone="warning">{googleNote ?? googleError}</FormAlert>}

        <Field
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@university.edu.pk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setErrors((s) => ({ ...s, email: validateEmail(email) }))}
          error={errors.email}
          icon={<Mail />}
          maxLength={254}
          disabled={pending || done}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          maxLength={128}
          disabled={pending || done}
          trailing={
            <Link to="/forgot-password" className="text-[13px] font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          }
        />

        <Button type="submit" size="lg" className="w-full" disabled={pending || locked || done}>
          {done ? (
            <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex items-center gap-2">
              <Check /> Signed in
            </motion.span>
          ) : pending ? (
            <>
              <Loader2 className="animate-spin" /> Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </Button>

        <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-white/10">
          <span className="relative bg-background px-3">or</span>
        </div>

        <GoogleButton onUnavailable={setGoogleNote} />

        <p className="pt-1 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Try a demo account</p>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Try a demo account">
          {(['rider', 'driver', 'operator', 'admin'] as const).map((r) => (
            <DemoButton key={r} role={r} disabled={pending} />
          ))}
        </div>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          {mode === 'api'
            ? 'Demo accounts use the shared demo password. Real accounts are checked by the server.'
            : 'Prototype mode: any valid email and an 8+ character password signs you in. Try blocked@busly.app to preview the error state.'}
        </p>
      </form>
    </AuthShell>
  )
}

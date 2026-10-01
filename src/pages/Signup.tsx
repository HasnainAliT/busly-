import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mail, UserRound } from 'lucide-react'
import { AuthShell, FormAlert } from '@/components/auth/AuthShell'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Field, PasswordField } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { AuthError, useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'
import { passwordStrength, validateEmail, validateName, validateStrongPassword } from '@/utils/security'

const strengthLabel = ['Too short', 'Weak', 'Good', 'Strong'] as const

export default function SignupPage() {
  const { signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [pending, setPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [googleNote, setGoogleNote] = useState<string | null>(null)

  const strength = passwordStrength(password)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (pending) return
    const next = {
      name: validateName(name),
      email: validateEmail(email),
      password: validateStrongPassword(password),
      agree: agree ? null : 'Accept the terms to continue.',
    }
    setErrors(next)
    setFormError(null)
    if (Object.values(next).some(Boolean)) return
    setPending(true)
    try {
      await signup(name, email, password)
      // PublicOnlyRoute redirects into the app as soon as the session exists.
    } catch (err) {
      setFormError(err instanceof AuthError ? err.message : "We couldn't create your account. Check your connection and try again.")
      setPending(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save buses, routes and stops, and get alerts when it's time to leave."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4" aria-busy={pending}>
        {formError && <FormAlert tone="danger">{formError}</FormAlert>}
        {googleNote && <FormAlert tone="warning">{googleNote}</FormAlert>}
        <GoogleButton label="Sign up with Google" onUnavailable={setGoogleNote} />
        <div className="relative py-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-white/10">
          <span className="relative bg-background px-3">or with email</span>
        </div>
        <Field label="Full name" name="name" autoComplete="name" placeholder="Ayesha Khan" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} icon={<UserRound />} maxLength={60} disabled={pending} />
        <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@university.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} icon={<Mail />} maxLength={254} disabled={pending} />
        <div>
          <PasswordField label="Password" name="new-password" autoComplete="new-password" placeholder="Use 8 or more characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} maxLength={128} disabled={pending} />
          {password && (
            <div className="mt-2.5" aria-live="polite">
              <div className="flex gap-1.5" aria-hidden>
                {[1, 2, 3].map((n) => (
                  <span key={n} className={cn('h-1 flex-1 rounded-full transition-colors', strength >= n ? (strength === 1 ? 'bg-danger' : strength === 2 ? 'bg-warning' : 'bg-success') : 'bg-white/10')} />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Password strength: {strengthLabel[strength]}</p>
            </div>
          )}
        </div>

        <div>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-muted-foreground">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-[18px] shrink-0 accent-[hsl(var(--primary))]" aria-invalid={!!errors.agree} />
            <span>I agree to the terms of use and understand that bus data in this prototype is simulated.</span>
          </label>
          {errors.agree && (
            <p role="alert" className="mt-1.5 text-[13px] text-danger">
              {errors.agree}
            </p>
          )}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthShell>
  )
}

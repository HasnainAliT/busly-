import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { AuthShell, FormAlert } from '@/components/auth/AuthShell'
import { OtpInput } from '@/components/auth/OtpInput'
import { Field, PasswordField } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { validateEmail, validateStrongPassword } from '@/utils/security'

type Step = 'email' | 'code' | 'done'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [pending, setPending] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // Backend integration: POST /auth/password-reset/request then /confirm. Always answer with the same message
  // whether or not the account exists so the form cannot be used to discover registered emails.
  const requestCode = async (e?: FormEvent) => {
    e?.preventDefault()
    const err = validateEmail(email)
    setErrors({ email: err })
    if (err || pending) return
    setPending(true)
    await wait(900)
    setPending(false)
    setResendIn(30)
    setStep('code')
  }

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    const next = {
      code: /^\d{6}$/.test(code) ? null : 'Enter the 6-digit code.',
      password: validateStrongPassword(password),
    }
    setErrors(next)
    if (next.code || next.password || pending) return
    setPending(true)
    await wait(1000)
    setPending(false)
    setStep('done')
  }

  return (
    <AuthShell
      title={step === 'done' ? 'Password updated' : step === 'code' ? 'Check your email' : 'Reset your password'}
      subtitle={step === 'done' ? 'You can now sign in with your new password.' : step === 'code' ? 'Enter the 6-digit code and choose a new password.' : "Enter your email and we'll send a one-time code."}
      footer={
        step !== 'done' && (
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {step === 'email' && (
          <motion.form key="email" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={requestCode} noValidate className="space-y-4">
            <Field label="Email" type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@university.edu.pk" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} icon={<Mail />} maxLength={254} disabled={pending} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Sending code...
                </>
              ) : (
                'Send code'
              )}
            </Button>
          </motion.form>
        )}

        {step === 'code' && (
          <motion.form key="code" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={confirm} noValidate className="space-y-4">
            <FormAlert tone="success">If an account exists for {email.slice(0, 60)}, a code is on its way. Prototype: any 6 digits work.</FormAlert>
            <div>
              <p className="mb-2 text-sm font-medium">Verification code</p>
              <OtpInput value={code} onChange={setCode} invalid={!!errors.code} disabled={pending} />
              {errors.code && (
                <p role="alert" className="mt-1.5 text-[13px] text-danger">
                  {errors.code}
                </p>
              )}
            </div>
            <PasswordField label="New password" name="new-password" autoComplete="new-password" placeholder="Use 8 or more characters" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} maxLength={128} disabled={pending} />
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Updating...
                </>
              ) : (
                'Update password'
              )}
            </Button>
            <button type="button" onClick={() => requestCode()} disabled={resendIn > 0 || pending} className="mx-auto block text-sm font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </button>
          </motion.form>
        )}

        {step === 'done' && (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 text-center">
            <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 16 }} className="mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-9" />
            </motion.div>
            <Button asChild size="lg" className="w-full">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

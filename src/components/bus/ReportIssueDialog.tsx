import { useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/components/auth/AuthShell'
import { useUserData } from '@/context/UserDataContext'
import { sanitizeText } from '@/utils/security'
import { useDispatch } from '@/hooks/useDispatch'

const categories = ['Running late', 'Wrong location on the map', 'Crowded', 'Safety concern', 'Something else'] as const
const MAX = 280

/** Demonstrates safe handling of user-generated text: validated, sanitised, rate-limited, never rendered as HTML. */
export function ReportIssueDialog({ busId, open, onOpenChange }: { busId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addActivity } = useUserData()
  const { run } = useDispatch()
  const [category, setCategory] = useState<(typeof categories)[number]>(categories[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [sentAt, setSentAt] = useState<number[]>([])

  const reset = () => {
    setNote('')
    setError(null)
    setDone(false)
    setCategory(categories[0])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = sanitizeText(note, MAX)
    const now = Date.now()
    const recent = sentAt.filter((t) => now - t < 60_000)
    if (recent.length >= 3) return setError('You sent a few reports just now. Wait a minute before sending another.')
    if (category === 'Something else' && clean.length < 10) return setError('Add a few more details (at least 10 characters).')
    setError(null)
    setPending(true)
    const r = await run({ type: 'issue/report', busId, category, note: clean }, { quiet: true })
    setPending(false)
    if (!r.ok) return setError(r.message)
    setSentAt([...recent, now])
    addActivity(`Reported "${category}" on ${busId}`)
    setDone(true)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) setTimeout(reset, 200)
      }}
      title={`Report a problem with ${busId}`}
      description="Reports help operators fix issues faster."
    >
      {done ? (
        <div className="py-6 text-center">
          <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 16 }} className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-8" />
          </motion.div>
          <p className="mt-4 font-display text-lg font-semibold">Report sent</p>
          <p className="mt-1 text-sm text-muted-foreground">Thanks. Operators can see your report on their alerts page.</p>
          <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && <FormAlert tone="danger">{error}</FormAlert>}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">What's happening?</legend>
            <div className="grid gap-2">
              {categories.map((c) => (
                <label key={c} className={`flex h-11 cursor-pointer items-center gap-3 rounded-lg border px-3.5 text-sm transition-colors ${category === c ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-white/4 hover:bg-white/8'}`}>
                  <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} className="size-4 accent-[hsl(var(--primary))]" />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="report-note" className="mb-1.5 block text-sm font-medium">Details <span className="font-normal text-muted-foreground">(optional)</span></label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, MAX))}
              rows={3}
              maxLength={MAX}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3.5 py-3 text-sm placeholder:text-muted-foreground/80 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              placeholder="Add anything that helps the operator."
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">{note.length}/{MAX}</p>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Sending...
              </>
            ) : (
              'Send report'
            )}
          </Button>
        </form>
      )}
    </Modal>
  )
}

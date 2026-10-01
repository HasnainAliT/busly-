import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const links = [
  { href: '#product', label: 'Features' },
  { href: '#routes', label: 'Routes' },
  { href: '#tour', label: 'Try the demo' },
  { href: '#security', label: 'Security' },
]

export function LandingNav() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={cn('sticky top-0 z-50 transition-all duration-300', scrolled || open ? 'border-b border-border bg-background/90 backdrop-blur-xl' : 'border-b border-transparent bg-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Busly home">
          <Logo />
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/6 hover:text-foreground">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild size="sm">
              <Link to="/app">Open app</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup">Create account</Link>
              </Button>
            </>
          )}
        </div>
        <button
          className="grid size-11 place-items-center rounded-lg text-foreground md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden md:hidden"
          >
            <nav aria-label="Mobile" className="space-y-1 px-4 pb-5 pt-1">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex h-12 items-center rounded-lg px-3 text-base font-medium text-foreground/90 hover:bg-white/6">
                  {l.label}
                </a>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-3">
                {user ? (
                  <Button asChild className="col-span-2">
                    <Link to="/app">Open app</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link to="/login">Sign in</Link>
                    </Button>
                    <Button asChild>
                      <Link to="/signup">Create account</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

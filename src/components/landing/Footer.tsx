import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/logo'

const cols = [
  { title: 'Product', links: [['Features', '#product'], ['Routes', '#routes'], ['Try the demo', '#tour'], ['Security', '#security']] },
  { title: 'Account', links: [['Sign in', '/login'], ['Create account', '/signup'], ['Forgot password', '/forgot-password']] },
]

export function Footer() {
  return (
    <footer className="mt-4 bg-[hsl(165_55%_8%)] text-[hsl(45_30%_90%)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <span className="text-[hsl(45_40%_97%)]"><Logo /></span>
          <p className="max-w-sm text-sm leading-relaxed text-[hsl(45_20%_80%/.8)]">Live bus tracking for campus and city travel. Positions in this demo are simulated; the platform, accounts and alerts are real.</p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(150_55%_70%)]">{c.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  {href.startsWith('#') ? <a href={href} className="text-[hsl(45_30%_90%/.85)] hover:text-white">{label}</a> : <Link to={href} className="text-[hsl(45_30%_90%/.85)] hover:text-white">{label}</Link>}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-[hsl(45_40%_97%/.1)]">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-[hsl(45_20%_80%/.65)] sm:px-6 lg:px-8">Busly, a smart public transport and bus tracking platform.</p>
      </div>
    </footer>
  )
}

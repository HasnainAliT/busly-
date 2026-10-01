import { Skeleton } from '@/components/ui/skeleton'
import { LogoMark } from '@/components/ui/logo'

/** Route-level loading placeholder used while lazy pages download. */
export function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 md:px-8" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

export function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading Busly">
      <LogoMark className="size-14 animate-pulse" />
    </div>
  )
}

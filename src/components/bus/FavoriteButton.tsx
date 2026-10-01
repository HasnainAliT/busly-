import { motion } from 'framer-motion'
import { Heart, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserData, type FavoriteKind } from '@/context/UserDataContext'
import { useToast } from '@/components/ui/toast'

interface Props {
  kind: FavoriteKind
  id: string
  label: string
  className?: string
  icon?: 'heart' | 'star'
  quiet?: boolean
}

export function FavoriteButton({ kind, id, label, className, icon = 'heart', quiet = false }: Props) {
  const { isFavorite, toggleFavorite, addActivity } = useUserData()
  const toast = useToast()
  const active = isFavorite(kind, id)
  const Icon = icon === 'heart' ? Heart : Star

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.86 }}
      onClick={(e) => {
        e.stopPropagation()
        const added = toggleFavorite(kind, id)
        addActivity(added ? `Saved ${label} to favorites` : `Removed ${label} from favorites`)
        toast({ title: added ? 'Saved to favorites' : 'Removed from favorites', description: label, tone: added ? 'success' : 'info' })
      }}
      aria-pressed={active}
      aria-label={active ? `Remove ${label} from favorites` : `Add ${label} to favorites`}
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-lg transition-colors',
        quiet ? 'hover:bg-white/10' : 'border border-white/10 bg-white/5 hover:bg-white/10',
        active ? 'text-rose-400' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <motion.span key={String(active)} initial={{ scale: active ? 0.6 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 14 }}>
        <Icon className="size-[18px]" fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
      </motion.span>
    </motion.button>
  )
}

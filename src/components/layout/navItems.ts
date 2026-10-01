import { Bell, Bus, Heart, Home, Map, Route, UserRound, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Shown in the 5-slot mobile bar. */
  mobile?: boolean
}

export const navItems: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true, mobile: true },
  { to: '/app/map', label: 'Live Map', icon: Map, mobile: true },
  { to: '/app/routes', label: 'Routes', icon: Route, mobile: true },
  { to: '/app/buses', label: 'Buses', icon: Bus, mobile: true },
  { to: '/app/favorites', label: 'Favorites', icon: Heart },
  { to: '/app/notifications', label: 'Notifications', icon: Bell },
  { to: '/app/profile', label: 'Profile', icon: UserRound, mobile: true },
]

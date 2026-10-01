import type { Action } from '../src/domain/engine'

/** Short, human-readable line for the activity timeline. Never includes passwords or other secrets. */
export function describeAction(a: Action): string | null {
  switch (a.type) {
    case 'driver/location':
      return null // far too frequent to be useful in a timeline
    case 'trip/start':
      return `Started a trip on bus ${a.busId}`
    case 'trip/end':
      return 'Ended a trip'
    case 'trip/cancel':
      return 'Cancelled a trip'
    case 'trip/update':
      return `Reported ${a.kind.replace('-', ' ')}`
    case 'bus/create':
      return `Added bus ${a.bus.plate}`
    case 'bus/update':
      return `Updated bus ${a.busId}`
    case 'bus/delete':
      return `Removed bus ${a.busId}`
    case 'bus/assign':
      return a.driverId ? `Assigned a driver to bus ${a.busId}` : `Unassigned the driver of bus ${a.busId}`
    case 'bus/status':
      return `Set bus ${a.busId} to ${a.status}`
    case 'route/create':
      return `Created route ${a.route.code}`
    case 'route/update':
      return `Updated route ${a.routeId}`
    case 'route/delete':
      return `Deleted route ${a.routeId}`
    case 'stop/create':
      return `Added stop ${a.stop.name}`
    case 'stop/update':
      return `Updated stop ${a.stopId}`
    case 'stop/delete':
      return `Deleted stop ${a.stopId}`
    case 'stop/close':
      return a.closed ? `Closed stop ${a.stopId}` : `Reopened stop ${a.stopId}`
    case 'alert/publish':
      return `Published alert "${a.title.slice(0, 60)}"`
    case 'alert/resolve':
      return 'Resolved an alert'
    case 'crowd/report':
      return `Reported crowding on bus ${a.busId}`
    case 'issue/report':
      return `Reported a problem on bus ${a.busId}`
    case 'issue/resolve':
      return 'Resolved a rider report'
    case 'driver/create':
      return `Added driver ${a.name}`
    case 'driver/update':
      return `Updated driver ${a.driverId}`
    case 'user/setRole':
      return `Changed a user's role to ${a.role}`
    case 'user/setActive':
      return a.active ? 'Enabled an account' : 'Disabled an account'
    case 'user/create':
      return `Created a ${a.role} account`
    case 'sim/speed':
      return `Set the demo clock to ${a.simSpeed}x`
    default:
      return null
  }
}

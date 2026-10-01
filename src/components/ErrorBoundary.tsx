import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StateCard } from '@/components/ui/states'
import { TriangleAlert } from 'lucide-react'

interface State {
  failed: boolean
}

/** Last line of defence so one broken screen never blanks the whole app. Report to your logging service in componentDidCatch. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Integration point: send to Sentry/Datadog without including user data.
    if (import.meta.env.DEV) console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <StateCard
          className="glass max-w-md rounded-2xl"
          tone="danger"
          icon={<TriangleAlert />}
          title="Something went wrong"
          description="This screen hit an unexpected problem. Reloading usually fixes it. Your saved buses and routes are not affected."
          action={
            <Button onClick={() => window.location.reload()}>
              <RefreshCw /> Reload Busly
            </Button>
          }
        />
      </div>
    )
  }
}

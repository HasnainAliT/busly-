import { useCallback, useState } from 'react'
import type { Action } from '@/domain/engine'
import { getLiveFeed, type DispatchResult } from '@/services/liveFeed'
import { useToast } from '@/components/ui/toast'

/** Sends an action to the backend (local engine or server) with a pending flag and an optional toast. */
export function useDispatch() {
  const toast = useToast()
  const [pending, setPending] = useState(false)

  const run = useCallback(
    async (action: Action, opts: { success?: string; extra?: Record<string, unknown>; quiet?: boolean } = {}): Promise<DispatchResult> => {
      setPending(true)
      try {
        const result = await getLiveFeed().dispatch(action, opts.extra)
        if (result.ok && opts.success) toast({ title: opts.success, tone: 'success' })
        if (!result.ok && !opts.quiet) toast({ title: result.message, tone: 'danger' })
        return result
      } finally {
        setPending(false)
      }
    },
    [toast],
  )

  return { run, pending }
}

'use client'

import { useCallback, useState } from 'react'

/**
 * Shared fetch/busy/error boilerplate for one-click admin quick-actions.
 * Unlike an optimistic-before-fetch pattern (fine for a cosmetic toggle that
 * only reorders a list), quick-actions here trigger real side effects
 * (claim approval creates a user account and sends an email) — so `run`
 * resolves only after the request settles, and the caller applies its own
 * local state update on success rather than assuming it up front.
 */
export function useQuickAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<Response>): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error || 'Action failed.')
        return false
      }
      return true
    } catch {
      setError('Network error.')
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  return { busy, error, run }
}

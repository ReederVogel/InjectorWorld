'use client'

import { useEffect, useState } from 'react'

/**
 * Fetches a single admin analytics endpoint and re-fetches whenever `url`
 * changes (e.g. the shared range picker moves 7 -> 30 -> 90 days). Each
 * panel owns its own instance so one slow/failing endpoint never blocks
 * the others.
 */
export function useAnalyticsFetch<T>(url: string): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(url, { credentials: 'include' })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setError(json?.error || 'Failed to load.')
          setData(null)
          return
        }
        setData(json)
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load.')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return { data, loading, error }
}

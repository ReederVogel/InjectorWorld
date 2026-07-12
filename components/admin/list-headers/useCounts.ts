'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type WhereClause = Record<string, unknown>

export type CountSpec = {
  key: string
  collection: string
  where?: WhereClause
}

function serializeWhere(where: WhereClause, prefix = 'where'): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(where)) {
    const key = `${prefix}[${k}]`
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          parts.push(serializeWhere(item as WhereClause, `${key}[${i}]`))
        } else {
          parts.push(`${key}[${i}]=${encodeURIComponent(String(item))}`)
        }
      })
    } else if (v !== null && typeof v === 'object') {
      parts.push(serializeWhere(v as WhereClause, key))
    } else {
      parts.push(`${key}=${encodeURIComponent(String(v))}`)
    }
  }
  return parts.join('&')
}

async function fetchCount(collection: string, where?: WhereClause): Promise<number> {
  const qs = where ? `?${serializeWhere(where)}` : ''
  const res = await fetch(`/api/${collection}/count${qs}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`count failed: ${res.status}`)
  const data = await res.json()
  return typeof data?.totalDocs === 'number' ? data.totalDocs : 0
}

/**
 * Fetches a single doc's createdAt (oldest match for the given where clause,
 * via sort=createdAt ascending) and returns days elapsed since. Used for
 * "oldest pending item" readouts. Never throws — returns null on any failure.
 */
export async function fetchOldestPendingDays(
  collection: string,
  where: WhereClause,
): Promise<number | null> {
  try {
    const qs = serializeWhere(where)
    const res = await fetch(`/api/${collection}?limit=1&depth=0&sort=createdAt&${qs}`, {
      credentials: 'include',
    })
    if (!res.ok) return null
    const data = await res.json()
    const createdAt = data?.docs?.[0]?.createdAt
    if (!createdAt) return null
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  } catch {
    return null
  }
}

export function useCounts(specs: CountSpec[]) {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)
  const specsKey = JSON.stringify(specs)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        specs.map(async (spec) => {
          try {
            const count = await fetchCount(spec.collection, spec.where)
            return [spec.key, count] as const
          } catch {
            // Silent-fail per item: show a dash in the UI, never crash the list view.
            return [spec.key, null] as const
          }
        }),
      )
      if (id !== requestId.current) return
      const next: Record<string, number | null> = {}
      for (const [key, count] of results) next[key] = count
      setCounts(next)
    } catch (err: any) {
      if (id === requestId.current) setError(err?.message ?? 'Failed to load counts.')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specsKey])

  useEffect(() => {
    load()
  }, [load])

  return { counts, loading, error, refresh: load }
}

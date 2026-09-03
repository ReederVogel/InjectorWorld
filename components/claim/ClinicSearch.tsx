'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { ClinicLookupResult } from '@/app/api/clinics/lookup/route'

function inputClass() {
  return 'w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm'
}

/**
 * "Is your clinic already listed?" search.
 *
 * The directory already holds tens of thousands of scraped clinics, so the
 * overwhelmingly likely answer for a real owner is yes — and claiming that
 * record is the only path that actually links their account to a profile.
 * Sending them to a blank listing application instead is what produced
 * duplicate clinics, so this search sits in front of that application.
 *
 * `onNoMatch` is what the caller does when the owner genuinely isn't listed;
 * omit it to render search-only (the /claim landing page).
 */
export function ClinicSearch({
  onNoMatch,
  noMatchLabel = 'My practice is not listed',
  autoFocus = false,
}: {
  onNoMatch?: () => void
  noMatchLabel?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClinicLookupResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  // Guards against out-of-order responses: a slow request for "par" must not
  // overwrite the newer results for "park avenue".
  const requestId = useRef(0)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearched(false)
      setError('')
      return
    }

    const id = ++requestId.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinics/lookup?q=${encodeURIComponent(q)}`)
        if (id !== requestId.current) return
        if (!res.ok) {
          setError('Search is unavailable right now. Please try again.')
          setResults([])
          return
        }
        const data = await res.json()
        setResults(Array.isArray(data.results) ? data.results : [])
        setError('')
        setSearched(true)
      } catch {
        if (id !== requestId.current) return
        setError('Search is unavailable right now. Please try again.')
        setResults([])
      } finally {
        if (id === requestId.current) setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  const showEmpty = searched && !loading && results.length === 0 && query.trim().length >= 2

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="clinic-search" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Search for your clinic
        </label>
        <input
          id="clinic-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Park Avenue Aesthetics"
          className={inputClass()}
          autoComplete="off"
          autoFocus={autoFocus}
        />
        <p className="text-caption text-ink-tertiary mt-1.5">
          Most practices are already in our directory. Find yours to claim it.
        </p>
      </div>

      {error && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
          {error}
        </p>
      )}

      {loading && query.trim().length >= 2 && (
        <p className="text-body-sm text-ink-tertiary">Searching...</p>
      )}

      {results.length > 0 && (
        <ul className="divide-y divide-border-subtle rounded-xl border border-border overflow-hidden">
          {results.map((r) => (
            <li key={r.slug}>
              {r.claimed ? (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-surface">
                  <span className="min-w-0">
                    <span className="block text-body-sm text-ink-primary truncate">{r.name}</span>
                    <span className="block text-caption text-ink-tertiary truncate">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="text-caption text-ink-tertiary flex-shrink-0">Already claimed</span>
                </div>
              ) : (
                <Link
                  href={r.claimHref}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-brand-accent-soft/40 transition group"
                >
                  <span className="min-w-0">
                    <span className="block text-body-sm text-ink-primary group-hover:text-brand-accent transition truncate">
                      {r.name}
                    </span>
                    <span className="block text-caption text-ink-tertiary truncate">
                      {[r.city, r.state].filter(Boolean).join(', ')}
                    </span>
                  </span>
                  <span className="text-caption font-semibold text-brand-accent flex-shrink-0">
                    This is mine
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {showEmpty && (
        <p className="text-body-sm text-ink-secondary bg-surface border border-border-subtle rounded-xl px-4 py-3">
          No published clinic matches &ldquo;{query.trim()}&rdquo;. Try a shorter search, or the name as it
          appears on Google.
        </p>
      )}

      {onNoMatch && (
        <button
          type="button"
          onClick={onNoMatch}
          className="text-body-sm text-brand-accent hover:underline"
        >
          {noMatchLabel}
        </button>
      )}
    </div>
  )
}

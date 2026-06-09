'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Compact treatment + location search used in the desktop header (inner pages)
 * and on the /search page itself to refine. Submits to /search.
 */
export function HeaderSearchBar({
  defaultTreatment = '',
  defaultLocation = '',
  className = '',
  autoFocus = false,
}: {
  defaultTreatment?: string
  defaultLocation?: string
  className?: string
  autoFocus?: boolean
}) {
  const [treatment, setTreatment] = useState(defaultTreatment)
  const [location, setLocation] = useState(defaultLocation)
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (treatment.trim()) params.set('treatment', treatment.trim())
    if (location.trim()) params.set('location', location.trim())
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      className={`flex items-stretch bg-surface-canvas border border-border rounded-pill shadow-sm focus-within:border-brand-accent transition overflow-hidden ${className}`}
    >
      {/* Treatment */}
      <div className="flex items-center gap-2 pl-4 pr-3 flex-1 min-w-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
          placeholder="Treatment"
          aria-label="Treatment"
          autoFocus={autoFocus}
          className="w-full py-2 outline-none text-body-sm bg-transparent text-ink-primary placeholder:text-ink-tertiary"
        />
      </div>

      <div className="w-px bg-border my-2 flex-shrink-0" />

      {/* Location */}
      <div className="flex items-center gap-2 px-3 flex-1 min-w-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City or state"
          aria-label="Location"
          className="w-full py-2 outline-none text-body-sm bg-transparent text-ink-primary placeholder:text-ink-tertiary"
        />
      </div>

      <button
        type="submit"
        aria-label="Search"
        className="flex items-center gap-1.5 bg-brand-primary text-surface-canvas px-4 my-1 mr-1 rounded-pill text-body-sm font-semibold hover:opacity-90 transition flex-shrink-0"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span className="hidden lg:inline">Search</span>
      </button>
    </form>
  )
}

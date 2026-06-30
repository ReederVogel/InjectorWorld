'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchSuggest, searchHref, type Suggestion } from '@/lib/search-client'

const TYPE_LABEL: Record<Suggestion['type'], string> = {
  treatment: 'Service',
  brand: 'Brand',
  location: 'Location',
  provider: 'Injector',
  clinic: 'Clinic',
  zip: 'ZIP',
}

/**
 * Single-field omnibox used in the desktop header (inner pages) and on the
 * /search page to refine. Type anything (treatment / city / ZIP / name);
 * autocomplete suggests entities; submit goes to /search.
 */
export function HeaderSearchBar({
  defaultQuery = '',
  className = '',
  autoFocus = false,
}: {
  defaultQuery?: string
  className?: string
  autoFocus?: boolean
}) {
  const [query, setQuery] = useState(defaultQuery)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      setSuggestions(await fetchSuggest(term, ctrl.signal))
      setFocusIdx(-1)
    }, 180)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [query])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setOpen(false)
    router.push(searchHref(query))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      setOpen(false)
      router.push(suggestions[focusIdx].href)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form
        onSubmit={submit}
        role="search"
        className="flex items-stretch bg-surface-canvas border border-border rounded-pill shadow-sm focus-within:border-brand-accent transition overflow-hidden"
      >
        <div className="flex items-center gap-2 pl-4 pr-3 flex-1 min-w-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search a service, city, ZIP, injector, or clinic"
            aria-label="Search"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls="header-suggest-list"
            role="combobox"
            autoFocus={autoFocus}
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

      {open && suggestions.length > 0 && (
        <ul
          id="header-suggest-list"
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 bg-surface-canvas border border-border rounded-lg shadow-lg z-40 py-2 max-h-[340px] overflow-y-auto"
        >
          {suggestions.map((s, i) => (
            <li key={`${s.type}-${s.href}-${i}`} role="option" aria-selected={i === focusIdx}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false)
                  router.push(s.href)
                }}
                className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                  i === focusIdx ? 'bg-brand-accent-soft' : 'hover:bg-surface'
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-body-sm text-ink-primary truncate">{s.label}</span>
                  {s.sublabel && <span className="block text-caption text-ink-tertiary truncate">{s.sublabel}</span>}
                </span>
                <span className="text-caption text-ink-tertiary flex-shrink-0">{TYPE_LABEL[s.type]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

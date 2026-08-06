'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type LocationPickerState = { code: string; name: string; slug: string }
export type LocationPickerCity = { name: string; slug: string; stateCode: string; stateSlug: string; count: number }

type Props = {
  states: LocationPickerState[]
  allCities: LocationPickerCity[]
  /** URL prefix the picker navigates under, e.g. "/services/botox" or
   * "/brands/juvederm". Kept as a plain string (not a function) because this
   * is a client component and server pages cannot pass functions across the
   * RSC boundary. Final URL: `${basePath}/${city.stateSlug}/${city.slug}`. */
  basePath: string
}

/**
 * Compact state -> city finder that sits inside the brand and service pillar
 * heroes.
 *
 * Rebuilt 2026-08-07 (client request). It used to be a full-width panel: 50
 * state pill buttons followed by a city search box, which ate most of a screen.
 * Now it is two dropdowns.
 *
 * The menu items are real <Link>s, not <option>s or buttons. The old version
 * navigated with router.push() from a <button>, so the whole picker was
 * invisible to crawlers; the only crawlable city links on those pages came from
 * the "Popular:" row, which was removed at the same time. Rendering links keeps
 * the pillar -> state -> city crawl path alive.
 */
export function LocationPicker({ states, allCities, basePath }: Props) {
  const [openMenu, setOpenMenu] = useState<'state' | 'city' | null>(null)
  const [selectedState, setSelectedState] = useState<LocationPickerState | null>(null)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const citiesInState = selectedState
    ? allCities.filter((c) => c.stateCode === selectedState.code)
    : []
  const filteredCities = query
    ? citiesInState.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : citiesInState

  useEffect(() => {
    if (!openMenu) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [openMenu])

  const triggerCls =
    'flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-canvas px-4 py-2.5 text-body-sm text-ink-primary transition hover:border-brand-accent disabled:cursor-not-allowed disabled:opacity-50'
  const menuCls =
    'absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-control border border-border bg-surface-canvas py-1 shadow-lg'
  const itemCls =
    'flex items-center justify-between gap-3 px-4 py-2 text-body-sm text-ink-secondary transition hover:bg-surface hover:text-brand-accent'

  return (
    <div ref={containerRef} className="mt-6 grid gap-3 sm:max-w-xl sm:grid-cols-2">
      {/* State */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenMenu((m) => (m === 'state' ? null : 'state'))}
          aria-expanded={openMenu === 'state'}
          className={triggerCls}
        >
          <span className={selectedState ? '' : 'text-ink-tertiary'}>
            {selectedState ? selectedState.name : 'Select a state'}
          </span>
          <Chevron open={openMenu === 'state'} />
        </button>

        {openMenu === 'state' && (
          <div className={menuCls}>
            {states.map((state) => (
              <Link
                key={state.code}
                href={`${basePath}/${state.slug}`}
                onClick={(e) => {
                  // Picking a state filters the city menu rather than
                  // navigating. The href stays real so crawlers still follow it.
                  e.preventDefault()
                  setSelectedState(state)
                  setQuery('')
                  setOpenMenu('city')
                }}
                className={itemCls}
              >
                {state.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* City */}
      <div className="relative">
        <button
          type="button"
          disabled={!selectedState}
          onClick={() => setOpenMenu((m) => (m === 'city' ? null : 'city'))}
          aria-expanded={openMenu === 'city'}
          className={triggerCls}
        >
          <span className="text-ink-tertiary">
            {selectedState ? 'Select a city' : 'Pick a state first'}
          </span>
          <Chevron open={openMenu === 'city'} />
        </button>

        {openMenu === 'city' && selectedState && (
          <div className={menuCls}>
            <div className="px-3 pb-1.5 pt-1">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search cities in ${selectedState.name}`}
                className="w-full rounded-control border border-border bg-surface-canvas px-3 py-2 text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-accent focus:outline-none"
              />
            </div>
            {filteredCities.length === 0 ? (
              <p className="px-4 py-2 text-body-sm text-ink-tertiary">No cities match.</p>
            ) : (
              filteredCities.map((city) => (
                <Link
                  key={`${city.stateSlug}-${city.slug}`}
                  href={`${basePath}/${city.stateSlug}/${city.slug}`}
                  onClick={() => setOpenMenu(null)}
                  className={itemCls}
                >
                  <span>{city.name}</span>
                  {city.count > 0 && <span className="text-ink-tertiary">{city.count}</span>}
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

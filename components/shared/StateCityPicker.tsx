'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { StateEntry, CityEntry } from '@/lib/location-queries'

type Props = {
  treatmentSlug: string
  treatmentName: string
  states: StateEntry[]
  allCities: CityEntry[]
}

export function StateCityPicker({ treatmentSlug, treatmentName, states, allCities }: Props) {
  const router = useRouter()
  const [selectedState, setSelectedState] = useState<StateEntry | null>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const citiesInState = selectedState
    ? allCities.filter(c => c.stateCode === selectedState.code)
    : []

  const filteredCities = query
    ? citiesInState.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : citiesInState

  function handleStateSelect(state: StateEntry) {
    if (selectedState?.code === state.code) {
      setSelectedState(null)
      setQuery('')
      setIsOpen(false)
    } else {
      setSelectedState(state)
      setQuery('')
      setIsOpen(true)
      setActiveIndex(-1)
      setTimeout(() => inputRef.current?.focus(), 60)
    }
  }

  function handleCitySelect(city: CityEntry) {
    setIsOpen(false)
    router.push(`/services/${treatmentSlug}/${city.stateSlug}/${city.slug}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filteredCities.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0 && filteredCities[activeIndex]) {
      handleCitySelect(filteredCities[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[activeIndex] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  return (
    <div className="rounded-2xl border border-border bg-surface-warm p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-serif text-h2 text-ink-primary leading-tight">
          Find a {treatmentName} provider near you
        </h2>
        <p className="text-body text-ink-secondary mt-1.5">
          Select a state, then search for your city.
        </p>
      </div>

      {/* Step 1 — State pills */}
      <div className="mb-6">
        <span className="text-caption text-ink-tertiary font-semibold uppercase tracking-wider block mb-3">
          {selectedState ? `State: ${selectedState.name}` : 'Step 1 — Pick a state'}
        </span>
        <div className="flex flex-wrap gap-2">
          {states.map(state => {
            const active = selectedState?.code === state.code
            return (
              <button
                key={state.code}
                onClick={() => handleStateSelect(state)}
                className={[
                  'px-3.5 py-1.5 rounded-pill text-body-sm font-medium transition-all border',
                  active
                    ? 'bg-brand-primary text-surface-canvas border-brand-primary shadow-sm'
                    : 'bg-surface-canvas text-ink-secondary border-border hover:border-brand-accent hover:text-brand-accent',
                ].join(' ')}
              >
                {state.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2 — City combobox (slides in after state picked) */}
      {selectedState && (
        <div ref={containerRef} className="relative max-w-sm">
          <span className="text-caption text-ink-tertiary font-semibold uppercase tracking-wider block mb-3">
            Step 2 — Choose a city
          </span>

          {/* Input */}
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-tertiary pointer-events-none"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setIsOpen(true); setActiveIndex(-1) }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={`Search cities in ${selectedState.name}...`}
              autoComplete="off"
              role="combobox"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              className="w-full pl-10 pr-8 py-3 rounded-sm border border-border bg-surface-canvas text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Dropdown */}
          {isOpen && (
            <div
              ref={dropdownRef}
              role="listbox"
              className="absolute top-full left-0 right-0 mt-1.5 bg-surface-canvas border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-56 overflow-y-auto"
            >
              {filteredCities.length > 0 ? (
                filteredCities.map((city, i) => (
                  <button
                    key={city.slug}
                    role="option"
                    aria-selected={activeIndex === i}
                    onMouseDown={e => { e.preventDefault(); handleCitySelect(city) }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={[
                      'w-full flex items-center justify-between px-4 py-3 text-left border-b border-border-subtle last:border-0 transition',
                      activeIndex === i ? 'bg-brand-accent-soft' : 'hover:bg-surface',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2.5">
                      <svg className="w-3.5 h-3.5 text-ink-tertiary shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span className="text-body-sm text-ink-primary font-medium">{city.name}</span>
                    </div>
                    {city.providerCount > 0 && (
                      <span className="text-caption text-ink-tertiary ml-2 shrink-0">
                        {city.providerCount}+ providers
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-5 text-center">
                  <p className="text-body-sm text-ink-tertiary">
                    {query
                      ? `No cities matching "${query}" in ${selectedState.name}`
                      : `No cities in ${selectedState.name} yet`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

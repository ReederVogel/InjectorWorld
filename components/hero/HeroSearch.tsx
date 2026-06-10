'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type {
  HeroLocation,
  HeroProviderCard,
  HeroTreatment,
} from '@/lib/hero-queries'
import { ProviderResultCard } from './ProviderResultCard'
import { ClinicResultCard, type HeroClinicCard } from './ClinicResultCard'

const HeroMap = dynamic(() => import('./HeroMap').then((m) => m.HeroMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] md:h-[520px] rounded-2xl bg-surface animate-pulse" />
  ),
})

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]
const POPULAR_TREATMENTS = ['Botox', 'Lip Filler', 'Masseter Botox', 'Tear Trough Filler']

export function HeroSearch({
  treatments,
  locations,
  providers,
}: {
  treatments: HeroTreatment[]
  locations: HeroLocation[]
  providers: HeroProviderCard[]
}) {
  const [treatmentInput, setTreatmentInput] = useState('Botox')
  const [locationInput, setLocationInput] = useState('New York, NY')
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false)
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [panelTab, setPanelTab] = useState<'providers' | 'clinics'>('providers')
  const [treatmentFocusIdx, setTreatmentFocusIdx] = useState(-1)
  const [locationFocusIdx, setLocationFocusIdx] = useState(-1)
  const [geoLoading, setGeoLoading] = useState(false)
  const [countPulse, setCountPulse] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(0)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (!wrapperRef.current.contains(e.target as Node)) {
        setTreatmentDropdownOpen(false)
        setLocationDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const treatmentMatches = useMemo(() => {
    const q = treatmentInput.trim().toLowerCase()
    if (!q) return treatments.slice(0, 8)
    return treatments.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8)
  }, [treatmentInput, treatments])

  const locationMatches = useMemo(() => {
    const q = locationInput.trim().toLowerCase()
    if (!q) return locations.filter((l) => l.kind === 'metro').slice(0, 10)
    return locations
      .filter((l) => l.name.toLowerCase().includes(q) || (l.state ?? '').toLowerCase() === q)
      .slice(0, 10)
  }, [locationInput, locations])

  const filtered = useMemo(() => {
    const treatmentQ = treatmentInput.trim().toLowerCase()
    const locationQ = locationInput.trim().toLowerCase()
    return providers
      .filter((p) => !treatmentQ || p.treatments.some((t) => t.toLowerCase().includes(treatmentQ)))
      .filter((p) => {
        if (!locationQ) return true
        const haystack = [p.clinic.city, p.clinic.state, p.clinic.neighborhood ?? ''].join(' ').toLowerCase()
        const tokens = locationQ.split(/[\s,]+/).filter(Boolean)
        return tokens.every((tok) => haystack.includes(tok))
      })
  }, [providers, treatmentInput, locationInput])

  useEffect(() => {
    if (!panelOpen) { prevCountRef.current = filtered.length; return }
    if (filtered.length !== prevCountRef.current) {
      setCountPulse(true)
      prevCountRef.current = filtered.length
      const id = setTimeout(() => setCountPulse(false), 350)
      return () => clearTimeout(id)
    }
  }, [filtered.length, panelOpen])

  // Clinics shown in the Hero are derived from the matched providers (grouped by
  // clinic), so they are always treatment-correct without an extra query.
  const filteredClinics = useMemo<HeroClinicCard[]>(() => {
    const map = new Map<string, HeroClinicCard>()
    for (const p of filtered) {
      const c = p.clinic
      if (!c.id) continue
      const ex = map.get(c.id)
      if (ex) {
        ex.providerCount++
      } else {
        map.set(c.id, {
          id: c.id,
          name: c.name,
          slug: c.slug,
          neighborhood: c.neighborhood,
          city: c.city,
          state: c.state,
          aggregateRating: c.aggregateRating,
          aggregateRatingCount: c.aggregateRatingCount,
          providerCount: 1,
        })
      }
    }
    return [...map.values()].sort(
      (a, b) =>
        b.providerCount - a.providerCount ||
        (b.aggregateRating ?? 0) - (a.aggregateRating ?? 0),
    )
  }, [filtered])

  // When the active tab has no items (e.g. clinics empty), fall back to providers.
  const effectiveTab = panelTab === 'clinics' && filteredClinics.length === 0 ? 'providers' : panelTab

  const visible = showAll ? filtered : filtered.slice(0, 6)
  const visibleClinics = showAll ? filteredClinics : filteredClinics.slice(0, 6)

  const mapCenter: [number, number] = useMemo(() => {
    if (filtered.length === 0) return DEFAULT_CENTER
    const avgLat = filtered.reduce((s, p) => s + p.clinic.latitude, 0) / filtered.length
    const avgLng = filtered.reduce((s, p) => s + p.clinic.longitude, 0) / filtered.length
    return [avgLat, avgLng]
  }, [filtered])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPanelOpen(true)
    setTreatmentDropdownOpen(false)
    setLocationDropdownOpen(false)
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function pickTreatment(name: string) {
    setTreatmentInput(name)
    setTreatmentDropdownOpen(false)
    setTreatmentFocusIdx(-1)
  }

  function pickLocation(loc: HeroLocation) {
    setLocationInput(loc.state ? `${loc.name}, ${loc.state}` : loc.name)
    setLocationDropdownOpen(false)
    setLocationFocusIdx(-1)
  }

  const handleNearMe = useCallback(async () => {
    if (!navigator.geolocation) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=10`,
            { headers: { 'Accept-Language': 'en-US' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.county || ''
          const state = data.address?.state || ''
          if (city) setLocationInput(state ? `${city}, ${state}` : city)
        } catch {
          // fail silently — location input stays unchanged
        } finally {
          setGeoLoading(false)
        }
      },
      () => setGeoLoading(false)
    )
  }, [])

  function handleTreatmentKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!treatmentDropdownOpen || treatmentMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTreatmentFocusIdx((i) => Math.min(i + 1, treatmentMatches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTreatmentFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && treatmentFocusIdx >= 0) {
      e.preventDefault()
      pickTreatment(treatmentMatches[treatmentFocusIdx].name)
    } else if (e.key === 'Escape') {
      setTreatmentDropdownOpen(false)
      setTreatmentFocusIdx(-1)
    }
  }

  function handleLocationKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!locationDropdownOpen || locationMatches.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setLocationFocusIdx((i) => Math.min(i + 1, locationMatches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setLocationFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && locationFocusIdx >= 0) {
      e.preventDefault()
      pickLocation(locationMatches[locationFocusIdx])
    } else if (e.key === 'Escape') {
      setLocationDropdownOpen(false)
      setLocationFocusIdx(-1)
    }
  }

  return (
    <div className="max-w-[840px] mx-auto" ref={wrapperRef}>
      {/* SEARCH BAR — mobile: stacked card + separate button | desktop: single pill */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col md:flex-row gap-3 md:gap-0 md:items-stretch md:bg-surface-canvas md:rounded-pill md:shadow-[0_4px_24px_rgba(11,27,52,0.10)] md:border md:border-border md:p-2 relative"
      >
        {/* Fields wrapper — mobile is one rounded card, desktop dissolves into pill */}
        <div className="flex flex-col md:flex-row md:flex-1 md:items-stretch bg-surface-canvas md:bg-transparent rounded-2xl md:rounded-none border md:border-0 border-border shadow-[0_6px_20px_rgba(11,27,52,0.08)] md:shadow-none overflow-hidden">

          {/* Treatment */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-3 px-5 py-4 md:py-3 border-b md:border-b-0 md:border-r border-border-subtle">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-secondary flex-shrink-0">
                <circle cx="12" cy="12" r="9" />
              </svg>
              <input
                type="text"
                value={treatmentInput}
                onChange={(e) => { setTreatmentInput(e.target.value); setTreatmentDropdownOpen(true); setTreatmentFocusIdx(-1) }}
                onFocus={() => setTreatmentDropdownOpen(true)}
                onKeyDown={handleTreatmentKeyDown}
                placeholder="Treatment, e.g. Botox"
                className="flex-1 outline-none text-body bg-transparent text-ink-primary placeholder:text-ink-tertiary min-w-0"
                aria-label="Treatment"
                aria-expanded={treatmentDropdownOpen}
                aria-autocomplete="list"
                role="combobox"
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>

            {treatmentDropdownOpen && treatmentMatches.length > 0 && (
              <ul role="listbox" className="absolute left-0 right-0 md:right-auto md:min-w-[320px] mt-2 bg-surface-canvas border border-border rounded-lg shadow-lg z-30 py-2 max-h-[280px] overflow-y-auto">
                {treatmentMatches.map((t, i) => (
                  <li key={t.id} role="option" aria-selected={i === treatmentFocusIdx}>
                    <button
                      type="button"
                      onClick={() => pickTreatment(t.name)}
                      className={`w-full text-left px-4 py-2 text-body-sm text-ink-primary transition-colors ${
                        i === treatmentFocusIdx ? 'bg-brand-accent-soft' : 'hover:bg-surface'
                      }`}
                    >
                      {t.name}
                      <span className="block text-caption text-ink-tertiary capitalize">{t.category}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Location */}
          <div className="flex-1 relative">
            <div className="flex items-center gap-3 px-5 py-4 md:py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-secondary flex-shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <input
                type="text"
                value={locationInput}
                onChange={(e) => { setLocationInput(e.target.value); setLocationDropdownOpen(true); setLocationFocusIdx(-1) }}
                onFocus={() => setLocationDropdownOpen(true)}
                onKeyDown={handleLocationKeyDown}
                placeholder="City, neighborhood, or ZIP"
                className="flex-1 outline-none text-body bg-transparent text-ink-primary placeholder:text-ink-tertiary min-w-0"
                aria-label="Location"
                aria-expanded={locationDropdownOpen}
                aria-autocomplete="list"
                role="combobox"
              />
              {/* Near me button */}
              <button
                type="button"
                onClick={handleNearMe}
                disabled={geoLoading}
                aria-label="Use my location"
                title="Use my location"
                className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-ink-tertiary hover:text-brand-accent hover:bg-brand-accent-soft transition-colors disabled:opacity-40"
              >
                {geoLoading ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                    <path d="M12 2C6.48 2 2 6.48 2 12" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>

            {locationDropdownOpen && locationMatches.length > 0 && (
              <ul role="listbox" className="absolute left-0 right-0 md:right-auto md:min-w-[320px] mt-2 bg-surface-canvas border border-border rounded-lg shadow-lg z-30 py-2 max-h-[280px] overflow-y-auto">
                {locationMatches.map((l, i) => (
                  <li key={l.id} role="option" aria-selected={i === locationFocusIdx}>
                    <button
                      type="button"
                      onClick={() => pickLocation(l)}
                      className={`w-full text-left px-4 py-2 text-body-sm text-ink-primary transition-colors ${
                        i === locationFocusIdx ? 'bg-brand-accent-soft' : 'hover:bg-surface'
                      }`}
                    >
                      {l.name}
                      {l.state && <span className="text-ink-tertiary">, {l.state}</span>}
                      <span className="block text-caption text-ink-tertiary capitalize">{l.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Search button — full-width mobile pill, attached desktop */}
        <button
          type="submit"
          className="w-full md:w-auto bg-brand-primary text-surface-canvas rounded-pill px-8 py-4 md:py-3.5 text-body font-semibold hover:opacity-90 active:scale-[0.99] transition flex-shrink-0 shadow-[0_8px_20px_rgba(11,27,52,0.18)] md:shadow-none inline-flex items-center justify-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="md:hidden">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Search
        </button>
      </form>

      {/* Popular chips */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-5 text-body-sm">
        <span className="text-ink-tertiary mr-1">Popular:</span>
        {POPULAR_TREATMENTS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTreatmentInput(t)
              setPanelOpen(true)
              setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            className="px-3 py-1.5 rounded-pill border border-border bg-surface-canvas text-ink-primary hover:bg-surface hover:border-brand-accent transition"
          >
            {t}
          </button>
        ))}
      </div>

      {/* Friction reducer */}
      <p className="text-center text-caption text-ink-tertiary mt-3.5">
        12,400+ verified injectors. Free for patients. No sign-up required.
      </p>

      {/* LIVE RESULTS PANEL */}
      <div
        ref={panelRef}
        className="grid transition-[grid-template-rows] duration-500 ease-out"
        style={{ gridTemplateRows: panelOpen ? '1fr' : '0fr' }}
        aria-hidden={!panelOpen}
      >
        <div className="overflow-hidden">
          <div className={`mt-8 bg-surface-canvas border border-border rounded-2xl shadow-lg transition-[opacity,transform] duration-500 ease-out ${
            panelOpen
              ? 'opacity-100 translate-y-0 scale-100'
              : 'opacity-0 translate-y-4 scale-[0.98]'
          }`}>

            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 px-5 md:px-6 py-4 border-b border-border-subtle flex-wrap">
              <div className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent" />
                </span>
                <span
                  className={`font-semibold text-ink-primary inline-block transition-transform duration-200 ${
                    countPulse ? 'scale-110' : 'scale-100'
                  }`}
                >
                  {filtered.length}
                </span>
                {' verified injector'}{filtered.length === 1 ? '' : 's'}
                {treatmentInput ? <> for <span className="text-ink-primary font-medium">{treatmentInput}</span></> : null}
                {locationInput ? <> near <span className="text-ink-primary font-medium">{locationInput}</span></> : null}
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={`/${treatmentInput.toLowerCase().replace(/\s+/g, '-')}/${locationInput.toLowerCase().replace(/[, ]+/g, '-')}`}
                  className="text-body-sm font-semibold text-brand-accent hover:underline inline-flex items-center gap-1"
                >
                  View full directory
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close results"
                  className="w-8 h-8 rounded-pill flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-surface transition"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 md:p-6 pb-3 md:pb-4">
              <HeroMap
                providers={filtered}
                center={mapCenter}
                activeProviderId={activeId}
                onPinClick={(id) => setActiveId(id)}
                visible={panelOpen}
              />
            </div>

            <div className="px-4 md:px-6 pb-6">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-ink-secondary">
                  <div className="text-body mb-1">No verified injectors match.</div>
                  <div className="text-caption text-ink-tertiary">Try a different treatment or city.</div>
                </div>
              ) : (
                <>
                  {/* Providers | Clinics toggle (Clinics only when present) */}
                  {filteredClinics.length > 0 && (
                    <div
                      className="inline-flex gap-1 mb-4 p-1 bg-surface rounded-pill border border-border"
                      role="tablist"
                      aria-label="Result type"
                    >
                      {([
                        ['providers', `Injectors`, filtered.length] as const,
                        ['clinics', `Clinics`, filteredClinics.length] as const,
                      ]).map(([key, label, count]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={effectiveTab === key}
                          onClick={() => { setPanelTab(key); setShowAll(false) }}
                          className={`px-4 py-1.5 rounded-pill text-body-sm font-medium transition ${
                            effectiveTab === key
                              ? 'bg-brand-primary text-surface-canvas'
                              : 'text-ink-secondary hover:text-ink-primary'
                          }`}
                        >
                          {label}
                          <span className={`ml-1.5 ${effectiveTab === key ? 'text-surface-canvas/70' : 'text-ink-tertiary'}`}>
                            {count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {effectiveTab === 'providers' ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4">
                        {visible.map((p, i) => (
                          <ProviderResultCard
                            key={p.id}
                            provider={p}
                            index={i}
                            active={activeId === p.id}
                            onMouseEnter={() => setActiveId(p.id)}
                            onMouseLeave={() => setActiveId(null)}
                            onFocus={() => setActiveId(p.id)}
                          />
                        ))}
                      </div>
                      {filtered.length > 6 && (
                        <div className="text-center mt-5">
                          <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="text-body-sm font-medium text-brand-accent hover:underline"
                          >
                            {showAll ? `Show top 6` : `Show all ${filtered.length} injectors`}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4">
                        {visibleClinics.map((c) => (
                          <ClinicResultCard key={c.id} clinic={c} />
                        ))}
                      </div>
                      {filteredClinics.length > 6 && (
                        <div className="text-center mt-5">
                          <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="text-body-sm font-medium text-brand-accent hover:underline"
                          >
                            {showAll ? `Show top 6` : `Show all ${filteredClinics.length} clinics`}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

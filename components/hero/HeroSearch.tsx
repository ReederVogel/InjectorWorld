'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { HeroProviderCard } from '@/lib/hero-queries'
import { ProviderResultCard } from './ProviderResultCard'
import { ClinicResultCard, type HeroClinicCard } from './ClinicResultCard'
import {
  fetchSuggest,
  fetchSearchResults,
  searchHref,
  type Suggestion,
} from '@/lib/search-client'

const HeroMap = dynamic(() => import('./HeroMap').then((m) => m.HeroMap), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[380px] md:h-[520px] rounded-2xl bg-surface animate-pulse" />
  ),
})

const DEFAULT_CENTER: [number, number] = [40.7128, -74.006]
const POPULAR = ['Botox', 'Lip Filler', 'Masseter Botox', 'Tear trough', 'Sculptra']

// API result (DirectoryProvider shape) -> the HeroProviderCard the cards + map use.
function toHeroProvider(p: any): HeroProviderCard {
  return {
    id: String(p.id),
    providerId: String(p.id),
    fullName: p.fullName,
    slug: p.slug,
    credentials: p.credentials,
    title: p.title,
    profilePhotoUrl: p.profilePhotoUrl,
    aggregateRating: p.aggregateRating,
    aggregateRatingCount: p.aggregateRatingCount,
    startingPrice: p.startingPrice,
    treatments: Array.isArray(p.treatments) ? p.treatments : [],
    editorsPick: !!p.editorsPick,
    licenseStateCode: p.licenseStateCode ?? '',
    licenseNumber: p.licenseNumber ?? '',
    licenseVerificationUrl: p.licenseVerificationUrl,
    clinic: {
      id: String(p.clinic?.id ?? ''),
      name: p.clinic?.name ?? '',
      slug: p.clinic?.slug ?? '',
      neighborhood: p.clinic?.neighborhood,
      city: p.clinic?.city ?? '',
      state: p.clinic?.state ?? '',
      latitude: Number(p.clinic?.latitude) || 0,
      longitude: Number(p.clinic?.longitude) || 0,
      aggregateRating: p.clinic?.aggregateRating,
      aggregateRatingCount: p.clinic?.aggregateRatingCount,
    },
  }
}

function toHeroClinic(c: any): HeroClinicCard {
  return {
    id: String(c.id),
    name: c.clinicName,
    slug: c.slug,
    neighborhood: c.neighborhood,
    city: c.city,
    state: c.state,
    aggregateRating: c.aggregateRating,
    aggregateRatingCount: c.aggregateRatingCount,
    providerCount: c.providerCount ?? 0,
  }
}

const TYPE_LABEL: Record<Suggestion['type'], string> = {
  treatment: 'Treatment',
  location: 'Location',
  provider: 'Injector',
  clinic: 'Clinic',
}

export function HeroSearch({
  providers,
}: {
  /** Featured providers used to seed the live panel before any search runs. */
  providers: HeroProviderCard[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [panelTab, setPanelTab] = useState<'providers' | 'clinics'>('providers')
  const [countPulse, setCountPulse] = useState(false)

  // Suggestions (autocomplete dropdown)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [focusIdx, setFocusIdx] = useState(-1)

  // Live results (cards + map). Seeded with the featured providers so the panel
  // has content the instant it opens, before any network call.
  const [resultProviders, setResultProviders] = useState<HeroProviderCard[]>(providers)
  const [providerTotal, setProviderTotal] = useState(providers.length)
  const [resultClinics, setResultClinics] = useState<HeroClinicCard[]>([])
  const [clinicTotal, setClinicTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')

  const wrapperRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(providers.length)

  // Close dropdown on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setSuggestOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounced suggest as the user types.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    const ctrl = new AbortController()
    const id = setTimeout(async () => {
      const s = await fetchSuggest(term, ctrl.signal)
      setSuggestions(s)
      setFocusIdx(-1)
    }, 180)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [query])

  // Debounced live results — only once the panel is open (keeps the box snappy
  // and avoids fetching before the user has committed to searching). No geo here:
  // geocoding runs on the full /search page after submit.
  useEffect(() => {
    if (!panelOpen) return
    const term = query.trim()
    const ctrl = new AbortController()
    setLoading(true)
    const id = setTimeout(async () => {
      const res = await fetchSearchResults({ q: term, limit: 30 }, ctrl.signal)
      if (res) {
        setResultProviders(res.providers.map(toHeroProvider))
        setResultClinics(res.clinics.map(toHeroClinic))
        setProviderTotal(res.providerTotal)
        setClinicTotal(res.clinicTotal)
        setSummary(
          [res.treatmentLabel, res.locationLabel].filter(Boolean).join(' in ') || term,
        )
      }
      setLoading(false)
    }, 250)
    return () => {
      clearTimeout(id)
      ctrl.abort()
    }
  }, [query, panelOpen])

  // Pulse the count when it changes.
  useEffect(() => {
    if (!panelOpen) {
      prevCountRef.current = providerTotal
      return
    }
    if (providerTotal !== prevCountRef.current) {
      setCountPulse(true)
      prevCountRef.current = providerTotal
      const id = setTimeout(() => setCountPulse(false), 350)
      return () => clearTimeout(id)
    }
  }, [providerTotal, panelOpen])

  const effectiveTab = panelTab === 'clinics' && resultClinics.length === 0 ? 'providers' : panelTab
  const visibleProviders = showAll ? resultProviders : resultProviders.slice(0, 6)
  const visibleClinics = showAll ? resultClinics : resultClinics.slice(0, 6)

  const mapCenter: [number, number] = useMemo(() => {
    const valid = resultProviders.filter((p) => p.clinic.latitude && p.clinic.longitude)
    if (valid.length === 0) return DEFAULT_CENTER
    const avgLat = valid.reduce((s, p) => s + p.clinic.latitude, 0) / valid.length
    const avgLng = valid.reduce((s, p) => s + p.clinic.longitude, 0) / valid.length
    return [avgLat, avgLng]
  }, [resultProviders])

  const openPanel = useCallback(() => {
    setPanelOpen(true)
    setSuggestOpen(false)
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Go to the full results page (geo + Top results) so a deliberate search is a
    // real, shareable destination.
    if (query.trim()) {
      router.push(searchHref(query))
    } else {
      openPanel()
    }
  }

  function pickSuggestion(s: Suggestion) {
    setSuggestOpen(false)
    router.push(s.href)
  }

  function pickPopular(t: string) {
    setQuery(t)
    setSuggestOpen(false)
    openPanel()
  }

  const handleNearMe = useCallback(async () => {
    if (!navigator.geolocation) return
    setPanelOpen(true)
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetchSearchResults({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          limit: 30,
        })
        if (res) {
          setResultProviders(res.providers.map(toHeroProvider))
          setResultClinics(res.clinics.map(toHeroClinic))
          setProviderTotal(res.providerTotal)
          setClinicTotal(res.clinicTotal)
          setSummary('injectors near you')
        }
        setLoading(false)
        setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
      },
      () => setLoading(false),
    )
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestOpen || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIdx((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && focusIdx >= 0) {
      e.preventDefault()
      pickSuggestion(suggestions[focusIdx])
    } else if (e.key === 'Escape') {
      setSuggestOpen(false)
      setFocusIdx(-1)
    }
  }

  return (
    <div className="max-w-[840px] mx-auto" ref={wrapperRef}>
      {/* OMNIBOX */}
      <form
        onSubmit={handleSubmit}
        role="search"
        className="flex flex-col md:flex-row gap-3 md:gap-0 md:items-stretch md:bg-surface-canvas md:rounded-pill md:shadow-[0_4px_24px_rgba(11,27,52,0.10)] md:border md:border-border md:p-2 relative"
      >
        <div className="relative flex-1 flex items-center gap-3 px-5 py-4 md:py-3 bg-surface-canvas md:bg-transparent rounded-2xl md:rounded-none border md:border-0 border-border shadow-[0_6px_20px_rgba(11,27,52,0.08)] md:shadow-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-secondary flex-shrink-0">
            <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search a treatment, city, ZIP, injector, or clinic"
            className="flex-1 outline-none text-body bg-transparent text-ink-primary placeholder:text-ink-tertiary min-w-0"
            aria-label="Search"
            aria-expanded={suggestOpen}
            aria-autocomplete="list"
            aria-controls="hero-suggest-list"
            role="combobox"
          />
          {/* Near me */}
          <button
            type="button"
            onClick={handleNearMe}
            aria-label="Use my location"
            title="Use my location"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-ink-tertiary hover:text-brand-accent hover:bg-brand-accent-soft transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3" strokeLinecap="round" />
            </svg>
          </button>

          {/* Suggestions dropdown */}
          {suggestOpen && suggestions.length > 0 && (
            <ul
              id="hero-suggest-list"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-2 bg-surface-canvas border border-border rounded-lg shadow-lg z-30 py-2 max-h-[340px] overflow-y-auto"
            >
              {suggestions.map((s, i) => (
                <li key={`${s.type}-${s.href}-${i}`} role="option" aria-selected={i === focusIdx}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    className={`w-full text-left px-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                      i === focusIdx ? 'bg-brand-accent-soft' : 'hover:bg-surface'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-body-sm text-ink-primary truncate">{s.label}</span>
                      {s.sublabel && (
                        <span className="block text-caption text-ink-tertiary truncate">{s.sublabel}</span>
                      )}
                    </span>
                    <span className="text-caption text-ink-tertiary flex-shrink-0">{TYPE_LABEL[s.type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

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
        {POPULAR.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pickPopular(t)}
            className="px-3 py-1.5 rounded-pill border border-border bg-surface-canvas text-ink-primary hover:bg-surface hover:border-brand-accent transition"
          >
            {t}
          </button>
        ))}
      </div>

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
          <div
            className={`mt-8 bg-surface-canvas border border-border rounded-2xl shadow-lg transition-[opacity,transform] duration-500 ease-out ${
              panelOpen ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]'
            }`}
          >
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
                  {providerTotal}
                </span>
                {' verified injector'}{providerTotal === 1 ? '' : 's'}
                {summary ? (
                  <>
                    {' for '}
                    <span className="text-ink-primary font-medium">{summary}</span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={searchHref(query)}
                  className="text-body-sm font-semibold text-brand-accent hover:underline inline-flex items-center gap-1"
                >
                  View full results
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
                providers={resultProviders}
                center={mapCenter}
                activeProviderId={activeId}
                onPinClick={(id) => setActiveId(id)}
                visible={panelOpen}
              />
            </div>

            <div className="px-4 md:px-6 pb-6">
              {resultProviders.length === 0 && resultClinics.length === 0 ? (
                <div className="text-center py-12 text-ink-secondary">
                  <div className="text-body mb-1">
                    {loading ? 'Searching...' : 'No verified injectors match.'}
                  </div>
                  <div className="text-caption text-ink-tertiary">
                    {loading ? 'One moment.' : 'Try a different treatment, city, or name.'}
                  </div>
                </div>
              ) : (
                <>
                  {resultClinics.length > 0 && (
                    <div
                      className="inline-flex gap-1 mb-4 p-1 bg-surface rounded-pill border border-border"
                      role="tablist"
                      aria-label="Result type"
                    >
                      {([
                        ['providers', 'Injectors', providerTotal] as const,
                        ['clinics', 'Clinics', clinicTotal] as const,
                      ]).map(([key, label, count]) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={effectiveTab === key}
                          onClick={() => {
                            setPanelTab(key)
                            setShowAll(false)
                          }}
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
                        {visibleProviders.map((p, i) => (
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
                      {resultProviders.length > 6 && (
                        <div className="text-center mt-5">
                          <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="text-body-sm font-medium text-brand-accent hover:underline"
                          >
                            {showAll ? 'Show top 6' : `Show ${resultProviders.length} injectors`}
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
                      {resultClinics.length > 6 && (
                        <div className="text-center mt-5">
                          <button
                            type="button"
                            onClick={() => setShowAll((v) => !v)}
                            className="text-body-sm font-medium text-brand-accent hover:underline"
                          >
                            {showAll ? 'Show top 6' : `Show ${resultClinics.length} clinics`}
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

'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  DEFAULT_LISTING_FILTERS,
  PRICE_MAX,
  PRICE_MIN,
  getActiveListingFilterCount,
  getListingClinicType,
  getListingLanguages,
  getListingLoyaltyPrograms,
  type ListingFilterValues,
} from './applyListingFilters'

const RADIUS_OPTIONS = [5, 10, 25, 50]
const RATING_OPTIONS = [
  { value: null, label: 'All' },
  { value: 4.5, label: '4.5+' },
  { value: 4, label: '4+' },
  { value: 3.5, label: '3.5+' },
]
const SERVICE_TYPES = ['medspa', 'dermatology', 'plastic-surgery', 'dental-aesthetics', 'other']
const LOYALTY_PROGRAMS = ['alle', 'aspire', 'xperience']
const FILTER_KEYS = ['radius', 'rating', 'virtual', 'priceMin', 'priceMax', 'lang', 'type', 'loyalty', 'lat', 'lng']

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  zh: 'Mandarin',
  yue: 'Cantonese',
  ko: 'Korean',
  pt: 'Portuguese',
  ar: 'Arabic',
  hi: 'Hindi',
  ru: 'Russian',
  English: 'English',
  Spanish: 'Spanish',
  Mandarin: 'Mandarin',
  Korean: 'Korean',
  Hindi: 'Hindi',
  Russian: 'Russian',
  French: 'French',
  Portuguese: 'Portuguese',
  Arabic: 'Arabic',
  Vietnamese: 'Vietnamese',
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  medspa: 'Med Spa',
  dermatology: 'Dermatology',
  'plastic-surgery': 'Plastic Surgery',
  'dental-aesthetics': 'Dental Aesthetics',
  other: 'Other',
}

const LOYALTY_LABELS: Record<string, string> = {
  alle: 'All\u0113',
  aspire: 'Aspire',
  xperience: 'Xperience',
}

function parseNumber(value: string | null): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function parseList(value: string | null): string[] {
  return value ? value.split(',').map((v) => v.trim()).filter(Boolean) : []
}

function parseFilters(params: URLSearchParams, fallbackCoords: { lat: number; lng: number } | null): ListingFilterValues {
  const radius = parseNumber(params.get('radius'))
  const rating = parseNumber(params.get('rating'))
  const priceMin = parseNumber(params.get('priceMin'))
  const priceMax = parseNumber(params.get('priceMax'))
  const lat = parseNumber(params.get('lat')) ?? fallbackCoords?.lat ?? null
  const lng = parseNumber(params.get('lng')) ?? fallbackCoords?.lng ?? null

  return {
    radius: radius && RADIUS_OPTIONS.includes(radius) ? radius : null,
    rating: rating && [3.5, 4, 4.5].includes(rating) ? rating : null,
    virtual: params.get('virtual') === '1',
    priceMin: priceMin ?? PRICE_MIN,
    priceMax: priceMax ?? PRICE_MAX,
    languages: parseList(params.get('lang')),
    serviceTypes: parseList(params.get('type')),
    loyaltyPrograms: parseList(params.get('loyalty')),
    lat,
    lng,
  }
}

function formatCount(count: number): string {
  return count.toLocaleString()
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => {
    const al = LANGUAGE_LABELS[a] ?? SERVICE_TYPE_LABELS[a] ?? LOYALTY_LABELS[a] ?? a
    const bl = LANGUAGE_LABELS[b] ?? SERVICE_TYPE_LABELS[b] ?? LOYALTY_LABELS[b] ?? b
    return al.localeCompare(bl)
  })
}

type ListingFiltersProps<T> = {
  items: T[]
  onChange: (filters: ListingFilterValues) => void
  resultCount: number
  totalCount: number
  mode?: 'providers' | 'clinics' | 'mixed'
  className?: string
}

type FilterPanelProps = {
  draft: ListingFilterValues
  setDraft: (filters: ListingFilterValues) => void
  languageOptions: string[]
  showServiceType: boolean
  showLoyalty: boolean
  hasCoords: boolean
  activeCount: number
  resultCount: number
  totalCount: number
  onApply: () => void
  onClear: () => void
  compact?: boolean
}

export function ListingFilters<T>(props: ListingFiltersProps<T>) {
  return (
    <Suspense
      fallback={
        <ListingFiltersFallback
          className={props.className}
          resultCount={props.resultCount}
          totalCount={props.totalCount}
        />
      }
    >
      <ListingFiltersInner {...props} />
    </Suspense>
  )
}

function ListingFiltersInner<T>({
  items,
  onChange,
  resultCount,
  totalCount,
  mode = 'mixed',
  className,
}: ListingFiltersProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [geoCoords, setGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const filters = useMemo(() => parseFilters(searchParams, geoCoords), [searchParams, geoCoords])
  const [draft, setDraft] = useState<ListingFilterValues>(filters)
  const [sheetOpen, setSheetOpen] = useState(false)

  const languageOptions = useMemo(
    () => uniqueSorted(items.flatMap((item) => getListingLanguages(item))),
    [items],
  )

  const hasClinicTypes = useMemo(
    () => items.some((item) => Boolean(getListingClinicType(item))),
    [items],
  )

  const hasLoyalty = useMemo(
    () => items.some((item) => getListingLoyaltyPrograms(item).length > 0),
    [items],
  )

  const activeCount = getActiveListingFilterCount(filters)
  const draftActiveCount = getActiveListingFilterCount(draft)
  const urlHasCoords = searchParams.has('lat') && searchParams.has('lng')
  const hasCoords = filters.lat != null && filters.lng != null

  useEffect(() => setDraft(filters), [filters])
  useEffect(() => onChange(filters), [filters, onChange])

  useEffect(() => {
    if (urlHasCoords || geoCoords) return
    const controller = new AbortController()
    fetch('/api/geo/ip', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.lat === 'number' && typeof data?.lng === 'number') {
          setGeoCoords({ lat: data.lat, lng: data.lng })
        }
      })
      .catch(() => {})
    return () => controller.abort()
  }, [geoCoords, urlHasCoords])

  useEffect(() => {
    if (!sheetOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [sheetOpen])

  function writeFilters(next: ListingFilterValues) {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((key) => params.delete(key))

    if (next.radius != null) params.set('radius', String(next.radius))
    if (next.rating != null) params.set('rating', String(next.rating))
    if (next.virtual) params.set('virtual', '1')
    if (next.priceMin !== PRICE_MIN) params.set('priceMin', String(next.priceMin))
    if (next.priceMax !== PRICE_MAX) params.set('priceMax', String(next.priceMax))
    if (next.languages.length > 0) params.set('lang', next.languages.join(','))
    if (next.serviceTypes.length > 0) params.set('type', next.serviceTypes.join(','))
    if (next.loyaltyPrograms.length > 0) params.set('loyalty', next.loyaltyPrograms.join(','))

    const shouldWriteCoords = urlHasCoords || next.radius != null
    if (shouldWriteCoords && next.lat != null && next.lng != null) {
      params.set('lat', String(Number(next.lat.toFixed(5))))
      params.set('lng', String(Number(next.lng.toFixed(5))))
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    onChange(next)
    setSheetOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    FILTER_KEYS.forEach((key) => params.delete(key))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    const cleared = { ...DEFAULT_LISTING_FILTERS, lat: geoCoords?.lat ?? null, lng: geoCoords?.lng ?? null }
    setDraft(cleared)
    onChange(cleared)
    setSheetOpen(false)
  }

  const panel = (
      <FilterPanel
        draft={draft}
        setDraft={setDraft}
        languageOptions={languageOptions}
        showServiceType={mode !== 'providers' && (hasClinicTypes || mode === 'clinics')}
        showLoyalty={mode !== 'clinics' && (hasLoyalty || mode === 'providers')}
        hasCoords={hasCoords}
      activeCount={draftActiveCount}
      resultCount={resultCount}
      totalCount={totalCount}
      onApply={() => writeFilters(draft)}
      onClear={clearFilters}
    />
  )

  return (
    <>
      <aside className={`hidden md:block md:w-[280px] md:flex-shrink-0 ${className ?? ''}`}>
        <div className="sticky top-24 rounded-xl border border-border bg-surface-canvas p-4 shadow-sm">
          {panel}
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-4 left-4 right-4 z-40 md:hidden flex items-center justify-center gap-2 rounded-pill bg-brand-primary text-surface-canvas px-5 py-3 text-body-sm font-semibold shadow-lg"
      >
        Filters
        {activeCount > 0 && (
          <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-brand-accent text-white text-[11px]">
            {activeCount}
          </span>
        )}
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Listing filters">
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/45"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-surface-canvas p-5 shadow-lg">
            <FilterPanel
              draft={draft}
              setDraft={setDraft}
              languageOptions={languageOptions}
              showServiceType={mode !== 'providers' && (hasClinicTypes || mode === 'clinics')}
              showLoyalty={mode !== 'clinics' && (hasLoyalty || mode === 'providers')}
              hasCoords={hasCoords}
              activeCount={draftActiveCount}
              resultCount={resultCount}
              totalCount={totalCount}
              onApply={() => writeFilters(draft)}
              onClear={clearFilters}
              compact
            />
          </div>
        </div>
      )}
    </>
  )
}

function ListingFiltersFallback({
  className,
  resultCount,
  totalCount,
}: {
  className?: string
  resultCount: number
  totalCount: number
}) {
  return (
    <>
      <aside className={`hidden md:block md:w-[280px] md:flex-shrink-0 ${className ?? ''}`}>
        <div className="sticky top-24 rounded-xl border border-border bg-surface-canvas p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-h4 text-ink-primary">Filters</h2>
              <p className="text-caption text-ink-tertiary mt-1">
                Showing {formatCount(resultCount)} of {formatCount(totalCount)} results
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-9 rounded-lg bg-surface animate-pulse" />
            <div className="h-20 rounded-lg bg-surface animate-pulse" />
            <div className="h-9 rounded-lg bg-surface animate-pulse" />
          </div>
        </div>
      </aside>
      <button
        type="button"
        disabled
        className="fixed bottom-4 left-4 right-4 z-40 md:hidden flex items-center justify-center gap-2 rounded-pill bg-brand-primary text-surface-canvas px-5 py-3 text-body-sm font-semibold shadow-lg opacity-70"
      >
        Filters
      </button>
    </>
  )
}

function FilterPanel({
  draft,
  setDraft,
  languageOptions,
  showServiceType,
  showLoyalty,
  hasCoords,
  activeCount,
  resultCount,
  totalCount,
  onApply,
  onClear,
  compact = false,
}: FilterPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-h4 text-ink-primary">Filters</h2>
          <p className="text-caption text-ink-tertiary mt-1">
            Showing {formatCount(resultCount)} of {formatCount(totalCount)} results
          </p>
        </div>
        {activeCount > 0 && (
          <span className="rounded-pill bg-brand-accent-soft px-2.5 py-1 text-caption font-semibold text-brand-accent">
            {activeCount}
          </span>
        )}
      </div>

      <Field label="Distance">
        <select
          value={draft.radius ?? ''}
          disabled={!hasCoords}
          onChange={(e) => setDraft({ ...draft, radius: e.target.value ? Number(e.target.value) : null })}
          className="w-full rounded-lg border border-border bg-surface-canvas px-3 py-2 text-body-sm text-ink-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Any distance</option>
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>{radius} mi</option>
          ))}
        </select>
        {!hasCoords && (
          <p className="mt-2 text-caption text-ink-tertiary">
            <Link href="/search" className="text-brand-accent hover:underline">Set your location</Link> to use distance.
          </p>
        )}
      </Field>

      <Field label="Rating">
        <div className="grid grid-cols-2 gap-2">
          {RATING_OPTIONS.map((option) => (
            <label
              key={option.label}
              className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-body-sm transition ${
                draft.rating === option.value
                  ? 'border-brand-primary bg-brand-primary text-surface-canvas'
                  : 'border-border bg-surface-canvas text-ink-secondary hover:border-brand-accent'
              }`}
            >
              <input
                type="radio"
                name="listing-rating"
                value={option.value ?? ''}
                checked={draft.rating === option.value}
                onChange={() => setDraft({ ...draft, rating: option.value })}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
      </Field>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
        <span className="text-body-sm font-medium text-ink-primary">Virtual consult available</span>
        <input
          type="checkbox"
          checked={draft.virtual}
          onChange={(e) => setDraft({ ...draft, virtual: e.target.checked })}
          className="h-4 w-4 accent-brand-accent"
        />
      </label>

      <Field label="Price range">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-caption text-ink-secondary">
            <span>${draft.priceMin}</span>
            <span>${draft.priceMax}</span>
          </div>
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={25}
            value={draft.priceMin}
            onChange={(e) => {
              const next = Math.min(Number(e.target.value), draft.priceMax)
              setDraft({ ...draft, priceMin: next })
            }}
            className="w-full accent-brand-accent"
            aria-label="Minimum price"
          />
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={25}
            value={draft.priceMax}
            onChange={(e) => {
              const next = Math.max(Number(e.target.value), draft.priceMin)
              setDraft({ ...draft, priceMax: next })
            }}
            className="w-full accent-brand-accent"
            aria-label="Maximum price"
          />
        </div>
      </Field>

      <MultiSelect
        label="Languages"
        values={draft.languages}
        options={languageOptions}
        labels={LANGUAGE_LABELS}
        emptyLabel="No language data yet"
        onChange={(languages) => setDraft({ ...draft, languages })}
      />

      {showServiceType && (
        <MultiSelect
          label="Service type"
          values={draft.serviceTypes}
          options={SERVICE_TYPES}
          labels={SERVICE_TYPE_LABELS}
          onChange={(serviceTypes) => setDraft({ ...draft, serviceTypes })}
        />
      )}

      {showLoyalty && (
        <MultiSelect
          label="Loyalty programs"
          values={draft.loyaltyPrograms}
          options={LOYALTY_PROGRAMS}
          labels={LOYALTY_LABELS}
          onChange={(loyaltyPrograms) => setDraft({ ...draft, loyaltyPrograms })}
        />
      )}

      <div className={`${compact ? 'sticky bottom-0 -mx-5 bg-surface-canvas px-5 pb-1 pt-4' : ''} flex gap-2`}>
        <button
          type="button"
          onClick={onClear}
          className="flex-1 rounded-pill border border-border px-4 py-2.5 text-body-sm font-semibold text-ink-secondary hover:border-brand-accent hover:text-ink-primary"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onApply}
          className="flex-1 rounded-pill bg-brand-primary px-4 py-2.5 text-body-sm font-semibold text-surface-canvas hover:opacity-90"
        >
          {compact ? `Show ${formatCount(resultCount)} results` : 'Apply'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-caption font-semibold uppercase tracking-wider text-ink-tertiary">{label}</label>
      {children}
    </div>
  )
}

function MultiSelect({
  label,
  values,
  options,
  labels,
  emptyLabel,
  onChange,
}: {
  label: string
  values: string[]
  options: string[]
  labels: Record<string, string>
  emptyLabel?: string
  onChange: (values: string[]) => void
}) {
  return (
    <Field label={label}>
      <details className="group rounded-lg border border-border bg-surface-canvas">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-body-sm text-ink-primary">
          <span>{values.length ? `${values.length} selected` : `Any ${label.toLowerCase()}`}</span>
          <svg className="h-4 w-4 text-ink-tertiary transition group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>
        <div className="max-h-48 overflow-y-auto border-t border-border p-2">
          {options.length === 0 ? (
            <p className="px-1 py-2 text-caption text-ink-tertiary">{emptyLabel ?? 'No options available'}</p>
          ) : (
            options.map((option) => {
              const checked = values.includes(option)
              return (
                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-body-sm text-ink-secondary hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      onChange(
                        e.target.checked
                          ? [...values, option]
                          : values.filter((value) => value !== option),
                      )
                    }}
                    className="h-4 w-4 accent-brand-accent"
                  />
                  {labels[option] ?? option}
                </label>
              )
            })
          )}
        </div>
      </details>
    </Field>
  )
}

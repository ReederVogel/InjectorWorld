'use client'

import { useEffect, useRef, useState } from 'react'

export type LocationOption = { id: number; clinicName: string; city: string; state: string }

export function DashboardLocations({
  primaryClinic,
  brandName,
  brandSlug,
  initialAdditional,
  brandSiblings,
}: {
  primaryClinic: { name: string; city: string; state: string; slug: string } | null
  brandName?: string
  brandSlug?: string
  initialAdditional: LocationOption[]
  brandSiblings: LocationOption[]
}) {
  const [additional, setAdditional] = useState<LocationOption[]>(initialAdditional)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationOption[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const has = (id: number) => additional.some((a) => a.id === id)

  function add(opt: LocationOption) {
    if (has(opt.id)) return
    setAdditional((prev) => [...prev, opt])
    setSuccess(false)
  }
  function remove(id: number) {
    setAdditional((prev) => prev.filter((a) => a.id !== id))
    setSuccess(false)
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (query.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/dashboard/locations?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' })
        const json = await res.json()
        setResults(json.results ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [query])

  async function save() {
    setSaving(true); setError(''); setSuccess(false)
    try {
      const res = await fetch('/api/dashboard/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ additionalClinicIds: additional.map((a) => a.id) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Could not save locations.'); return }
      setSuccess(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const availableSiblings = brandSiblings.filter((s) => !has(s.id))

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-serif text-h3 text-ink-primary border-b border-border pb-3">Your locations</h2>
        <p className="text-body-sm text-ink-secondary mt-3">
          Your primary location is managed by our team. Add any other locations (branches) where you also practice.
        </p>
      </div>

      {(success || error) && (
        <div className={`px-4 py-3 rounded-xl text-body-sm font-medium ${
          success
            ? 'bg-brand-accent-soft text-brand-accent border border-brand-accent/30'
            : 'bg-[#B91C1C]/5 text-[#B91C1C] border border-[#B91C1C]/20'
        }`}>
          {success ? 'Locations updated.' : error}
        </div>
      )}

      {/* Primary */}
      {primaryClinic && (
        <div className="rounded-xl border border-border-subtle bg-surface p-4">
          <p className="text-caption text-ink-tertiary uppercase tracking-wider font-semibold mb-1">Primary location</p>
          <p className="text-body-sm font-medium text-ink-primary">{primaryClinic.name}</p>
          <p className="text-body-sm text-ink-secondary">{primaryClinic.city}, {primaryClinic.state}</p>
          {brandName && brandSlug && (
            <a href={`/brands/${brandSlug}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-2 text-caption text-brand-accent hover:underline">
              Part of {brandName}
            </a>
          )}
        </div>
      )}

      {/* Current additional locations */}
      <div>
        <p className="text-body-sm font-medium text-ink-primary mb-2">Other locations you practice at</p>
        {additional.length === 0 ? (
          <p className="text-body-sm text-ink-tertiary">None added yet.</p>
        ) : (
          <div className="space-y-2">
            {additional.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-canvas px-4 py-2.5">
                <span className="text-body-sm text-ink-primary">
                  {a.clinicName} <span className="text-ink-tertiary">· {a.city}, {a.state}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  className="text-caption text-[#B91C1C] hover:underline flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Brand siblings quick-add */}
      {availableSiblings.length > 0 && (
        <div>
          <p className="text-body-sm font-medium text-ink-primary mb-2">
            Suggested from {brandName ?? 'your brand'}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableSiblings.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => add(s)}
                className="px-3.5 py-1.5 rounded-pill text-body-sm font-medium border border-border text-ink-secondary hover:border-brand-accent hover:text-ink-primary transition"
              >
                + {s.clinicName} ({s.city})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search-add */}
      <div>
        <label className="block text-body-sm font-medium text-ink-primary mb-1.5">Add a location</label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clinics by name"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
        {searching && <p className="text-caption text-ink-tertiary mt-1">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-2 rounded-lg border border-border bg-surface-canvas divide-y divide-border-subtle overflow-hidden">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { add(r); setQuery(''); setResults([]) }}
                disabled={has(r.id)}
                className="w-full text-left px-4 py-2.5 text-body-sm hover:bg-surface transition disabled:opacity-40 flex items-center justify-between gap-2"
              >
                <span className="text-ink-primary">{r.clinicName} <span className="text-ink-tertiary">· {r.city}, {r.state}</span></span>
                {has(r.id) ? <span className="text-caption text-ink-tertiary">Added</span> : <span className="text-caption text-brand-accent">Add</span>}
              </button>
            ))}
          </div>
        )}
        <p className="text-caption text-ink-tertiary mt-2">
          Practice at a location we do not list yet? Email{' '}
          <a href="mailto:support@injector.world" className="text-brand-accent hover:underline">support@injector.world</a>{' '}
          and we will verify and add it before it appears.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-brand-primary text-surface-canvas rounded-pill px-8 py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save locations'}
        </button>
      </div>
    </section>
  )
}

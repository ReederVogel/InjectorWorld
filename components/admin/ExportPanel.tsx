'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Admin data export: pick a collection, optionally scope it by state / city /
 * brand / service, watch it run, download it, and see past runs.
 *
 * Exports run as background jobs (see lib/exports/run-export.ts) because the
 * clinics file is ~37,000 rows x 31 columns and generating that inside a request
 * has OOM-crashed this app before. So this panel starts a job, then polls it.
 */

type JobStatus = 'queued' | 'running' | 'done' | 'failed' | 'abandoned'

type Job = {
  id: number
  collectionSlug: string
  status: JobStatus
  filterSummary?: string
  totalRows?: number
  processedRows?: number
  fileName?: string
  fileUrl?: string
  fileSizeBytes?: number
  error?: string
  createdAt: string
  finishedAt?: string
}

type Options = {
  states: string[]
  cities: string[]
  brands: { slug: string; name: string }[]
  services: { slug: string; name: string }[]
}

type CollectionOpt = { value: string; label: string; supportsFilters: boolean }

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 12,
  padding: 18,
  marginBottom: 20,
}
const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6, display: 'block', marginBottom: 4 }
const field: React.CSSProperties = { padding: '7px 9px', borderRadius: 8, border: '1px solid var(--theme-elevation-150, #e2e8f0)', background: 'var(--theme-input-bg, #fff)', color: 'inherit', fontSize: 13, minWidth: 150 }
const primaryBtn: React.CSSProperties = { padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0B1B34', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }
const th: React.CSSProperties = { textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6, padding: '8px 10px', borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)' }
const td: React.CSSProperties = { padding: '9px 10px', borderBottom: '1px solid var(--theme-elevation-100, #eef1f5)', fontSize: 13 }

const STATUS_COLOR: Record<JobStatus, string> = {
  queued: '#475569',
  running: '#1E40AF',
  done: '#3FA68A',
  failed: '#B91C1C',
  abandoned: '#C2A14E',
}

function fmtBytes(n?: number) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ExportPanel() {
  const [collections, setCollections] = useState<CollectionOpt[]>([])
  const [options, setOptions] = useState<Options>({ states: [], cities: [], brands: [], services: [] })
  const [jobs, setJobs] = useState<Job[]>([])

  const [collection, setCollection] = useState('clinics')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [brandSlug, setBrandSlug] = useState('')
  const [serviceSlug, setServiceSlug] = useState('')

  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = jobs.find((j) => j.status === 'queued' || j.status === 'running')
  const current = collections.find((c) => c.value === collection)
  const filtersAllowed = current?.supportsFilters ?? false

  const load = useCallback(async (forState?: string) => {
    try {
      const qs = forState ? `?state=${encodeURIComponent(forState)}` : ''
      const res = await fetch(`/api/admin/exports${qs}`, { credentials: 'include' })
      if (!res.ok) {
        setError(`Could not load exports (${res.status}).`)
        return
      }
      const body = await res.json()
      setCollections(body.collections ?? [])
      setOptions(body.options ?? { states: [], cities: [], brands: [], services: [] })
      setJobs(body.jobs ?? [])
    } catch {
      setError('Network error while loading exports.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Reload the city list whenever the state changes, and drop a city that no
  // longer belongs to the selected state.
  useEffect(() => {
    setCity('')
    load(state || undefined)
  }, [state, load])

  // Poll only while something is actually running, so an idle admin page is not
  // hitting the API every 2s forever.
  useEffect(() => {
    if (!active) {
      if (pollRef.current) clearTimeout(pollRef.current)
      return
    }
    pollRef.current = setTimeout(() => load(state || undefined), 2000)
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [active, jobs, load, state])

  async function start() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/exports', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          ...(filtersAllowed ? { state, city, brandSlug, serviceSlug } : {}),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || `Could not start export (${res.status}).`)
        return
      }
      await load(state || undefined)
    } catch {
      setError('Network error while starting the export.')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div style={box}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Data Export</div>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 16, lineHeight: 1.6 }}>
        Exports run in the background so a large file cannot take the site down. Clinics can be
        scoped by state, city, brand or service. Files are admin-only and are cleared when the
        server restarts, so download them soon after they finish.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <span style={label}>Collection</span>
          <select style={field} value={collection} onChange={(e) => setCollection(e.target.value)}>
            {collections.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={label}>State</span>
          <select style={{ ...field, opacity: filtersAllowed ? 1 : 0.45 }} value={state} disabled={!filtersAllowed} onChange={(e) => setState(e.target.value)}>
            <option value="">All states</option>
            {options.states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <span style={label}>City</span>
          <select style={{ ...field, opacity: filtersAllowed && state ? 1 : 0.45 }} value={city} disabled={!filtersAllowed || !state} onChange={(e) => setCity(e.target.value)}>
            <option value="">{state ? 'All cities' : 'Pick a state first'}</option>
            {options.cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span style={label}>Brand</span>
          <select style={{ ...field, opacity: filtersAllowed ? 1 : 0.45 }} value={brandSlug} disabled={!filtersAllowed} onChange={(e) => setBrandSlug(e.target.value)}>
            <option value="">All brands</option>
            {options.brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <span style={label}>Service</span>
          <select style={{ ...field, opacity: filtersAllowed ? 1 : 0.45 }} value={serviceSlug} disabled={!filtersAllowed} onChange={(e) => setServiceSlug(e.target.value)}>
            <option value="">All services</option>
            {options.services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>

        <button type="button" style={{ ...primaryBtn, opacity: starting || !!active ? 0.5 : 1 }} onClick={start} disabled={starting || !!active}>
          {starting ? 'Starting…' : active ? 'Export running…' : 'Start export'}
        </button>
      </div>

      {!filtersAllowed && current && (
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
          {current.label} has no state/city/brand/service to filter on, so the filters are disabled.
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {active && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {active.status === 'queued' ? 'Queued…' : `Exporting ${active.collectionSlug}`}
            {typeof active.totalRows === 'number' && active.totalRows > 0 && (
              <> — {(active.processedRows ?? 0).toLocaleString()} / {active.totalRows.toLocaleString()} rows</>
            )}
          </div>
          <div style={{ height: 8, borderRadius: 8, background: 'var(--theme-elevation-100, #eef1f5)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${active.totalRows ? Math.min(100, Math.round(((active.processedRows ?? 0) / active.totalRows) * 100)) : 5}%`,
                background: '#3FA68A',
                transition: 'width 400ms ease-out',
              }}
            />
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={th}>Collection</th>
              <th style={th}>Scope</th>
              <th style={th}>Rows</th>
              <th style={th}>Status</th>
              <th style={th}>Started</th>
              <th style={th}>File</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr><td style={{ ...td, opacity: 0.6 }} colSpan={6}>No exports yet.</td></tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td style={{ ...td, fontWeight: 600 }}>{j.collectionSlug}</td>
                <td style={{ ...td, opacity: 0.75 }}>{j.filterSummary || 'All records'}</td>
                <td style={td}>{(j.processedRows ?? 0).toLocaleString()}{j.totalRows ? ` / ${j.totalRows.toLocaleString()}` : ''}</td>
                <td style={{ ...td, color: STATUS_COLOR[j.status], fontWeight: 600 }}>
                  {j.status}
                  {j.error && <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{j.error}</div>}
                </td>
                <td style={{ ...td, opacity: 0.75 }}>{new Date(j.createdAt).toLocaleString()}</td>
                <td style={td}>
                  {j.status === 'done' && j.fileUrl ? (
                    <a href={j.fileUrl} style={{ color: '#3FA68A', fontWeight: 600 }}>
                      Download{j.fileSizeBytes ? ` (${fmtBytes(j.fileSizeBytes)})` : ''}
                    </a>
                  ) : (
                    <span style={{ opacity: 0.4 }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

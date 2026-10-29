'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { box, field, fmtBytes, label, primaryBtn, STATUS_COLOR, td, th, type JobStatus } from './ExportPanel'

/**
 * Guides & News Export: every guide and news article as its own PDF, in one
 * zip. Same job flow as Data Export above it: start, watch progress, download.
 * The work runs on the server (lib/exports/run-pdf-export.ts).
 */

type Job = {
  id: number
  status: JobStatus
  filterSummary?: string
  totalRows?: number
  processedRows?: number
  fileUrl?: string
  fileSizeBytes?: number
  error?: string
  createdAt: string
}

type Options = {
  counts: { guides: number; news: number }
  categories: { slug: string; name: string; count: number }[]
  months: { value: string; label: string; count: number }[]
}

export function GuidesNewsExportPanel() {
  const [options, setOptions] = useState<Options | null>(null)
  const [keepDays, setKeepDays] = useState(7)
  const [jobs, setJobs] = useState<Job[]>([])
  const [collection, setCollection] = useState<'both' | 'guides' | 'news'>('both')
  const [category, setCategory] = useState('')
  const [month, setMonth] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const active = jobs.find((j) => j.status === 'queued' || j.status === 'running')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/exports/guides-news', { credentials: 'include' })
      if (!res.ok) {
        setError(`Could not load the Guides & News export (${res.status}).`)
        return
      }
      const body = await res.json()
      setOptions(body.options)
      setKeepDays(body.keepDays ?? 7)
      setJobs(body.jobs ?? [])
    } catch {
      setError('Network error while loading the Guides & News export.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Poll only while a job runs.
  useEffect(() => {
    if (!active) return
    pollRef.current = setTimeout(load, 2000)
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [active, jobs, load])

  function pickCollection(v: 'both' | 'guides' | 'news') {
    setCollection(v)
    setCategory('')
    setMonth('')
  }

  async function start() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/exports/guides-news', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, category, month }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(body.error || `Could not start the export (${res.status}).`)
        return
      }
      await load()
    } catch {
      setError('Network error while starting the export.')
    } finally {
      setStarting(false)
    }
  }

  const c = options?.counts
  const pickedCount =
    collection === 'guides'
      ? (category ? options?.categories.find((x) => x.slug === category)?.count : c?.guides)
      : collection === 'news'
        ? (month ? options?.months.find((x) => x.value === month)?.count : c?.news)
        : c && c.guides + c.news

  return (
    <div style={box}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Guides &amp; News Export</div>
      <div style={{ fontSize: 12, opacity: 0.65, marginBottom: 16, lineHeight: 1.6 }}>
        Every published guide and news article as its own PDF, all in one zip: title, intro, contents,
        the full article, FAQs and sources. No images or dates. Runs in the background; the file is
        admin-only and is deleted after {keepDays} days.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
        <div>
          <span style={label}>Collection</span>
          <select style={field} value={collection} onChange={(e) => pickCollection(e.target.value as typeof collection)}>
            <option value="both">Guides and News{c ? ` (${c.guides + c.news})` : ''}</option>
            <option value="guides">Guides{c ? ` (${c.guides})` : ''}</option>
            <option value="news">News{c ? ` (${c.news})` : ''}</option>
          </select>
        </div>

        <div>
          <span style={label}>Guide category</span>
          <select
            style={{ ...field, opacity: collection === 'guides' ? 1 : 0.45 }}
            value={category}
            disabled={collection !== 'guides'}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">{collection === 'guides' ? 'All categories' : 'Pick Guides first'}</option>
            {options?.categories.map((x) => (
              <option key={x.slug} value={x.slug}>{`${x.name} (${x.count})`}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={label}>News month</span>
          <select
            style={{ ...field, opacity: collection === 'news' ? 1 : 0.45 }}
            value={month}
            disabled={collection !== 'news'}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">{collection === 'news' ? 'All months' : 'Pick News first'}</option>
            {options?.months.map((x) => (
              <option key={x.value} value={x.value}>{`${x.label} (${x.count})`}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          style={{ ...primaryBtn, opacity: starting || !!active ? 0.5 : 1 }}
          onClick={start}
          disabled={starting || !!active}
        >
          {starting ? 'Starting…' : active ? 'Export running…' : `Start export${pickedCount ? ` (${pickedCount} PDFs)` : ''}`}
        </button>
      </div>

      {error && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 600, marginBottom: 12 }}>{error}</div>}

      {active && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, marginBottom: 6 }}>
            {active.status === 'queued'
              ? 'Queued…'
              : `Making PDFs: ${(active.processedRows ?? 0).toLocaleString()} / ${(active.totalRows ?? 0).toLocaleString()}`}
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
              <th style={th}>Scope</th>
              <th style={th}>PDFs</th>
              <th style={th}>Status</th>
              <th style={th}>Started</th>
              <th style={th}>File</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td style={{ ...td, opacity: 0.6 }} colSpan={5}>No exports yet.</td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id}>
                <td style={{ ...td, fontWeight: 600 }}>{j.filterSummary || 'Guides and News'}</td>
                <td style={td}>
                  {(j.processedRows ?? 0).toLocaleString()}
                  {j.totalRows ? ` / ${j.totalRows.toLocaleString()}` : ''}
                </td>
                <td style={{ ...td, color: STATUS_COLOR[j.status], fontWeight: 600 }}>
                  {j.status}
                  {j.error && <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 2 }}>{j.error}</div>}
                </td>
                <td style={{ ...td, opacity: 0.75 }}>{new Date(j.createdAt).toLocaleString()}</td>
                <td style={td}>
                  {j.status === 'done' && j.fileUrl ? (
                    <a href={j.fileUrl} style={{ color: '#3FA68A', fontWeight: 600 }}>
                      Download zip{j.fileSizeBytes ? ` (${fmtBytes(j.fileSizeBytes)})` : ''}
                    </a>
                  ) : (
                    <span style={{ opacity: 0.4 }}>-</span>
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

'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/news'

type NewsUploadItem = { id: number; slug: string; title: string; status: 'created' | 'updated' }
type NewsUploadReport = {
  batch: string
  total: number
  created: number
  updated: number
  failed: number
  errors: Array<{ index: number; slug?: string; reason: string }>
  items: NewsUploadItem[]
}

export function NewsListHeader() {
  const { counts, refresh } = useCounts([
    { key: 'total', collection: 'news' },
    { key: 'published', collection: 'news', where: { status: { equals: 'published' } } },
    { key: 'draft', collection: 'news', where: { status: { equals: 'draft' } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip label="Published" count={counts.published} href={`${BASE}?where[status][equals]=published`} tone="success" />
          <StatChip label="Draft" count={counts.draft} href={`${BASE}?where[status][equals]=draft`} />
        </>
      }
      extra={<NewsBulkUpload onAfterChange={refresh} />}
    />
  )
}

function NewsBulkUpload({ onAfterChange }: { onAfterChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [report, setReport] = useState<NewsUploadReport | null>(null)

  async function upload() {
    if (!file) {
      setMsg('Choose a JSON file first.')
      return
    }
    setBusy('upload')
    setMsg('')
    try {
      const text = await file.text()
      let body: any
      try {
        body = JSON.parse(text)
      } catch {
        setMsg('That file is not valid JSON.')
        return
      }
      const res = await fetch('/api/admin/news/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Upload failed.')
        return
      }
      setReport(json.report as NewsUploadReport)
      setMsg('Staged. Review below, then approve when ready.')
      onAfterChange()
    } catch {
      setMsg('Network error during upload.')
    } finally {
      setBusy('')
    }
  }

  async function approve(opts: { batch?: string; id?: number }) {
    setBusy(opts.id ? `approve:${opts.id}` : 'approve-all')
    setMsg('')
    try {
      const res = await fetch('/api/admin/news/bulk-approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts.id ? { id: opts.id } : { batch: opts.batch }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Approve failed.')
        return
      }
      setMsg(`Approved ${json.approved} article${json.approved === 1 ? '' : 's'}.`)
      onAfterChange()
      setReport((prev) => {
        if (!prev) return prev
        if (opts.id) return { ...prev, items: prev.items.filter((it) => it.id !== opts.id) }
        return { ...prev, items: [] }
      })
    } catch {
      setMsg('Network error during approval.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ border: '1px solid #3FA68A40', borderRadius: 8, padding: 14, background: '#3FA68A0d' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 14, color: '#0B1B34' }}>Bulk upload news (JSON)</strong>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <a
            href="/templates/news-template.json"
            download
            style={{ fontSize: 13, color: '#3FA68A', fontWeight: 600, textDecoration: 'none' }}
          >
            Download template
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            style={{ fontSize: 13, background: 'none', border: 'none', color: '#0B1B34', opacity: 0.7, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
          >
            {open ? 'Hide guide' : 'How does this work?'}
          </button>
        </div>
      </div>

      {open && (
        <ol style={{ fontSize: 12.5, opacity: 0.85, margin: '10px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
          <li>Download the template above. It documents every field, what it means, and the allowed values.</li>
          <li>Give the template to whoever is generating the content (for example, hand it to an AI along with your topics).</li>
          <li>Save the result as a .json file and upload it below.</li>
          <li>Each article is staged as a draft, not live yet.</li>
          <li>Check the staged list, then click Approve (all at once, or one at a time) to publish.</li>
        </ol>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ fontSize: 12, maxWidth: '100%' }}
        />
        <button type="button" disabled={!!busy} onClick={upload} style={btn(busy === 'upload', '#3FA68A')}>
          {busy === 'upload' ? 'Uploading…' : 'Upload and stage'}
        </button>
      </div>

      {report && (
        <div style={{ marginTop: 12, fontSize: 12.5 }}>
          <div style={{ fontWeight: 600 }}>Batch {report.batch}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, marginTop: 6, maxWidth: 480 }}>
            <span>Total: <strong>{report.total}</strong></span>
            <span>Created: <strong>{report.created}</strong></span>
            <span>Updated: <strong>{report.updated}</strong></span>
            <span>Failed: <strong>{report.failed}</strong></span>
          </div>

          {report.errors.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>Errors ({report.errors.length})</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                {report.errors.slice(0, 10).map((error, index) => (
                  <li key={`${error.index}-${index}`}>
                    row {error.index + 1}{error.slug ? ` (${error.slug})` : ''}: {error.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {report.items.length > 0 && (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => approve({ batch: report.batch })}
                style={{ ...btn(busy === 'approve-all', '#0B1B34'), marginTop: 10 }}
              >
                {busy === 'approve-all' ? 'Approving…' : `Approve all ${report.items.length} staged`}
              </button>

              <div style={{ marginTop: 10, display: 'grid', gap: 6, maxWidth: 480 }}>
                {report.items.slice(0, 20).map((item) => {
                  const itemBusy = busy === `approve:${item.id}`
                  return (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title} <span style={{ opacity: 0.6 }}>({item.status})</span>
                      </span>
                      <button type="button" disabled={!!busy} onClick={() => approve({ id: item.id })} style={btn(itemBusy, '#3FA68A')}>
                        {itemBusy ? '...' : 'Approve'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {msg && <p style={{ fontSize: 12.5, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

function btn(busy: boolean, bg: string): CSSProperties {
  return {
    padding: '7px 14px',
    borderRadius: 999,
    border: 'none',
    cursor: busy ? 'default' : 'pointer',
    background: bg,
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    opacity: busy ? 0.55 : 1,
  }
}

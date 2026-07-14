'use client'

import { useState } from 'react'
import type { CSSProperties } from 'react'
import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/faqs'

type FaqUploadItem = { id: number; stableId: string; question: string; status: 'created' | 'updated' }
type FaqUploadReport = {
  batch: string
  total: number
  created: number
  updated: number
  failed: number
  errors: Array<{ index: number; stableId?: string; reason: string }>
  items: FaqUploadItem[]
}

async function downloadBlob(url: string, filenameFallback: string) {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j?.error || `Download failed (${res.status}).`)
  }
  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || filenameFallback
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(objectUrl)
}

export function FaqsListHeader() {
  const { counts, refresh } = useCounts([
    { key: 'total', collection: 'faqs' },
    { key: 'approved', collection: 'faqs', where: { reviewStatus: { equals: 'approved' } } },
    { key: 'pending', collection: 'faqs', where: { reviewStatus: { equals: 'imported' } } },
  ])

  return (
    <ListHeader
      chips={
        <>
          <StatChip label="Total" count={counts.total} href={BASE} />
          <StatChip label="Approved" count={counts.approved} href={`${BASE}?where[reviewStatus][equals]=approved`} tone="success" />
          <StatChip
            label="Pending review"
            count={counts.pending}
            href={`${BASE}?where[reviewStatus][equals]=imported`}
            tone={counts.pending ? 'warn' : 'default'}
          />
        </>
      }
      extra={<FaqBulkUpload onAfterChange={refresh} />}
    />
  )
}

function FaqBulkUpload({ onAfterChange }: { onAfterChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [report, setReport] = useState<FaqUploadReport | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  async function downloadTemplate() {
    setBusy('template')
    setMsg('')
    try {
      await downloadBlob('/templates/faqs-template.json', 'faqs-template.json')
      setMsg('Downloaded.')
    } catch (err: any) {
      setMsg(err?.message || 'Download failed.')
    } finally {
      setBusy('')
    }
  }

  async function exportFaqs() {
    setBusy('export')
    setMsg('Exporting...')
    try {
      await downloadBlob('/api/admin/faqs/export', 'faqs-export.json')
      setMsg('Exported.')
    } catch (err: any) {
      setMsg(err?.message || 'Export failed.')
    } finally {
      setBusy('')
    }
  }

  async function upload() {
    if (!file) {
      setMsg('Choose a JSON file first.')
      return
    }
    setBusy('upload')
    setMsg('')
    setProgress(null)
    try {
      const text = await file.text()
      let body: any
      try {
        body = JSON.parse(text)
      } catch {
        setMsg('That file is not valid JSON.')
        return
      }
      const res = await fetch('/api/admin/faqs/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}))
        setMsg(j?.error || 'Upload failed.')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let finalReport: FaqUploadReport | null = null
      let errorMsg = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        let idx: number
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx)
          buf = buf.slice(idx + 1)
          if (!line.trim()) continue
          const evt = JSON.parse(line)
          if (evt.type === 'progress') setProgress({ done: evt.done, total: evt.total })
          else if (evt.type === 'done') finalReport = evt.report
          else if (evt.type === 'error') errorMsg = evt.message
        }
      }

      if (errorMsg) {
        setMsg(errorMsg)
        return
      }
      if (finalReport) {
        setReport(finalReport)
        setMsg('Staged. Review below, then approve when ready.')
        onAfterChange()
      }
    } catch {
      setMsg('Network error during upload.')
    } finally {
      setBusy('')
      setProgress(null)
    }
  }

  async function approve(opts: { batch?: string; id?: number }) {
    setBusy(opts.id ? `approve:${opts.id}` : 'approve-all')
    setMsg('')
    try {
      const res = await fetch('/api/admin/faqs/bulk-approve', {
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
      setMsg(`Approved ${json.approved} FAQ${json.approved === 1 ? '' : 's'}.`)
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

  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null

  return (
    <div style={{ border: '1px solid #3FA68A40', borderRadius: 8, padding: 14, background: '#3FA68A0d' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: 14, color: '#0B1B34' }}>Bulk upload FAQs (JSON)</strong>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <button
            type="button"
            disabled={!!busy}
            onClick={downloadTemplate}
            style={{ fontSize: 13, background: 'none', border: 'none', color: '#3FA68A', fontWeight: 600, cursor: busy ? 'default' : 'pointer', padding: 0, textDecoration: 'none' }}
          >
            {busy === 'template' ? 'Downloading…' : 'Download template'}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={exportFaqs}
            style={{ fontSize: 13, background: 'none', border: 'none', color: '#3FA68A', fontWeight: 600, cursor: busy ? 'default' : 'pointer', padding: 0, textDecoration: 'none' }}
          >
            {busy === 'export' ? 'Exporting…' : 'Export all FAQs'}
          </button>
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
          <li>Each FAQ is staged as "Pending review", not live yet.</li>
          <li>Check the staged list, then click Approve (all at once, or one at a time) to make them live.</li>
          <li>"Export all FAQs" downloads every existing FAQ in the same shape as the template, useful for backup or bulk-editing and re-uploading. Re-uploading an already-approved FAQ resets it to Pending review, since anything that comes through this uploader needs a fresh check.</li>
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

      {busy === 'upload' && (
        <div style={{ marginTop: 10, maxWidth: 320 }}>
          <div style={{ height: 6, borderRadius: 999, background: '#3FA68A22', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 999,
                background: '#3FA68A',
                width: pct != null ? `${pct}%` : '30%',
                transition: 'width 150ms ease',
              }}
            />
          </div>
          <div style={{ fontSize: 11.5, color: '#0B1B34', opacity: 0.7, marginTop: 4 }}>
            {progress ? `${progress.done} of ${progress.total} processed (${pct}%)` : 'Starting…'}
          </div>
        </div>
      )}

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
                    row {error.index + 1}{error.stableId ? ` (${error.stableId})` : ''}: {error.reason}
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
                        {item.question} <span style={{ opacity: 0.6 }}>({item.status})</span>
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

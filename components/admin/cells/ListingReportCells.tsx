'use client'

import { useEffect, useState } from 'react'
import { Badge, type Tone } from './Badge'
import { ListingReportQuickActions } from '../quick-actions/ListingReportQuickActions'
import { LISTING_REPORT_REASONS } from '@/lib/listing-report-reasons'

export const STATUS: Record<string, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'amber' },
  in_review: { label: 'In review', tone: 'blue' },
  fixed: { label: 'Fixed', tone: 'green' },
  dismissed: { label: 'Dismissed', tone: 'grey' },
}

const REASON_TONE: Record<string, Tone> = { closed: 'red', not_injector: 'red', duplicate: 'amber' }
const linkStyle = { fontSize: 12, fontWeight: 600, color: '#2f8d73', textDecoration: 'none', whiteSpace: 'nowrap' } as const

/** Status badge, "Nd waiting" on open reports, and inline Fixed/Dismiss. */
export function ListingReportStatusCell(props: any) {
  const [status, setStatus] = useState<string>(props?.cellData ?? props?.rowData?.status ?? '')
  const id = props?.rowData?.id
  const m = STATUS[status]
  if (!m) return <span>{status || '—'}</span>

  let suffix: string | undefined
  const created = props?.rowData?.createdAt
  if ((status === 'new' || status === 'in_review') && created) {
    const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
    if (days >= 1) suffix = `${days}d waiting`
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Badge label={m.label} tone={m.tone} suffix={suffix} />
      {id != null && <ListingReportQuickActions id={id} status={status} onDone={setStatus} />}
    </span>
  )
}

export function ListingReportReasonCell(props: any) {
  const value: string = props?.cellData ?? ''
  const label = LISTING_REPORT_REASONS.find((r) => r.value === value)?.label
  if (!label) return <span>{value || '—'}</span>
  return <Badge label={label} tone={REASON_TONE[value] ?? 'grey'} />
}

/** First ~80 characters of the visitor's details, full text on hover. */
export function ListingReportDetailsCell(props: any) {
  const text: string = (props?.cellData ?? '').trim()
  if (!text) return <span style={{ opacity: 0.4 }}>—</span>
  return (
    <span title={text} style={{ fontSize: 13, opacity: 0.85 }}>
      {text.length > 80 ? `${text.slice(0, 80)}…` : text}
    </span>
  )
}

// One count request per clinic, shared by every row of that clinic.
// shortcut: cached until a full page reload, fine for a repeat-report hint; clear it if counts must be live.
const reportCounts = new Map<string, Promise<number | null>>()

function countReports(clinicId: string): Promise<number | null> {
  let p = reportCounts.get(clinicId)
  if (!p) {
    p = fetch(`/api/listing-reports/count?where[clinic][equals]=${encodeURIComponent(clinicId)}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (typeof d?.totalDocs === 'number' ? d.totalDocs : null))
      .catch(() => null)
    reportCounts.set(clinicId, p)
  }
  return p
}

/** Live page and admin edit links for the reported clinic, plus a repeat-report tag. */
export function ListingReportClinicCell(props: any) {
  const raw = props?.cellData
  const clinicId = raw && typeof raw === 'object' ? raw.id : raw
  const pageUrl: string | undefined = props?.rowData?.pageUrl || undefined
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    if (clinicId == null) return
    let live = true
    countReports(String(clinicId)).then((n) => {
      if (live) setCount(n)
    })
    return () => {
      live = false
    }
  }, [clinicId])

  if (clinicId == null && !pageUrl) return <span style={{ opacity: 0.4 }}>Clinic deleted</span>

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {pageUrl && (
        <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          Live page ↗
        </a>
      )}
      {clinicId != null && (
        <a href={`/admin/collections/clinics/${clinicId}`} style={linkStyle}>
          Edit clinic
        </a>
      )}
      {count != null && count > 1 && <Badge label={`${count} reports`} tone="red" />}
    </span>
  )
}

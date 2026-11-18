'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { box } from '../ui/styles'
import { Badge } from '../cells/Badge'
import { STATUS } from '../cells/ListingReportCells'
import { LISTING_REPORT_REASONS } from '@/lib/listing-report-reasons'

const CLINIC_FIELDS = ['clinicName', 'addressLine1', 'addressLine2', 'city', 'state', 'zip', 'phone', 'websiteUrl', 'hoursJson', 'status', 'claimed']

type OtherReport = { id: number; reason: string; status: string; createdAt: string }

/**
 * Top of the listing-report edit view: what the clinic says right now, next to
 * the visitor's report below it, so staff can check and fix from one screen.
 */
export function ListingReportPanel() {
  const { id } = useDocumentInfo()
  const clinicField = useFormFields(([fields]) => fields.clinic?.value)
  const pageUrl = useFormFields(([fields]) => fields.pageUrl?.value) as string | undefined
  const reporterEmail = useFormFields(([fields]) => fields.reporterEmail?.value) as string | undefined
  const reporterName = useFormFields(([fields]) => fields.reporterName?.value) as string | undefined
  const clinicId = clinicField && typeof clinicField === 'object' ? (clinicField as any).id : clinicField

  const [clinic, setClinic] = useState<any>(undefined)
  const [others, setOthers] = useState<OtherReport[]>([])

  useEffect(() => {
    if (clinicId == null || clinicId === '') {
      setClinic(null)
      return
    }
    let live = true
    const select = CLINIC_FIELDS.map((f) => `select[${f}]=true`).join('&')
    fetch(`/api/clinics/${clinicId}?depth=0&${select}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setClinic(d))
      .catch(() => live && setClinic(null))
    fetch(
      `/api/listing-reports?where[clinic][equals]=${clinicId}&where[id][not_equals]=${id}&limit=5&depth=0&sort=-createdAt`,
      { credentials: 'include' },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setOthers(d?.docs ?? []))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [clinicId, id])

  if (!id) return null

  const address = clinic
    ? [clinic.addressLine1, clinic.addressLine2, [clinic.city, [clinic.state, clinic.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(', ')
    : ''

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={overline}>Clinic right now</div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{clinic?.clinicName ?? (clinic === null ? 'Clinic not found (deleted?)' : 'Loading…')}</div>
          {clinic && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <Badge label={clinic.status ?? 'unknown'} tone={clinic.status === 'published' ? 'green' : 'grey'} />
              {clinic.claimed && <Badge label="Claimed" tone="blue" />}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {pageUrl && (
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={button}>
              Live page ↗
            </a>
          )}
          {clinicId != null && clinicId !== '' && (
            <a href={`/admin/collections/clinics/${clinicId}`} style={button}>
              Edit clinic
            </a>
          )}
        </div>
      </div>

      {clinic && (
        <dl style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '6px 12px', margin: '16px 0 0', fontSize: 13 }}>
          <Row label="Address">{address || '—'}</Row>
          <Row label="Phone">{clinic.phone || '—'}</Row>
          <Row label="Website">
            {clinic.websiteUrl ? (
              <a href={withProtocol(clinic.websiteUrl)} target="_blank" rel="noopener noreferrer" style={{ color: '#2f8d73', wordBreak: 'break-all' }}>
                {clinic.websiteUrl}
              </a>
            ) : (
              '—'
            )}
          </Row>
          <Row label="Hours">{formatHours(clinic.hoursJson)}</Row>
        </dl>
      )}

      <div style={divider} />
      <div style={overline}>Reported by</div>
      <div style={{ fontSize: 13 }}>
        {reporterName || 'Anonymous'}
        {reporterEmail ? (
          <>
            {' · '}
            <a href={`mailto:${reporterEmail}`} style={{ color: '#2f8d73', fontWeight: 600 }}>
              {reporterEmail}
            </a>
          </>
        ) : (
          <span style={{ opacity: 0.6 }}> · no email left</span>
        )}
      </div>

      {others.length > 0 && (
        <>
          <div style={divider} />
          <div style={overline}>Other reports on this clinic</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {others.map((r) => (
              <a
                key={r.id}
                href={`/admin/collections/listing-reports/${r.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'inherit', textDecoration: 'none' }}
              >
                <span style={{ opacity: 0.6, minWidth: 80 }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                <span>{LISTING_REPORT_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}</span>
                {STATUS[r.status] && <Badge label={STATUS[r.status].label} tone={STATUS[r.status].tone} />}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt style={{ opacity: 0.6 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{children}</dd>
    </>
  )
}

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

function formatHours(raw: unknown): ReactNode {
  let hours: unknown = raw
  if (typeof raw === 'string') {
    try {
      hours = JSON.parse(raw)
    } catch {
      return raw
    }
  }
  if (!hours || typeof hours !== 'object') return '—'
  const entries = Object.entries(hours as Record<string, unknown>)
  if (entries.length === 0) return '—'
  return (
    <span style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0 10px' }}>
      {entries.map(([day, v]) => (
        <span key={day} style={{ display: 'contents' }}>
          <span style={{ textTransform: 'capitalize', opacity: 0.75 }}>{day}</span>
          <span>{typeof v === 'string' ? v : JSON.stringify(v)}</span>
        </span>
      ))}
    </span>
  )
}

const overline: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  opacity: 0.6,
  marginBottom: 6,
}

const divider: CSSProperties = { borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)', margin: '16px 0' }

const button: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid var(--theme-elevation-250, #cbd5e1)',
  color: 'inherit',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}

'use client'

import { useState } from 'react'
import { useCounts } from './useCounts'
import { StatChip } from './StatChip'
import { ListHeader } from './ListHeader'

const BASE = '/admin/collections/data-alerts'

// Mirrors the `type` select options in collections/DataAlerts.ts. That field is
// a fixed select (not freeform text), so the bulk-ack dropdown can be built
// from this static list instead of a distinct-values query.
const TYPE_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Duplicate clinic', value: 'duplicate_clinic' },
  { label: 'Duplicate provider', value: 'duplicate_provider' },
  { label: 'Missing coordinates', value: 'missing_coordinates' },
  { label: 'Missing source URL', value: 'missing_source' },
  { label: 'Unknown treatment', value: 'unknown_treatment' },
  { label: 'Broken relationship', value: 'broken_relationship' },
  { label: 'Unmatched city', value: 'unmatched_city' },
  { label: 'Missing trust field', value: 'missing_trust_field' },
  { label: 'Invalid ZIP code', value: 'invalid_zip' },
  { label: 'ZIP does not match city/state', value: 'zip_location_mismatch' },
  { label: 'Invalid coordinates', value: 'invalid_coordinates' },
  { label: 'Invalid phone number', value: 'invalid_phone' },
  { label: 'Duplicate NPI', value: 'duplicate_npi' },
  { label: 'Possible branch (review before merge)', value: 'possible_branch' },
  { label: 'Oversold / orphaned promotion', value: 'orphaned_promotion' },
  { label: 'Promotion missing provider', value: 'promo_missing_provider' },
  { label: 'Banner missing image', value: 'promo_missing_image' },
  { label: 'Expired promotion (auto-deactivated)', value: 'promo_expired' },
  { label: 'Promotion scope mismatch', value: 'promo_scope_mismatch' },
  { label: 'ZIP featuring request (provider self-serve)', value: 'zip_feature_request' },
  { label: 'Content: missing medical reviewer', value: 'content_missing_reviewer' },
  { label: 'Content: missing author', value: 'content_missing_author' },
  { label: 'Content: too few sources', value: 'content_few_sources' },
  { label: 'Content: missing cover image', value: 'content_missing_cover' },
  { label: 'Content: validation error', value: 'content_validation_error' },
  { label: 'Content: duplicate slug', value: 'content_duplicate_slug' },
  { label: 'Promotion expiring soon', value: 'promo_expiring_soon' },
  { label: 'Promotion slot exceeded', value: 'promo_slot_exceeded' },
  { label: 'New data page awaiting index review', value: 'new_indexable_page' },
  { label: 'Other', value: 'other' },
]

export function DataAlertsListHeader() {
  const { counts, refresh } = useCounts([
    { key: 'open', collection: 'data-alerts', where: { status: { equals: 'open' } } },
    {
      key: 'open_error',
      collection: 'data-alerts',
      where: { status: { equals: 'open' }, severity: { equals: 'error' } },
    },
    {
      key: 'open_warning',
      collection: 'data-alerts',
      where: { status: { equals: 'open' }, severity: { equals: 'warning' } },
    },
    {
      key: 'open_info',
      collection: 'data-alerts',
      where: { status: { equals: 'open' }, severity: { equals: 'info' } },
    },
    { key: 'acknowledged', collection: 'data-alerts', where: { status: { equals: 'acknowledged' } } },
    { key: 'resolved', collection: 'data-alerts', where: { status: { equals: 'resolved' } } },
  ])

  const [selectedType, setSelectedType] = useState(TYPE_OPTIONS[0].value)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleAcknowledge() {
    setBusy(true)
    setMessage(null)
    const typeLabel = TYPE_OPTIONS.find((t) => t.value === selectedType)?.label ?? selectedType
    try {
      const countRes = await fetch(
        `/api/data-alerts/count?where[type][equals]=${encodeURIComponent(selectedType)}&where[status][equals]=open`,
        { credentials: 'include' },
      )
      const countData = countRes.ok ? await countRes.json() : null
      const affected: number = countData?.totalDocs ?? 0

      if (affected === 0) {
        setMessage(`No open alerts of type "${typeLabel}".`)
        return
      }

      const confirmed = window.confirm(
        `Acknowledge ${affected} open alert(s) of type "${typeLabel}"? This cannot be undone from here.`,
      )
      if (!confirmed) return

      const res = await fetch('/api/admin/data-alerts/bulk-ack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: selectedType }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage(data?.error ?? 'Bulk acknowledge failed.')
      } else {
        setMessage(`Acknowledged ${data.updated} alert(s).`)
        refresh()
      }
    } catch {
      setMessage('Bulk acknowledge failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ListHeader
      chips={
        <>
          <StatChip
            label="Open"
            count={counts.open}
            href={`${BASE}?where[status][equals]=open`}
            tone={counts.open ? 'danger' : 'default'}
          />
          <StatChip
            label="Open · Error"
            count={counts.open_error}
            href={`${BASE}?where[status][equals]=open&where[severity][equals]=error`}
            tone="danger"
          />
          <StatChip
            label="Open · Warning"
            count={counts.open_warning}
            href={`${BASE}?where[status][equals]=open&where[severity][equals]=warning`}
            tone="warn"
          />
          <StatChip
            label="Open · Info"
            count={counts.open_info}
            href={`${BASE}?where[status][equals]=open&where[severity][equals]=info`}
          />
          <StatChip label="Acknowledged" count={counts.acknowledged} href={`${BASE}?where[status][equals]=acknowledged`} />
          <StatChip label="Resolved" count={counts.resolved} href={`${BASE}?where[status][equals]=resolved`} tone="success" />
        </>
      }
      extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.7 }}>Bulk acknowledge by type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            disabled={busy}
            style={{
              fontSize: 13,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--theme-elevation-150, #e2e8f0)',
              background: 'var(--theme-elevation-50, #fff)',
              color: 'inherit',
            }}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAcknowledge}
            disabled={busy}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '7px 14px',
              borderRadius: 999,
              border: '1px solid var(--theme-elevation-150, #e2e8f0)',
              background: 'var(--theme-elevation-100, #f1f5f9)',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
              color: 'inherit',
            }}
          >
            {busy ? 'Working…' : 'Acknowledge'}
          </button>
          {message && <span style={{ fontSize: 12, opacity: 0.8 }}>{message}</span>}
        </div>
      }
    />
  )
}

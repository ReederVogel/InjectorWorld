'use client'

import { useCallback, useEffect, useState } from 'react'
import { StatChip } from './list-headers/StatChip'

/**
 * Claims Control Center — outreach panel on the admin Claims list page.
 * Coverage stats + filterable clinic table + bulk claim-invite sending.
 */

type Coverage = {
  totals: {
    clinics: number
    withEmail: number
    claimed: number
    invited: number
    unsubscribed: number
    claimedPct: number
    invitedPct: number
  }
  byState: { state: string; total: number; withEmail: number; claimed: number; invited: number }[]
}

type OutreachRow = {
  id: number
  clinicName: string
  city: string
  state: string
  zip: string
  email: string
  slug: string
  claimed: boolean
  invite: { status: string; sendCount: number; lastSentAt: string | null } | null
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 12,
  background: 'var(--theme-elevation-0, #fff)',
  padding: 16,
  marginBottom: 16,
}

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-input-bg, var(--theme-elevation-0, #fff))',
  color: 'inherit',
  fontSize: 13,
}

const btnStyle: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 999,
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  background: 'var(--theme-elevation-50, #f7f8fa)',
  color: 'inherit',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...btnStyle,
  background: '#0B1B34',
  border: '1px solid #0B1B34',
  color: '#fff',
}

function Badge({ text, tone }: { text: string; tone: 'success' | 'info' | 'muted' | 'danger' }) {
  const tones: Record<string, { bg: string; color: string }> = {
    success: { bg: '#E6F2EE', color: '#2C7A63' },
    info: { bg: '#E8EEFB', color: '#1E40AF' },
    muted: { bg: 'var(--theme-elevation-100, #eef1f5)', color: 'inherit' },
    danger: { bg: '#FDECEC', color: '#B91C1C' },
  }
  const t = tones[tone]
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: t.bg, color: t.color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  )
}

export function ClaimsControlCenter() {
  const [open, setOpen] = useState(false)
  const [coverage, setCoverage] = useState<Coverage | null>(null)
  const [showAllStates, setShowAllStates] = useState(false)

  // Filters
  const [q, setQ] = useState('')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [claimedF, setClaimedF] = useState('no')
  const [invitedF, setInvitedF] = useState('')
  const [sort, setSort] = useState('clinicName')
  const [page, setPage] = useState(1)

  // Data
  const [rows, setRows] = useState<OutreachRow[]>([])
  const [totalDocs, setTotalDocs] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')

  const loadCoverage = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/claims/coverage', { credentials: 'include' })
      if (res.ok) setCoverage(await res.json())
    } catch { /* stats are non-critical */ }
  }, [])

  const loadRows = useCallback(async (pageArg: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (state) params.set('state', state)
      if (city) params.set('city', city)
      if (zip) params.set('zip', zip)
      if (claimedF) params.set('claimed', claimedF)
      if (invitedF) params.set('invited', invitedF)
      params.set('sort', sort)
      params.set('page', String(pageArg))
      params.set('limit', '25')
      const res = await fetch(`/api/admin/claims/outreach?${params}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRows(data.docs)
        setTotalDocs(data.totalDocs)
        setTotalPages(data.totalPages || 1)
        setSelected(new Set())
      }
    } finally {
      setLoading(false)
    }
  }, [q, state, city, zip, claimedF, invitedF, sort])

  useEffect(() => {
    if (open) {
      loadCoverage()
      loadRows(1)
      setPage(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function applyFilters() {
    setPage(1)
    loadRows(1)
  }

  function gotoPage(p: number) {
    const clamped = Math.min(Math.max(p, 1), totalPages)
    setPage(clamped)
    loadRows(clamped)
  }

  function toggleRow(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sendable = rows.filter((r) => !r.claimed && r.invite?.status !== 'unsubscribed')
  const allSelected = sendable.length > 0 && sendable.every((r) => selected.has(r.id))

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sendable.map((r) => r.id)))
  }

  async function sendInvites() {
    const ids = [...selected]
    if (ids.length === 0) return
    if (!window.confirm(`Send claim-invite emails to ${ids.length} clinic${ids.length === 1 ? '' : 's'}?`)) return

    setSending(true)
    setNotice('')
    try {
      const res = await fetch('/api/admin/claims/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicIds: ids }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setNotice(data.error || 'Send failed.')
      } else {
        const skippedNote = data.skipped?.length
          ? ` Skipped ${data.skipped.length}: ${data.skipped.map((s: any) => s.reason).slice(0, 5).join(', ')}.`
          : ''
        setNotice(`Sent ${data.sent} invite${data.sent === 1 ? '' : 's'}.${skippedNote}`)
        loadRows(page)
        loadCoverage()
      }
    } catch {
      setNotice('Network error while sending.')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 16 }}>
        <button type="button" style={primaryBtn} onClick={() => setOpen(true)}>
          Open outreach control center
        </button>
      </div>
    )
  }

  const t = coverage?.totals

  return (
    <div style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.7 }}>
          Outreach control center
        </div>
        <button type="button" style={btnStyle} onClick={() => setOpen(false)}>Close</button>
      </div>

      {/* Coverage stats */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatChip label="Published clinics" count={t?.clinics} />
        <StatChip label="With email" count={t?.withEmail} />
        <StatChip label="Claimed" count={t?.claimed} tone="success" suffix={t ? ` (${t.claimedPct}%)` : ''} />
        <StatChip label="Invited" count={t?.invited} suffix={t ? ` (${t.invitedPct}% of emails)` : ''} />
        <StatChip label="Unsubscribed" count={t?.unsubscribed} tone={t?.unsubscribed ? 'warn' : 'default'} />
      </div>

      {/* By-state breakdown */}
      {coverage && coverage.byState.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <button type="button" style={{ ...btnStyle, fontSize: 12 }} onClick={() => setShowAllStates((v) => !v)}>
            {showAllStates ? 'Hide state breakdown' : `State breakdown (${coverage.byState.length})`}
          </button>
          {showAllStates && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
                <thead>
                  <tr>
                    {['State', 'Clinics', 'With email', 'Invited', 'Claimed'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 12px 4px 0', opacity: 0.6, fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.byState.map((s) => (
                    <tr key={s.state}>
                      <td style={{ padding: '3px 12px 3px 0', fontWeight: 600 }}>{s.state}</td>
                      <td style={{ padding: '3px 12px 3px 0' }}>{s.total.toLocaleString()}</td>
                      <td style={{ padding: '3px 12px 3px 0' }}>{s.withEmail.toLocaleString()}</td>
                      <td style={{ padding: '3px 12px 3px 0' }}>{s.invited.toLocaleString()}</td>
                      <td style={{ padding: '3px 12px 3px 0' }}>{s.claimed.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input style={{ ...inputStyle, width: 180 }} placeholder="Search clinic name…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
        <input style={{ ...inputStyle, width: 64 }} placeholder="State" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
        <input style={{ ...inputStyle, width: 120 }} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
        <input style={{ ...inputStyle, width: 90 }} placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyFilters()} />
        <select style={inputStyle} value={claimedF} onChange={(e) => setClaimedF(e.target.value)}>
          <option value="">Claimed: any</option>
          <option value="no">Unclaimed only</option>
          <option value="yes">Claimed only</option>
        </select>
        <select style={inputStyle} value={invitedF} onChange={(e) => setInvitedF(e.target.value)}>
          <option value="">Invited: any</option>
          <option value="no">Not yet invited</option>
          <option value="yes">Already invited</option>
        </select>
        <select style={inputStyle} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="clinicName">A → Z</option>
          <option value="-clinicName">Z → A</option>
          <option value="state">By state</option>
          <option value="city">By city</option>
          <option value="-createdAt">Newest first</option>
        </select>
        <button type="button" style={btnStyle} onClick={applyFilters} disabled={loading}>
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <button type="button" style={primaryBtn} onClick={sendInvites} disabled={sending || selected.size === 0}>
          {sending ? 'Sending…' : `Send invite to ${selected.size} selected`}
        </button>
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {totalDocs.toLocaleString()} clinics match · max 50 per batch
        </span>
        {notice && <span style={{ fontSize: 12, fontWeight: 600 }}>{notice}</span>}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
              <th style={{ padding: '6px 8px', textAlign: 'left' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all sendable on page" />
              </th>
              {['Clinic', 'Location', 'Email', 'Status'].map((h) => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', opacity: 0.6, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ padding: 16, opacity: 0.6 }}>No clinics match these filters.</td></tr>
            )}
            {rows.map((r) => {
              const unsub = r.invite?.status === 'unsubscribed'
              const disabled = r.claimed || unsub
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--theme-elevation-100, #eef1f5)', opacity: disabled ? 0.55 : 1 }}>
                  <td style={{ padding: '6px 8px' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleRow(r.id)}
                      disabled={disabled}
                      aria-label={`Select ${r.clinicName}`}
                    />
                  </td>
                  <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                    <a href={`/admin/collections/clinics/${r.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.clinicName}</a>
                  </td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{r.city}, {r.state}{r.zip ? ` ${r.zip}` : ''}</td>
                  <td style={{ padding: '6px 8px' }}>{r.email}</td>
                  <td style={{ padding: '6px 8px' }}>
                    {r.claimed ? (
                      <Badge text="Claimed" tone="success" />
                    ) : unsub ? (
                      <Badge text="Unsubscribed" tone="danger" />
                    ) : r.invite ? (
                      <Badge text={`Invited ×${r.invite.sendCount}`} tone="info" />
                    ) : (
                      <Badge text="Not invited" tone="muted" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
          <button type="button" style={btnStyle} onClick={() => gotoPage(page - 1)} disabled={page <= 1 || loading}>Prev</button>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Page {page} of {totalPages}</span>
          <button type="button" style={btnStyle} onClick={() => gotoPage(page + 1)} disabled={page >= totalPages || loading}>Next</button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BranchSuggestions } from './BranchSuggestions'
import { DashboardNewsletterPanel } from './DashboardNewsletterPanel'
import { DashboardNewsSendPanel } from './DashboardNewsSendPanel'

type Counts = { created: number; updated: number; skipped: number }
type ClinicCounts = Counts & {
  publishedCount: number
  reviewCount: number
  draftCount: number
  treatmentsAutoCreated: string[]
}
type Report = {
  clinics: ClinicCounts
  providers: Counts
  reviews: Counts
  photos: Counts
  qa: Counts
  alerts: Array<{ severity: string; type: string; message: string }>
  dryRun?: boolean
  batch?: string
}

const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

const ALERTS_OPEN = '/admin/collections/data-alerts?where[or][0][and][0][status][equals]=open'
const LEADS_NEW = '/admin/collections/bookings?where[or][0][and][0][status][equals]=new'

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({
  title,
  id,
  defaultOpen,
  danger,
  children,
}: {
  title: string
  id?: string
  defaultOpen: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: danger
            ? 'rgba(185,28,28,0.06)'
            : 'var(--theme-elevation-100, #f1f5f9)',
          border: `1px solid ${danger ? 'rgba(185,28,28,0.25)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
          borderBottom: open ? 'none' : undefined,
          borderRadius: open ? '8px 8px 0 0' : '8px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <strong style={{ fontSize: 14, color: danger ? '#B91C1C' : 'inherit' }}>{title}</strong>
        <span style={{ fontSize: 11, opacity: 0.55, fontWeight: 500, letterSpacing: '0.04em' }}>
          {open ? '▲ collapse' : '▼ expand'}
        </span>
      </button>
      {open && (
        <div
          style={{
            border: `1px solid ${danger ? 'rgba(185,28,28,0.25)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
            borderTop: 'none',
            borderRadius: '0 0 8px 8px',
            padding: '16px 16px 0',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

// ── Top stats bar (5 cards per spec) ──────────────────────────────────────────
function StatsBar({
  totalProviders,
  totalClinics,
  alertCritical,
  alertWarning,
  alertInfo,
  activePromotions,
  unactionedLeads,
  liveMarkets,
}: {
  totalProviders: number | null
  totalClinics: number | null
  alertCritical: number
  alertWarning: number
  alertInfo: number
  activePromotions: number | null
  unactionedLeads: number | null
  liveMarkets: number | null
}) {
  const totalAlerts = alertCritical + alertWarning + alertInfo
  const alertLabel = totalAlerts === 0
    ? '0 alerts'
    : [
        alertCritical > 0 ? `${alertCritical} crit` : '',
        alertWarning > 0 ? `${alertWarning} warn` : '',
        alertInfo > 0 ? `${alertInfo} info` : '',
      ].filter(Boolean).join(' / ')

  const stats = [
    {
      label: 'Active providers',
      value: totalProviders === null ? '–' : totalProviders,
      href: '/admin/collections/providers',
      accent: false,
    },
    {
      label: 'Active clinics',
      value: totalClinics === null ? '–' : totalClinics,
      href: '/admin/collections/clinics',
      accent: false,
    },
    {
      label: `DataAlerts`,
      value: totalAlerts,
      sub: alertLabel,
      href: ALERTS_OPEN,
      accent: alertCritical > 0 ? '#B91C1C' : alertWarning > 0 ? '#C2A14E' : false,
    },
    {
      label: 'Active promotions',
      value: activePromotions === null ? '–' : activePromotions,
      href: '/admin/collections/promotions',
      accent: false,
    },
    {
      label: 'Unactioned leads',
      value: unactionedLeads === null ? '–' : unactionedLeads,
      href: LEADS_NEW,
      accent: (unactionedLeads ?? 0) > 0 ? '#C2A14E' : false,
    },
    {
      label: 'Live markets',
      value: liveMarkets === null ? '–' : liveMarkets,
      href: '/admin/collections/locations?where[and][0][kind][equals]=state&where[and][1][isLive][equals]=true',
      accent: (liveMarkets ?? 0) > 0 ? '#3FA68A' : false,
    },
  ]

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
      {stats.map(({ label, value, sub, href, accent }) => (
        <a
          key={label}
          href={href}
          style={{
            flex: '1 1 120px',
            textDecoration: 'none',
            color: 'inherit',
            padding: '14px 16px',
            border: `1px solid ${accent ? String(accent) + '44' : 'var(--theme-elevation-150, #e2e8f0)'}`,
            borderLeft: accent ? `4px solid ${accent}` : '1px solid var(--theme-elevation-150, #e2e8f0)',
            borderRadius: 8,
            background: 'var(--theme-elevation-50, #fff)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: accent ? String(accent) : 'inherit' }}>
            {value}
          </span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>{label}</span>
          {sub && <span style={{ fontSize: 11, opacity: 0.5 }}>{sub}</span>}
        </a>
      ))}
    </div>
  )
}

// ── Promotions Coverage Map ────────────────────────────────────────────────────
type CoveragePromo = {
  id: string
  title: string
  scope: string
  placement: string
  status: string
  endDate?: string
  treatment?: string
  state?: string
  city?: string
}

function PromotionsCoverageMap() {
  const [activeTab, setActiveTab] = useState<'treatment' | 'find'>('treatment')
  const [promos, setPromos] = useState<CoveragePromo[]>([])
  const [treatments, setTreatments] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [states, setStates] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ scope: string; label: string } | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [promoRes, treatRes, stateRes] = await Promise.all([
          fetch('/api/promotions?where[status][equals]=active&limit=200&depth=0', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/treatments?limit=100&depth=0&sort=name', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/locations?where[kind][equals]=state&limit=100&depth=0&sort=name', { credentials: 'include' }).then(r => r.json()),
        ])
        const now = new Date().toISOString()
        const activePromos = (promoRes.docs ?? []).filter(
          (p: any) => !p.endDate || p.endDate > now,
        ) as CoveragePromo[]
        setPromos(activePromos)
        setTreatments((treatRes.docs ?? []).map((t: any) => ({ id: String(t.id), name: t.name, slug: t.slug })))
        setStates((stateRes.docs ?? []).map((s: any) => ({ id: String(s.id), name: s.name, slug: s.slug })))
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const PLACEMENTS = ['banner', 'sponsored-card', 'featured-pin'] as const
  const PLACEMENT_LABELS: Record<string, string> = {
    banner: 'Banner',
    'sponsored-card': 'Sponsored',
    'featured-pin': 'Featured',
  }

  function countPromos(filter: (p: CoveragePromo) => boolean) {
    const matched = promos.filter(filter)
    const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString()
    const expiringSoon = matched.some(p => p.endDate && p.endDate < sevenDays)
    return { count: matched.length, expiringSoon, promos: matched }
  }

  function cellStyle(count: number, expiringSoon: boolean): React.CSSProperties {
    if (count === 0) return { background: 'var(--theme-elevation-100, #f1f5f9)', color: '#94A3B8' }
    if (expiringSoon) return { background: '#FEF3C7', color: '#92400E', fontWeight: 700 }
    return { background: '#D1FAE5', color: '#065F46', fontWeight: 700 }
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  if (loading) {
    return <div style={{ ...box, fontSize: 13, opacity: 0.6 }}>Loading coverage map...</div>
  }

  const selectedPromos = selected
    ? promos.filter(p => {
        if (activeTab === 'treatment') {
          return p.scope === 'treatment' || p.scope === 'treatment+state' || p.scope === 'treatment+city'
        }
        return p.scope === 'state' || p.scope === 'city' || p.scope === 'national'
      })
    : []

  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Promotions coverage map</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 12px' }}>
        Active promotions by scope. Green = active, yellow = expiring in 7 days, gray = none.
      </div>

      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        <button type="button" style={tabBtn(activeTab === 'treatment')} onClick={() => { setActiveTab('treatment'); setSelected(null) }}>Treatment path</button>
        <button type="button" style={tabBtn(activeTab === 'find')} onClick={() => { setActiveTab('find'); setSelected(null) }}>Find path</button>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: selected ? 0 : 8 }}>
        {activeTab === 'treatment' ? (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>Treatment</th>
                {states.slice(0, 12).map(s => (
                  <th key={s.id} style={{ padding: '6px 8px', textAlign: 'center', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)', whiteSpace: 'nowrap' }}>
                    {s.name.length > 6 ? s.name.slice(0, 6) + '.' : s.name}
                  </th>
                ))}
                <th style={{ padding: '6px 8px', textAlign: 'center', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>All</th>
              </tr>
            </thead>
            <tbody>
              {treatments.map(t => (
                <tr key={t.id}>
                  <td style={{ padding: '5px 10px', border: '1px solid var(--theme-elevation-150, #e2e8f0)', whiteSpace: 'nowrap' }}>{t.name}</td>
                  {states.slice(0, 12).map(s => {
                    const { count, expiringSoon, promos: matched } = countPromos(
                      p => (p.treatment === t.id || p.treatment === t.slug) &&
                           (p.state === s.id || p.state === s.slug) &&
                           (p.scope === 'treatment+state' || p.scope === 'treatment+city'),
                    )
                    return (
                      <td
                        key={s.id}
                        style={{ padding: '5px 8px', textAlign: 'center', border: '1px solid var(--theme-elevation-150, #e2e8f0)', cursor: 'pointer', ...cellStyle(count, expiringSoon) }}
                        title={matched.map(p => p.title).join(', ') || 'No promos'}
                        onClick={() => setSelected({ scope: `${t.name} × ${s.name}`, label: `${t.name} × ${s.name}` })}
                      >
                        {count || '·'}
                      </td>
                    )
                  })}
                  {/* National treatment cell */}
                  {(() => {
                    const { count, expiringSoon } = countPromos(
                      p => (p.treatment === t.id || p.treatment === t.slug) && p.scope === 'treatment',
                    )
                    return (
                      <td style={{ padding: '5px 8px', textAlign: 'center', border: '1px solid var(--theme-elevation-150, #e2e8f0)', cursor: 'pointer', ...cellStyle(count, expiringSoon) }}
                        onClick={() => setSelected({ scope: `${t.name} (national)`, label: `${t.name} national` })}>
                        {count || '·'}
                      </td>
                    )
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 300 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>State</th>
                {PLACEMENTS.map(pl => (
                  <th key={pl} style={{ padding: '6px 10px', textAlign: 'center', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
                    {PLACEMENT_LABELS[pl]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {states.map(s => (
                <tr key={s.id}>
                  <td style={{ padding: '5px 10px', border: '1px solid var(--theme-elevation-150, #e2e8f0)', whiteSpace: 'nowrap' }}>{s.name}</td>
                  {PLACEMENTS.map(pl => {
                    const { count, expiringSoon } = countPromos(
                      p => (p.state === s.id || p.state === s.slug) &&
                           p.placement === pl &&
                           (p.scope === 'state' || p.scope === 'city'),
                    )
                    return (
                      <td
                        key={pl}
                        style={{ padding: '5px 10px', textAlign: 'center', border: '1px solid var(--theme-elevation-150, #e2e8f0)', cursor: 'pointer', ...cellStyle(count, expiringSoon) }}
                        onClick={() => setSelected({ scope: `${s.name} ${PLACEMENT_LABELS[pl]}`, label: `${s.name} ${PLACEMENT_LABELS[pl]}` })}
                      >
                        {count || '·'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div style={{ marginTop: 12, padding: 14, border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, background: 'var(--theme-elevation-50, #fff)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 13 }}>{selected.label}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/admin/collections/promotions/create" style={{ ...pill, background: '#3FA68A', color: '#fff', fontSize: 12 }}>
                + Add promotion
              </a>
              <button type="button" onClick={() => setSelected(null)} style={{ fontSize: 12, cursor: 'pointer', background: 'none', border: 'none', opacity: 0.5 }}>
                Close
              </button>
            </div>
          </div>
          {selectedPromos.length === 0 ? (
            <p style={{ fontSize: 13, opacity: 0.6 }}>No active promotions match this scope.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {selectedPromos.map(p => (
                <li key={p.id} style={{ marginBottom: 4 }}>
                  <a href={`/admin/collections/promotions/${p.id}`} style={{ color: 'inherit' }}>{p.title}</a>
                  {' '}<span style={{ opacity: 0.55 }}>· {p.placement} · {p.scope}{p.endDate ? ` · ends ${p.endDate.slice(0, 10)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function DashboardWidget() {
  const [openAlerts, setOpenAlerts] = useState<number | null>(null)
  const [errorAlerts, setErrorAlerts] = useState<number>(0)
  const [alertCritical, setAlertCritical] = useState<number>(0)
  const [alertWarning, setAlertWarning] = useState<number>(0)
  const [alertInfo, setAlertInfo] = useState<number>(0)
  const [newBookings, setNewBookings] = useState<number | null>(null)
  const [oldestBooking, setOldestBooking] = useState<string | null>(null)
  const [pendingClaims, setPendingClaims] = useState<number>(0)
  const [showHelp, setShowHelp] = useState(false)
  const [confirmedSubs, setConfirmedSubs] = useState<number>(0)
  const [totalProviders, setTotalProviders] = useState<number | null>(null)
  const [totalClinics, setTotalClinics] = useState<number | null>(null)
  const [activePromotions, setActivePromotions] = useState<number | null>(null)
  const [liveMarkets, setLiveMarkets] = useState<number | null>(null)

  async function loadAlertCounts() {
    try {
      const [openRes, errRes, warnRes, infoRes] = await Promise.all([
        fetch('/api/data-alerts?where[status][equals]=open&limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=error&limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=warning&limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=info&limit=0&depth=0', { credentials: 'include' }),
      ])
      const [openJson, errJson, warnJson, infoJson] = await Promise.all([
        openRes.json(), errRes.json(), warnRes.json(), infoRes.json(),
      ])
      setOpenAlerts(openJson.totalDocs ?? 0)
      const crit = errJson.totalDocs ?? 0
      const warn = warnJson.totalDocs ?? 0
      const info = infoJson.totalDocs ?? 0
      setAlertCritical(crit)
      setAlertWarning(warn)
      setAlertInfo(info)
      setErrorAlerts(crit)
    } catch {
      setOpenAlerts(null)
    }
  }

  async function loadPendingClaims() {
    try {
      const res = await fetch('/api/claims?where[status][equals]=new&limit=0&depth=0', { credentials: 'include' })
      const json = await res.json()
      setPendingClaims(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  async function loadBookings() {
    try {
      const res = await fetch(
        '/api/bookings?where[status][equals]=new&limit=1&sort=createdAt&depth=0',
        { credentials: 'include' },
      )
      const json = await res.json()
      setNewBookings(json.totalDocs ?? 0)
      setOldestBooking(json.docs?.[0]?.createdAt ?? null)
    } catch {
      setNewBookings(null)
    }
  }

  async function loadSubscribers() {
    try {
      const res = await fetch('/api/subscribers?where[status][equals]=confirmed&limit=0&depth=0', { credentials: 'include' })
      const json = await res.json()
      setConfirmedSubs(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  async function loadStats() {
    try {
      const [provRes, clinRes, promoRes, liveMarkRes] = await Promise.all([
        fetch('/api/providers?limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/clinics?limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/promotions?where[status][equals]=active&limit=0&depth=0', { credentials: 'include' }),
        fetch('/api/locations?where[and][0][kind][equals]=state&where[and][1][isLive][equals]=true&limit=0&depth=0', { credentials: 'include' }),
      ])
      const [provJson, clinJson, promoJson, liveMarkJson] = await Promise.all([
        provRes.json(), clinRes.json(), promoRes.json(), liveMarkRes.json(),
      ])
      setTotalProviders(provJson.totalDocs ?? 0)
      setTotalClinics(clinJson.totalDocs ?? 0)
      setActivePromotions(promoJson.totalDocs ?? 0)
      setLiveMarkets(liveMarkJson.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  useEffect(() => {
    loadAlertCounts()
    loadBookings()
    loadSubscribers()
    loadPendingClaims()
    loadStats()
  }, [])

  const oldestDays =
    newBookings && oldestBooking
      ? Math.floor((Date.now() - new Date(oldestBooking).getTime()) / 86400000)
      : 0
  const staleLeads = (newBookings ?? 0) > 0 && oldestDays >= 2
  const priorities: string[] = []
  if (errorAlerts > 0) priorities.push(`${errorAlerts} data error${errorAlerts === 1 ? '' : 's'} need fixing`)
  if (staleLeads) priorities.push(`a lead has been waiting ${oldestDays} days`)
  if (pendingClaims > 0) priorities.push(`${pendingClaims} claim${pendingClaims === 1 ? '' : 's'} awaiting review`)
  const allClear = openAlerts === 0 && (newBookings ?? 0) === 0 && pendingClaims === 0

  return (
    <div style={{ marginBottom: 8 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>Operations</h2>

      <StatsBar
        totalProviders={totalProviders}
        totalClinics={totalClinics}
        alertCritical={alertCritical}
        alertWarning={alertWarning}
        alertInfo={alertInfo}
        activePromotions={activePromotions}
        unactionedLeads={newBookings}
        liveMarkets={liveMarkets}
      />

      <PromotionsCoverageMap />

      {/* ── Markets control ───────────────────────────────────────────────── */}
      <Section title="Markets" defaultOpen={true}>
        <MarketsPanel />
      </Section>

      {/* ── Overview & Quick Actions ───────────────────────────────────────── */}
      <Section title="Overview & Quick Actions" defaultOpen={true}>
        <div
          style={{
            ...box,
            borderLeft: `4px solid ${priorities.length ? '#B91C1C' : allClear ? '#3FA68A' : '#C2A14E'}`,
          }}
        >
          {priorities.length > 0 ? (
            <div>
              <strong style={{ fontSize: 15 }}>Needs you now</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
                {errorAlerts > 0 && (
                  <li><a href={ALERTS_OPEN} style={{ color: 'inherit' }}>{errorAlerts} data error{errorAlerts === 1 ? '' : 's'} need fixing →</a></li>
                )}
                {staleLeads && (
                  <li><a href={LEADS_NEW} style={{ color: 'inherit' }}>A lead has been waiting {oldestDays} days →</a></li>
                )}
                {pendingClaims > 0 && (
                  <li><a href="/admin/collections/claims?where[or][0][and][0][status][equals]=new" style={{ color: 'inherit' }}>{pendingClaims} claim{pendingClaims === 1 ? '' : 's'} awaiting review →</a></li>
                )}
              </ul>
            </div>
          ) : allClear ? (
            <div style={{ fontSize: 13 }}><strong style={{ fontSize: 15 }}>All clear.</strong> No open alerts and no unactioned leads.</div>
          ) : (
            <div style={{ fontSize: 13 }}>
              <strong style={{ fontSize: 15 }}>Nothing urgent.</strong>{' '}
              {openAlerts ? `${openAlerts} open alert${openAlerts === 1 ? '' : 's'} to review. ` : ''}
              {newBookings ? `${newBookings} new lead${newBookings === 1 ? '' : 's'} to action.` : ''}
            </div>
          )}
        </div>

        <div style={{ ...box, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <QuickAction href="#data-tools" label="Data tools" />
          <QuickAction href="#bulk-import" label="Import data" />
          <QuickAction href="/admin/collections/locations" label="Manage markets" />
          <QuickAction href="/admin/collections/promotions/create" label="New promotion" />
          <QuickAction href={LEADS_NEW} label="Review leads" />
          <QuickAction href={ALERTS_OPEN} label="Resolve alerts" />
          <QuickAction href="/" label="View live site" external />
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            style={{
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              padding: '9px 14px', borderRadius: 8,
              background: 'var(--theme-elevation-100, #f1f5f9)',
              border: '1px solid var(--theme-elevation-150, #e2e8f0)',
              color: 'var(--theme-text, #0B1B34)',
            }}
          >
            {showHelp ? 'Hide how this works' : 'How this works'}
          </button>
        </div>

        {showHelp && (
          <div style={box}>
            <strong style={{ fontSize: 15 }}>How this works</strong>
            <dl style={{ fontSize: 13, margin: '10px 0 0' }}>
              {HELP.map(([term, desc]) => (
                <div key={term} style={{ marginBottom: 10 }}>
                  <dt style={{ fontWeight: 600 }}>{term}</dt>
                  <dd style={{ margin: '2px 0 0', opacity: 0.85 }}>{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div
          style={{
            ...box,
            borderLeft: `4px solid ${errorAlerts > 0 ? '#B91C1C' : openAlerts ? '#C2A14E' : '#3FA68A'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 15 }}>Data integrity</strong>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                {openAlerts === null
                  ? 'Could not load alerts.'
                  : openAlerts === 0
                  ? 'No open alerts. Data looks clean.'
                  : `${openAlerts} open alert${openAlerts === 1 ? '' : 's'}${errorAlerts > 0 ? ` (${errorAlerts} error${errorAlerts === 1 ? '' : 's'} need attention)` : ''}.`}
              </div>
            </div>
            <a href={ALERTS_OPEN} style={pill}>View alerts →</a>
          </div>
        </div>
      </Section>

      {/* ── Leads & Claims ────────────────────────────────────────────────────── */}
      <Section title="Leads & Claims" defaultOpen={true}>
        {(() => {
          const has = (newBookings ?? 0) > 0
          let oldestLabel = ''
          if (has && oldestBooking) {
            oldestLabel = oldestDays <= 0 ? 'oldest arrived today' : `oldest waiting ${oldestDays} day${oldestDays === 1 ? '' : 's'}`
          }
          return (
            <div style={{ ...box, borderLeft: `4px solid ${staleLeads ? '#B91C1C' : has ? '#C2A14E' : '#3FA68A'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 15 }}>New leads</strong>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                    {newBookings === null
                      ? 'Could not load bookings.'
                      : newBookings === 0
                      ? 'No new leads. All bookings actioned.'
                      : `${newBookings} new booking${newBookings === 1 ? '' : 's'} awaiting action${oldestLabel ? ` (${oldestLabel})` : ''}.`}
                  </div>
                </div>
                <a href={LEADS_NEW} style={pill}>View leads →</a>
              </div>
            </div>
          )
        })()}

        <div id="newsletter" style={box}>
          <strong style={{ fontSize: 15 }}>Newsletter broadcast</strong>
          <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
            Send a plain-text email to confirmed subscribers. An unsubscribe link is added automatically.
            Set RESEND_API_KEY to send real mail (falls back to console log).
          </div>
          <DashboardNewsletterPanel confirmedCount={confirmedSubs} />
        </div>

        <div id="news-send" style={box}>
          <strong style={{ fontSize: 15 }}>Send news article to subscribers</strong>
          <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
            Notify subscribers about a published news article. The email is auto-composed from the article title and excerpt.
          </div>
          <DashboardNewsSendPanel confirmedCount={confirmedSubs} />
        </div>
      </Section>

      {/* ── Data Import ──────────────────────────────────────────────────────── */}
      <Section title="Data Import" id="bulk-import" defaultOpen={false}>
        <ImportPanel onAfterImport={loadAlertCounts} />
        <ContentImportPanel collection="news" label="News articles" onAfterImport={loadAlertCounts} />
        <ContentImportPanel collection="guides" label="Guides" onAfterImport={loadAlertCounts} />
      </Section>

      {/* ── Content Review & Indexing ─────────────────────────────────────────── */}
      <Section title="Content Review & Indexing" defaultOpen={false}>
        <ContentReviewPanel />
        <DripIndexPanel />
      </Section>

      {/* ── Data Tools & Danger Zone ──────────────────────────────────────────── */}
      <Section title="Data Tools & Danger Zone" id="data-tools" defaultOpen={false} danger>
        <BranchSuggestions onAfterChange={loadAlertCounts} />
        <AdminDataFixPanel onAfterChange={loadAlertCounts} />
        <DataToolsPanel onAfterChange={loadAlertCounts} />
      </Section>
    </div>
  )
}

// ── Markets control panel ─────────────────────────────────────────────────────

type LocationRow = {
  id: number
  name: string
  slug: string
  kind: string
  state: string | null
  isLive: boolean
  noindex: boolean
}

function MarketsPanel() {
  const [tab, setTab] = useState<'states' | 'cities'>('states')
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterLive, setFilterLive] = useState<'all' | 'live' | 'coming-soon'>('all')
  const [filterState, setFilterState] = useState<string>('all')
  const [saving, setSaving] = useState<Record<number, 'saving' | 'saved' | 'error'>>({})
  const [rowError, setRowError] = useState<Record<number, string>>({})

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch(
        '/api/locations?where[or][0][kind][equals]=state&where[or][1][kind][equals]=metro&where[or][2][kind][equals]=city&limit=500&depth=0&sort=name',
        { credentials: 'include' },
      )
      const json = await res.json()
      const rows: LocationRow[] = (json.docs ?? []).map((d: any) => ({
        id: d.id,
        name: d.name,
        slug: d.slug,
        kind: d.kind,
        state: d.state ?? null,
        isLive: d.isLive ?? false,
        noindex: d.noindex ?? true,
      }))
      setLocations(rows)
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false)
    }
  }

  async function toggle(id: number, field: 'isLive' | 'noindex', value: boolean) {
    // Optimistic update
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)))
    setSaving((p) => ({ ...p, [id]: 'saving' }))
    setRowError((p) => { const n = { ...p }; delete n[id]; return n })

    try {
      const res = await fetch('/api/admin/locations/quick-toggle', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: id, [field]: value }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed.')
      // Reconcile with server response
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, isLive: json.isLive, noindex: json.noindex } : l)))
      setSaving((p) => ({ ...p, [id]: 'saved' }))
      setTimeout(() => setSaving((p) => { const n = { ...p }; delete n[id]; return n }), 1800)
    } catch (err: any) {
      // Rollback
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: !value } : l)))
      setSaving((p) => { const n = { ...p }; delete n[id]; return n })
      setRowError((p) => ({ ...p, [id]: err?.message ?? 'Save failed.' }))
    }
  }

  const stateRows = locations.filter((l) => l.kind === 'state')
  const cityRows = locations.filter((l) => l.kind === 'metro' || l.kind === 'city')
  const stateOptions = Array.from(new Set(cityRows.map((l) => l.state).filter(Boolean))).sort() as string[]

  const visibleStates = stateRows.filter((l) => {
    if (filterLive === 'live') return l.isLive
    if (filterLive === 'coming-soon') return !l.isLive
    return true
  })
  const visibleCities = cityRows.filter((l) => {
    const stateMatch = filterState === 'all' || l.state === filterState
    const liveMatch = filterLive === 'all' || (filterLive === 'live' ? l.isLive : !l.isLive)
    return stateMatch && liveMatch
  })
  const visible = tab === 'states' ? visibleStates : visibleCities

  const tabBtn2 = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  const toggle2 = (on: boolean, muted?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
    fontSize: 11, fontWeight: 700, flexShrink: 0,
    background: on ? (muted ? '#B91C1C' : '#3FA68A') : '#94A3B8',
    color: '#fff',
    opacity: 1,
  })

  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Markets</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 12px' }}>
        Toggle <strong>Live</strong> (makes the directory page public) and <strong>Noindex</strong> (hides from Google). Changes save immediately.
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', display: 'flex', gap: 4 }}>
          <button type="button" style={tabBtn2(tab === 'states')} onClick={() => setTab('states')}>States</button>
          <button type="button" style={tabBtn2(tab === 'cities')} onClick={() => setTab('cities')}>Cities</button>
        </div>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          Filter:
          <select value={filterLive} onChange={(e) => setFilterLive(e.target.value as any)} style={{ padding: '4px 6px', fontSize: 12 }}>
            <option value="all">All</option>
            <option value="live">Live only</option>
            <option value="coming-soon">Coming soon only</option>
          </select>
        </label>
        {tab === 'cities' && (
          <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            State:
            <select value={filterState} onChange={(e) => setFilterState(e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
              <option value="all">All states</option>
              {stateOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
        <span style={{ fontSize: 12, opacity: 0.6 }}>Showing {visible.length}</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.6 }}>Loading locations…</div>
      ) : visible.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6 }}>No locations match the filter.</div>
      ) : (
        <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: tab === 'states' ? '1fr 60px 90px 90px 60px' : '1fr 60px 60px 90px 90px 60px',
            gap: 0,
            background: 'var(--theme-elevation-100, #f1f5f9)',
            borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
            padding: '6px 12px',
          }}>
            <span>Name</span>
            {tab === 'cities' && <span>State</span>}
            <span>Kind</span>
            <span style={{ textAlign: 'center' }}>Live</span>
            <span style={{ textAlign: 'center' }}>Noindex</span>
            <span style={{ textAlign: 'center' }}>Status</span>
          </div>
          {visible.slice(0, 120).map((loc, idx) => (
            <div
              key={loc.id}
              style={{
                display: 'grid',
                gridTemplateColumns: tab === 'states' ? '1fr 60px 90px 90px 60px' : '1fr 60px 60px 90px 90px 60px',
                gap: 0,
                alignItems: 'center',
                padding: '7px 12px',
                fontSize: 13,
                background: idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
              }}
            >
              <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
              {tab === 'cities' && <span style={{ fontSize: 12, opacity: 0.7 }}>{loc.state ?? '–'}</span>}
              <span style={{ fontSize: 11, opacity: 0.65 }}>{loc.kind}</span>
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  style={toggle2(loc.isLive)}
                  title={loc.isLive ? 'Live — click to disable' : 'Coming soon — click to go live'}
                  onClick={() => toggle(loc.id, 'isLive', !loc.isLive)}
                  disabled={saving[loc.id] === 'saving'}
                >
                  {loc.isLive ? 'ON' : 'OFF'}
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button
                  type="button"
                  style={toggle2(loc.noindex, true)}
                  title={loc.noindex ? 'Noindex ON (hidden from Google) — click to allow indexing' : 'Indexed (Google can crawl) — click to noindex'}
                  onClick={() => toggle(loc.id, 'noindex', !loc.noindex)}
                  disabled={saving[loc.id] === 'saving'}
                >
                  {loc.noindex ? 'ON' : 'OFF'}
                </button>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11 }}>
                {saving[loc.id] === 'saving' && <span style={{ opacity: 0.6 }}>…</span>}
                {saving[loc.id] === 'saved' && <span style={{ color: '#3FA68A', fontWeight: 700 }}>✓</span>}
                {rowError[loc.id] && (
                  <span style={{ color: '#B91C1C' }} title={rowError[loc.id]}>✗</span>
                )}
              </div>
            </div>
          ))}
          {visible.length > 120 && (
            <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6, borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
              Showing first 120 of {visible.length}. Use a tighter filter to see more.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Admin data-fix panel (4 operations) ──────────────────────────────────────

type FixOp = {
  key: string
  label: string
  description: string
  endpoint: string
  danger?: boolean
}

const DATA_FIX_OPS: FixOp[] = [
  {
    key: 'zip-backfill',
    label: 'ZIP location backfill',
    description: 'Fill in city, state, lat/lng from the zip_codes table for clinics with bad/missing/ALL-CAPS location data.',
    endpoint: '/api/admin/data-fix/zip-backfill',
  },
  {
    key: 'clean-bad-names',
    label: 'Cleanup bad-name clinics',
    description: 'Mark clinics with street-address-style names (starting with a number) as status=review, hiding them from the public directory.',
    endpoint: '/api/admin/data-fix/clean-bad-names',
  },
  {
    key: 'delete-zip-locations',
    label: 'Delete ZIP-only Locations',
    description: 'Delete fake metro/city location rows whose names are just ZIP codes (e.g. "CA 90004", "90004") — phantom rows from the data import.',
    endpoint: '/api/admin/data-fix/delete-zip-locations',
    danger: true,
  },
  {
    key: 'delete-seed-providers',
    label: 'Delete seed providers',
    description: 'Permanently delete the hard-coded seed providers (Dr. Lena Park etc.) and their linked seed clinics.',
    endpoint: '/api/admin/data-fix/delete-seed-providers',
    danger: true,
  },
]

type FixState = {
  busy: boolean
  dryRunResult: { rowsAffected: number; sample: string[] } | null
  confirm: string
  msg: string
  msgType: 'ok' | 'err' | ''
}

function AdminDataFixPanel({ onAfterChange }: { onAfterChange: () => void }) {
  const [states, setStates] = useState<Record<string, FixState>>(() =>
    Object.fromEntries(DATA_FIX_OPS.map((op) => [
      op.key,
      { busy: false, dryRunResult: null, confirm: '', msg: '', msgType: '' },
    ])),
  )

  function update(key: string, patch: Partial<FixState>) {
    setStates((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  async function runDryRun(op: FixOp) {
    update(op.key, { busy: true, msg: '', msgType: '', dryRunResult: null })
    try {
      const res = await fetch(op.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Dry run failed.')
      update(op.key, {
        busy: false,
        dryRunResult: { rowsAffected: json.rowsAffected, sample: json.sample ?? [] },
        msg: json.rowsAffected === 0
          ? 'Nothing to fix — data is already clean.'
          : `Dry run: ${json.rowsAffected} rows would be affected.`,
        msgType: 'ok',
      })
    } catch (err: any) {
      update(op.key, { busy: false, msg: err?.message ?? 'Dry run failed.', msgType: 'err' })
    }
  }

  async function applyFix(op: FixOp) {
    const s = states[op.key]
    if (s.confirm !== 'FIX') {
      update(op.key, { msg: 'Type FIX in the field first.', msgType: 'err' })
      return
    }
    update(op.key, { busy: true, msg: '', msgType: '' })
    try {
      const res = await fetch(op.endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false, confirmation: 'FIX' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Fix failed.')
      update(op.key, {
        busy: false,
        dryRunResult: null,
        confirm: '',
        msg: `Done: ${json.rowsAffected} rows affected.`,
        msgType: 'ok',
      })
      onAfterChange()
    } catch (err: any) {
      update(op.key, { busy: false, msg: err?.message ?? 'Fix failed.', msgType: 'err' })
    }
  }

  return (
    <div style={{ ...box, borderLeft: '4px solid #C2A14E', marginBottom: 16 }}>
      <strong style={{ fontSize: 15 }}>Data fix tools</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        One-click fixes for common data quality issues. Always dry-run first to check what would change. Type <code>FIX</code> to apply.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {DATA_FIX_OPS.map((op) => {
          const s = states[op.key]
          const hasDryRun = s.dryRunResult !== null
          const canApply = hasDryRun && (s.dryRunResult?.rowsAffected ?? 0) > 0

          return (
            <div
              key={op.key}
              style={{
                border: `1px solid ${op.danger ? 'rgba(185,28,28,0.25)' : 'var(--theme-elevation-150, #e2e8f0)'}`,
                borderRadius: 8,
                padding: '12px 14px',
                background: op.danger ? 'rgba(185,28,28,0.04)' : 'var(--theme-elevation-50, #fff)',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: op.danger ? '#B91C1C' : 'inherit' }}>
                {op.label}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>{op.description}</div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  disabled={s.busy}
                  onClick={() => runDryRun(op)}
                  style={btn(s.busy)}
                >
                  {s.busy && !hasDryRun ? 'Running…' : 'Dry run (audit)'}
                </button>

                {canApply && (
                  <>
                    <input
                      type="text"
                      value={s.confirm}
                      onChange={(e) => update(op.key, { confirm: e.target.value })}
                      placeholder='type FIX to enable'
                      style={{ padding: '8px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--theme-elevation-150, #e2e8f0)', width: 160 }}
                    />
                    <button
                      type="button"
                      disabled={s.busy || s.confirm !== 'FIX'}
                      onClick={() => applyFix(op)}
                      style={btn(s.busy || s.confirm !== 'FIX', op.danger ? '#B91C1C' : '#3FA68A')}
                    >
                      {s.busy ? 'Applying…' : 'Apply fix'}
                    </button>
                  </>
                )}
              </div>

              {s.msg && (
                <p style={{ fontSize: 12, marginTop: 8, color: s.msgType === 'err' ? '#B91C1C' : '#475569' }}>{s.msg}</p>
              )}

              {hasDryRun && (s.dryRunResult?.sample ?? []).length > 0 && (
                <ul style={{ fontSize: 11, opacity: 0.75, margin: '6px 0 0', paddingLeft: 18, maxHeight: 120, overflow: 'auto' }}>
                  {s.dryRunResult!.sample.map((line, i) => <li key={i}>{line}</li>)}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Bulk import (combined or separate files, with dry-run preview) ────────────
function ImportPanel({ onAfterImport }: { onAfterImport: () => void }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Report | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [wasDryRun, setWasDryRun] = useState(false)

  async function submit(dryRun: boolean) {
    if (!formRef.current) return
    setBusy(true)
    setErrorMsg('')
    try {
      const fd = new FormData(formRef.current)
      fd.set('dryRun', dryRun ? 'true' : 'false')
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Import failed.'); setResult(null); return }
      setResult(json.report)
      setWasDryRun(json.report?.dryRun === true)
      if (!dryRun) onAfterImport()
    } catch {
      setErrorMsg('Network error during import.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Bulk import (CSV)</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Upload ONE combined CSV (with a <code>record_type</code> column), or separate clinics / providers /
        reviews / photos / Q&amp;A files (schema: <code>data/scraper-brief.md</code>). Existing rows update by id.
        Preview first with dry run, then commit.
      </div>
      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); submit(true) }}>
        <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
          <label style={{ fontSize: 13 }}>Combined CSV (record_type column)
            <input name="combined" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <div style={{ fontSize: 12, opacity: 0.6 }}>or separate files</div>
          <label style={{ fontSize: 13 }}>Clinics CSV
            <input name="clinics" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Providers CSV
            <input name="providers" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Reviews CSV
            <input name="reviews" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Photos CSV
            <input name="photos" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Q&amp;A CSV
            <input name="qa" type="file" accept=".csv" style={{ display: 'block', marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 13 }}>Batch label (optional)
            <input name="batch" type="text" placeholder="e.g. fake-2026-06" style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button type="submit" disabled={busy} style={btn(busy)}>
            {busy ? 'Working…' : 'Dry run (preview)'}
          </button>
          {wasDryRun && result && (
            <button type="button" disabled={busy} onClick={() => submit(false)} style={btn(busy, '#3FA68A')}>
              Commit import (write to database)
            </button>
          )}
        </div>
      </form>

      {errorMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{errorMsg}</p>}
      {result && <ReportView report={result} />}
    </div>
  )
}

function ReportView({ report }: { report: Report }) {
  return (
    <div style={{ marginTop: 16, fontSize: 13 }}>
      {report.dryRun && (
        <div style={{ fontWeight: 600, color: '#92710f', marginBottom: 8 }}>
          Dry run: nothing was written. Review below, then Commit.
        </div>
      )}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {(['clinics', 'providers', 'reviews', 'photos', 'qa'] as const).map((k) => (
          <span key={k}>
            {k}: <strong>{report[k].created}</strong> new, {report[k].updated} updated, {report[k].skipped} skipped
          </span>
        ))}
      </div>
      {(report.clinics.publishedCount > 0 || report.clinics.reviewCount > 0 || report.clinics.draftCount > 0) && (
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
          Clinics: {report.clinics.publishedCount} published · {report.clinics.reviewCount} sent to review · {report.clinics.draftCount} draft
        </div>
      )}
      {report.clinics.treatmentsAutoCreated?.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
          Auto-created treatments: {report.clinics.treatmentsAutoCreated.join(', ')}
        </div>
      )}
      {report.alerts.length > 0 && (
        <ul style={{ marginTop: 12, paddingLeft: 18, maxHeight: 240, overflow: 'auto' }}>
          {report.alerts.map((a, i) => (
            <li key={i} style={{ marginBottom: 4, color: a.severity === 'error' ? '#B91C1C' : a.severity === 'warning' ? '#92710f' : 'inherit' }}>
              [{a.severity}] {a.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Data tools: backup, re-scan, scoped wipe ─────────────────────────────────
function DataToolsPanel({ onAfterChange }: { onAfterChange: () => void }) {
  const [lastBackup, setLastBackup] = useState<{ file: string; mtime: string } | null | undefined>(undefined)
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState<string>('')

  // Wipe state
  const [scope, setScope] = useState<'directory' | 'state'>('directory')
  const [state, setState] = useState('CA')
  const [confirm, setConfirm] = useState('')
  const [wipePreview, setWipePreview] = useState<Record<string, number> | null>(null)
  const [wipeTotal, setWipeTotal] = useState<number | null>(null)

  async function loadLastBackup() {
    try {
      const res = await fetch('/api/admin/backup', { credentials: 'include' })
      const json = await res.json()
      setLastBackup(json.last ?? null)
    } catch {
      setLastBackup(null)
    }
  }
  useEffect(() => { loadLastBackup() }, [])

  async function doBackup() {
    setBusy('backup'); setMsg('')
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setMsg(json.error || 'Backup failed.')
      else { setMsg(`Backup written: ${json.file}`); loadLastBackup() }
    } catch { setMsg('Network error during backup.') } finally { setBusy('') }
  }

  async function doScan() {
    setBusy('scan'); setMsg('')
    try {
      const res = await fetch('/api/admin/scan', { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) setMsg(json.error || 'Scan failed.')
      else {
        const sev = json.bySeverity || {}
        setMsg(`Scan complete: ${json.upserted} alerts (error ${sev.error ?? 0}, warning ${sev.warning ?? 0}, info ${sev.info ?? 0}).`)
        onAfterChange()
      }
    } catch { setMsg('Network error during scan.') } finally { setBusy('') }
  }

  const expectedPhrase = scope === 'directory' ? 'WIPE DIRECTORY' : `WIPE STATE ${state.toUpperCase()}`

  async function wipe(dryRun: boolean) {
    setBusy(dryRun ? 'wipe-preview' : 'wipe'); setMsg('')
    try {
      const res = await fetch('/api/admin/wipe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, state: scope === 'state' ? state : undefined, dryRun, confirm: dryRun ? undefined : confirm }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Wipe failed.'); return }
      setWipePreview(json.result.counts)
      setWipeTotal(json.result.total)
      if (dryRun) {
        setMsg(`Dry run: ${json.result.total} rows would be deleted. Type the phrase and confirm to proceed.`)
      } else {
        setMsg(`Wipe complete: ${json.result.total} rows deleted. Backup: ${json.backupFile ?? 'n/a'}.`)
        setConfirm('')
        loadLastBackup()
        onAfterChange()
      }
    } catch { setMsg('Network error during wipe.') } finally { setBusy('') }
  }

  return (
    <div style={{ ...box, borderLeft: '4px solid #C2A14E' }}>
      <strong style={{ fontSize: 15 }}>Data tools</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Back up, re-scan integrity, and reset directory data (for the launch-day fake → real swap). Every action is admin-only and logged.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <button type="button" disabled={!!busy} onClick={doBackup} style={btn(busy === 'backup')}>
          {busy === 'backup' ? 'Backing up…' : 'Back up now'}
        </button>
        <button type="button" disabled={!!busy} onClick={doScan} style={btn(busy === 'scan')}>
          {busy === 'scan' ? 'Scanning…' : 'Re-scan alerts'}
        </button>
        <span style={{ fontSize: 12, opacity: 0.75 }}>
          {lastBackup === undefined ? 'Loading last backup…'
            : lastBackup === null ? 'No backup yet.'
            : `Last backup: ${new Date(lastBackup.mtime).toLocaleString()} (${lastBackup.file})`}
        </span>
      </div>

      <div style={{ border: '1px solid #B91C1C33', borderRadius: 8, padding: 14, background: '#B91C1C0a' }}>
        <strong style={{ fontSize: 14, color: '#B91C1C' }}>Wipe directory data (destructive)</strong>
        <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
          Deletes clinics, providers, reviews, photos, Q&amp;A, before/after, bookings, claims, promotions, and alerts.
          Preserves users, treatments, locations, guides, authors, reviewers, FAQs, media. An automatic backup is taken before any real wipe.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
          <label style={{ fontSize: 13 }}>Scope
            <select value={scope} onChange={(e) => { setScope(e.target.value as any); setWipePreview(null); setConfirm('') }} style={{ display: 'block', marginTop: 4, padding: '6px 8px' }}>
              <option value="directory">Directory (all)</option>
              <option value="state">By state</option>
            </select>
          </label>
          {scope === 'state' && (
            <label style={{ fontSize: 13 }}>State code
              <input value={state} onChange={(e) => { setState(e.target.value.toUpperCase()); setWipePreview(null); setConfirm('') }} maxLength={2} style={{ display: 'block', marginTop: 4, width: 70, padding: '6px 8px' }} />
            </label>
          )}
          <button type="button" disabled={!!busy} onClick={() => wipe(true)} style={btn(busy === 'wipe-preview')}>
            {busy === 'wipe-preview' ? 'Previewing…' : 'Preview wipe'}
          </button>
        </div>

        {wipePreview && (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{wipeTotal} rows in scope:</div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(wipePreview).map(([k, n]) => <span key={k}>{k}: <strong>{n}</strong></span>)}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13, flex: 1, minWidth: 240 }}>
            Type <code>{expectedPhrase}</code> to enable
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={expectedPhrase} style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
          </label>
          <button
            type="button"
            disabled={!!busy || confirm.trim() !== expectedPhrase}
            onClick={() => wipe(false)}
            style={btn(busy === 'wipe', '#B91C1C', confirm.trim() !== expectedPhrase)}
          >
            {busy === 'wipe' ? 'Wiping…' : 'Wipe now'}
          </button>
        </div>
      </div>

      {msg && <p style={{ fontSize: 13, marginTop: 12 }}>{msg}</p>}
    </div>
  )
}

const pill: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, textDecoration: 'none',
  padding: '8px 14px', borderRadius: 999,
  background: 'var(--theme-elevation-100, #f1f5f9)', color: 'inherit',
}

function btn(busy: boolean, bg = '#0B1B34', disabled = false): React.CSSProperties {
  const off = busy || disabled
  return {
    padding: '9px 18px', borderRadius: 999, border: 'none', cursor: off ? 'default' : 'pointer',
    background: bg, color: '#fff', fontSize: 13, fontWeight: 600, opacity: off ? 0.55 : 1,
  }
}

function QuickAction({ href, label, external }: { href: string; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      style={{
        fontSize: 13, fontWeight: 600, textDecoration: 'none',
        padding: '9px 14px', borderRadius: 8,
        background: 'var(--theme-elevation-100, #f1f5f9)',
        border: '1px solid var(--theme-elevation-150, #e2e8f0)',
        color: 'var(--theme-text, #0B1B34)',
      }}
    >
      {label}
    </a>
  )
}

// ── Shared content import helper ─────────────────────────────────────────────
type SingleCollectionReport = {
  collection: string
  items: { created: number; updated: number; skipped: number }
  alerts: Array<{ severity: string; type: string; message: string }>
  dryRun?: boolean
  batch?: string
}

function ContentImportPanel({
  collection,
  label,
  onAfterImport,
}: {
  collection: 'news' | 'guides'
  label: string
  onAfterImport: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const batchRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SingleCollectionReport | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [wasDryRun, setWasDryRun] = useState(false)

  async function submit(dryRun: boolean) {
    const file = fileRef.current?.files?.[0]
    if (!file) { setErrorMsg('Select a JSON file first.'); return }
    setBusy(true); setErrorMsg('')
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('collection', collection)
      fd.set('dryRun', dryRun ? 'true' : 'false')
      const batch = batchRef.current?.value.trim()
      if (batch) fd.set('batch', batch)
      const res = await fetch('/api/admin/content-import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setErrorMsg(json.error || 'Import failed.'); setResult(null); return }
      setResult(json.report)
      setWasDryRun(json.report?.dryRun === true)
      if (!dryRun) onAfterImport()
    } catch {
      setErrorMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>{label} — bulk import (JSON)</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Upload an AI-generated JSON file. Items land as <em>imported</em> (private, 404 on site).
        Dry run first to check counts and warnings, then commit.
      </div>
      <div style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
        <label style={{ fontSize: 13 }}>JSON file
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'block', marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 13 }}>Batch label (optional — helps you find these later)
          <input ref={batchRef} type="text" placeholder={`e.g. ai-${collection}-2026-06`} style={{ display: 'block', marginTop: 4, width: '100%', padding: '6px 8px' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" disabled={busy} onClick={() => submit(true)} style={btn(busy)}>
          {busy ? 'Working…' : 'Dry run (preview)'}
        </button>
        {wasDryRun && result && (
          <button type="button" disabled={busy} onClick={() => submit(false)} style={btn(busy, '#3FA68A')}>
            Commit import (write to DB)
          </button>
        )}
      </div>
      {errorMsg && <p style={{ color: '#B91C1C', fontSize: 13, marginTop: 10 }}>{errorMsg}</p>}
      {result && (
        <div style={{ marginTop: 14, fontSize: 13 }}>
          {result.dryRun && (
            <div style={{ fontWeight: 600, color: '#92710f', marginBottom: 8 }}>
              Dry run only — nothing written yet. Review, then Commit.
            </div>
          )}
          {result.batch && <div style={{ opacity: 0.7, marginBottom: 6 }}>Batch: <code>{result.batch}</code></div>}
          <div style={{ marginBottom: 8 }}>
            <strong>{result.items.created}</strong> new, {result.items.updated} updated, {result.items.skipped} skipped
          </div>
          {result.alerts.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 220, overflow: 'auto' }}>
              {result.alerts.map((a, i) => (
                <li key={i} style={{ marginBottom: 4, color: a.severity === 'error' ? '#B91C1C' : a.severity === 'warning' ? '#92710f' : 'inherit' }}>
                  [{a.severity}] {a.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── Content review: see each item, select, approve ────────────────────────────
type ReviewItem = {
  id: number
  title: string
  slug: string
  reviewStatus: string
  importBatch: string | null
  createdAt: string
  category: string | null
  excerpt: string | null
}

function ContentReviewPanel() {
  const [tab, setTab] = useState<'guides' | 'news'>('guides')
  const [items, setItems] = useState<ReviewItem[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pendingCounts, setPendingCounts] = useState<{ news: number; guides: number } | null>(null)
  const [noindexCounts, setNoindexCounts] = useState<{ news: number; guides: number } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadItems(collection: 'guides' | 'news', p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/content-approve?collection=${collection}&page=${p}`, { credentials: 'include' })
      const json = await res.json()
      setItems(json.items ?? [])
      setTotalItems(json.totalItems ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setPendingCounts(json.pending ?? null)
      setNoindexCounts(json.approvedNoindex ?? null)
      setSelected(new Set())
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); loadItems(tab, 1) }, [tab])

  function toggleItem(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map((i) => i.id)))
    }
  }

  async function approveSelected() {
    if (selected.size === 0) { setMsg('Select at least one item.'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/content-approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: tab, ids: Array.from(selected) }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Approve failed.'); return }
      setMsg(`${json.approved} item${json.approved === 1 ? '' : 's'} approved. They are now live but noindex.`)
      loadItems(tab, page)
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  return (
    <div id="content-review" style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>Content review</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 10px' }}>
        Imported items are private until approved. After approval they go live but noindex (Google cannot crawl them yet). Use Drip indexer below to let them in gradually.
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'var(--theme-elevation-100, #f8fafc)', borderRadius: 6 }}>
        <span>Pending review: <strong>{pendingCounts ? pendingCounts.guides : '–'}</strong> guides, <strong>{pendingCounts ? pendingCounts.news : '–'}</strong> news</span>
        <span>Approved (noindex): <strong>{noindexCounts ? noindexCounts.guides : '–'}</strong> guides, <strong>{noindexCounts ? noindexCounts.news : '–'}</strong> news</span>
      </div>

      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        <button type="button" style={tabStyle(tab === 'guides')} onClick={() => setTab('guides')}>Guides</button>
        <button type="button" style={tabStyle(tab === 'news')} onClick={() => setTab('news')}>News</button>
      </div>

      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>No pending items in {tab}.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={selectAll} />
              Select all on this page ({items.length})
            </label>
            <span style={{ opacity: 0.6 }}>{totalItems} total pending</span>
          </div>

          <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {items.map((item, idx) => (
              <label
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  cursor: 'pointer', fontSize: 13,
                  background: selected.has(item.id) ? 'rgba(63,166,138,0.12)' : idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                  borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
                }}
              >
                <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleItem(item.id)} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ opacity: 0.65, fontSize: 12 }}>
                    /{tab === 'guides' ? 'guides' : 'news'}/{item.slug}
                    {item.category ? ` · ${item.category}` : ''}
                    {item.importBatch ? ` · batch: ${item.importBatch}` : ''}
                    {' · '}{new Date(item.createdAt).toLocaleDateString()}
                  </div>
                  {item.excerpt && (
                    <div style={{ opacity: 0.75, fontSize: 12, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.excerpt}
                    </div>
                  )}
                </div>
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  background: item.reviewStatus === 'in-review' ? 'rgba(234,179,8,0.15)' : 'var(--theme-elevation-150, #e2e8f0)',
                  color: item.reviewStatus === 'in-review' ? 'var(--theme-text, #92710f)' : 'var(--theme-text, #475569)',
                }}>
                  {item.reviewStatus}
                </span>
              </label>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <button type="button" disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); loadItems(tab, p) }} style={btn(page === 1)}>Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => { const p = page + 1; setPage(p); loadItems(tab, p) }} style={btn(page === totalPages)}>Next</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" disabled={busy || selected.size === 0} onClick={approveSelected} style={btn(busy || selected.size === 0, '#3FA68A')}>
              {busy ? 'Approving…' : `Approve selected (${selected.size})`}
            </button>
            {selected.size > 0 && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                Will be published but noindex. Google cannot crawl until you drip-index.
              </span>
            )}
          </div>
        </>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

// ── Drip indexer: see the queue, then index N items ───────────────────────────
type DripItem = { id: number; title: string; slug: string; approvedAt: string; category: string | null }

function DripIndexPanel() {
  const [tab, setTab] = useState<'guides' | 'news'>('guides')
  const [queue, setQueue] = useState<DripItem[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [count, setCount] = useState('5')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadQueue(collection: 'guides' | 'news') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/drip-index?collection=${collection}`, { credentials: 'include' })
      const json = await res.json()
      setQueue(json.items ?? [])
      setRemaining(json.remaining ?? null)
    } catch {
      setQueue([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadQueue(tab) }, [tab])

  async function dripIndex() {
    const n = Math.max(1, parseInt(count, 10) || 5)
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/drip-index', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection: tab, count: n }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Drip failed.'); return }
      setMsg(json.message || `${json.indexed} items indexed.`)
      loadQueue(tab)
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  return (
    <div id="drip-index" style={{ ...box, borderLeft: '4px solid #3FA68A' }}>
      <strong style={{ fontSize: 15 }}>Drip indexer</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 14px' }}>
        Flip the oldest approved+noindex items to indexed so Google can crawl them. Aim for 5-10 per day per collection to avoid a sudden mass-index signal. CLI: <code>npm run drip:index -- guides --count=5</code>
      </div>

      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        <button type="button" style={tabStyle(tab === 'guides')} onClick={() => setTab('guides')}>Guides</button>
        <button type="button" style={tabStyle(tab === 'news')} onClick={() => setTab('news')}>News</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
          {remaining === null ? 'Loading queue…' : `${remaining} item${remaining === 1 ? '' : 's'} waiting to be indexed (oldest first):`}
        </div>
        {loading ? (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Loading…</div>
        ) : queue.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.6 }}>Queue is empty — nothing to index.</div>
        ) : (
          <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden' }}>
            {queue.slice(0, 10).map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', fontSize: 13,
                  background: idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                  borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
                }}
              >
                <span style={{ flexShrink: 0, fontWeight: 700, color: '#94A3B8', width: 22, textAlign: 'right' }}>{idx + 1}.</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    /{tab === 'guides' ? 'guides' : 'news'}/{item.slug}
                    {item.category ? ` · ${item.category}` : ''}
                    {' · approved '}{new Date(item.approvedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
            {queue.length > 10 && (
              <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6, borderTop: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>
                +{queue.length - 10} more (showing first 10 of {remaining})
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ fontSize: 13 }}>How many to index now
          <input
            type="number" min={1} max={100} value={count}
            onChange={(e) => setCount(e.target.value)}
            style={{ display: 'block', marginTop: 4, width: 80, padding: '6px 8px' }}
          />
        </label>
        <button type="button" disabled={busy || queue.length === 0} onClick={dripIndex} style={btn(busy || queue.length === 0, '#3FA68A')}>
          {busy ? 'Indexing…' : `Index oldest ${Math.min(parseInt(count, 10) || 5, remaining ?? 0)}`}
        </button>
      </div>
      {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

// ── Review Moderation panel ───────────────────────────────────────────────────
type PendingReview = {
  id: number
  reviewId: string
  reviewerFirstName: string | null
  reviewerInitial: string | null
  rating: number
  reviewTitle: string | null
  reviewText: string
  treatmentTag: string | null
  sourcePlatform: string | null
  sourceUrl: string | null
  reviewDate: string | null
  importBatch: string | null
  moderationStatus: string
  clinic: { id: number; clinicName: string } | null
  provider: { id: number; fullName: string } | null
  createdAt: string
}

type ReviewCounts = { pending: number; approved: number; rejected: number }

function ReviewModerationPanel({ onAfterChange }: { onAfterChange: () => void }) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [reviews, setReviews] = useState<PendingReview[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<ReviewCounts | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function load(status: string, p: number) {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/review-moderate?status=${status}&page=${p}`, { credentials: 'include' })
      const json = await res.json()
      setReviews(json.items ?? [])
      setTotalItems(json.totalItems ?? 0)
      setTotalPages(json.totalPages ?? 1)
      setCounts(json.counts ?? null)
      setSelected(new Set())
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); load(tab, 1) }, [tab])

  function toggleItem(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(selected.size === reviews.length ? new Set() : new Set(reviews.map((r) => r.id)))
  }

  async function moderate(action: 'approved' | 'rejected') {
    if (selected.size === 0) { setMsg('Select at least one review.'); return }
    setBusy(true); setMsg('')
    try {
      const res = await fetch('/api/admin/review-moderate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), action }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Moderation failed.'); return }
      setMsg(`${json.moderated} review${json.moderated === 1 ? '' : 's'} ${action}.`)
      load(tab, page)
      onAfterChange()
    } catch {
      setMsg('Network error.')
    } finally {
      setBusy(false)
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    borderBottom: active ? '2px solid #3FA68A' : '2px solid transparent',
    background: 'none', color: active ? '#3FA68A' : 'inherit', marginBottom: -1,
  })

  function stars(n: number) {
    return '★'.repeat(Math.max(0, Math.min(5, n))) + '☆'.repeat(Math.max(0, 5 - n))
  }

  return (
    <div style={{ ...box, borderLeft: '4px solid #C2A14E' }}>
      <strong style={{ fontSize: 15 }}>Review moderation</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 12px' }}>
        CSV-imported reviews land as <strong>Pending</strong> and are hidden from the public until approved here.
        Approve to make a review visible, reject to suppress it permanently.
      </div>

      {counts && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13, marginBottom: 14, padding: '10px 14px', background: 'var(--theme-elevation-100, #f8fafc)', borderRadius: 6 }}>
          <span>Pending: <strong style={{ color: counts.pending > 0 ? '#C2A14E' : 'inherit' }}>{counts.pending}</strong></span>
          <span>Approved: <strong style={{ color: '#3FA68A' }}>{counts.approved}</strong></span>
          <span>Rejected: <strong style={{ color: '#B91C1C' }}>{counts.rejected}</strong></span>
        </div>
      )}

      <div style={{ borderBottom: '1px solid var(--theme-elevation-150, #e2e8f0)', marginBottom: 14, display: 'flex', gap: 4 }}>
        {(['pending', 'approved', 'rejected'] as const).map((t) => (
          <button key={t} type="button" style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}{counts ? ` (${counts[t]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>Loading…</div>
      ) : reviews.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6, padding: '8px 0' }}>No {tab} reviews.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 600 }}>
              <input type="checkbox" checked={selected.size === reviews.length && reviews.length > 0} onChange={selectAll} />
              Select all on this page ({reviews.length})
            </label>
            <span style={{ opacity: 0.6 }}>{totalItems} total</span>
          </div>

          <div style={{ border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
            {reviews.map((r, idx) => (
              <label
                key={r.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  cursor: 'pointer', fontSize: 13,
                  background: selected.has(r.id) ? 'rgba(63,166,138,0.10)' : idx % 2 === 0 ? 'var(--theme-elevation-50, #fff)' : 'var(--theme-elevation-100, #f8fafc)',
                  borderTop: idx > 0 ? '1px solid var(--theme-elevation-150, #e2e8f0)' : 'none',
                }}
              >
                <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleItem(r.id)} style={{ marginTop: 3, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#C2A14E', letterSpacing: '-0.02em' }}>{stars(r.rating)}</span>
                    <span style={{ fontWeight: 600 }}>
                      {r.reviewerFirstName ?? 'Anonymous'}{r.reviewerInitial ? ` ${r.reviewerInitial}.` : ''}
                    </span>
                    {r.clinic && <span style={{ opacity: 0.65 }}>at {r.clinic.clinicName}</span>}
                    {r.provider && <span style={{ opacity: 0.65 }}>for {r.provider.fullName}</span>}
                  </div>
                  {r.reviewTitle && <div style={{ fontWeight: 500, marginBottom: 2 }}>{r.reviewTitle}</div>}
                  <div style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.reviewText}
                  </div>
                  <div style={{ opacity: 0.55, fontSize: 12, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {r.treatmentTag && <span>{r.treatmentTag}</span>}
                    {r.sourcePlatform && <span>{r.sourcePlatform}</span>}
                    {r.reviewDate && <span>{new Date(r.reviewDate).toLocaleDateString()}</span>}
                    {r.importBatch && <span>batch: {r.importBatch}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
              <button type="button" disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); load(tab, p) }} style={btn(page === 1)}>Prev</button>
              <span>Page {page} / {totalPages}</span>
              <button type="button" disabled={page === totalPages} onClick={() => { const p = page + 1; setPage(p); load(tab, p) }} style={btn(page === totalPages)}>Next</button>
            </div>
          )}

          {tab === 'pending' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" disabled={busy || selected.size === 0} onClick={() => moderate('approved')} style={btn(busy || selected.size === 0, '#3FA68A')}>
                {busy ? 'Working…' : `Approve selected (${selected.size})`}
              </button>
              <button type="button" disabled={busy || selected.size === 0} onClick={() => moderate('rejected')} style={btn(busy || selected.size === 0, '#B91C1C')}>
                {busy ? 'Working…' : `Reject selected (${selected.size})`}
              </button>
              {selected.size > 0 && <span style={{ fontSize: 12, opacity: 0.7 }}>Approved reviews are immediately public.</span>}
            </div>
          )}
          {tab !== 'pending' && selected.size > 0 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" disabled={busy} onClick={() => moderate(tab === 'approved' ? 'rejected' : 'approved')} style={btn(busy, tab === 'approved' ? '#B91C1C' : '#3FA68A')}>
                {tab === 'approved' ? `Reject selected (${selected.size})` : `Re-approve selected (${selected.size})`}
              </button>
            </div>
          )}
        </>
      )}

      {msg && <p style={{ fontSize: 13, marginTop: 10 }}>{msg}</p>}
    </div>
  )
}

const HELP: Array<[string, string]> = [
  ['Import directory data', 'Use Bulk import. Upload one combined CSV (record_type column) or separate files. Dry run previews counts and alerts; Commit writes. Existing rows update by id; problems become data alerts.'],
  ['Back up / restore', 'Data tools → Back up now writes a timestamped dump. Restore from a terminal with npm run db:restore. A backup is taken automatically before any wipe.'],
  ['Wipe + reload (launch swap)', 'Data tools → Wipe directory data clears the fake directory so you can import real data. Preview first, then type the confirmation phrase. Users, treatments, locations, and guides are preserved.'],
  ['Set a market live', 'Open Manage markets (Locations), find the state or city, turn on "Market is live" and turn off "Hide from search engines". The public site updates within a minute.'],
  ['Run a promotion', 'Promotions has three types. Sponsored cards and organic pins need a provider. Ad banners need an image and a link. Slot limits are enforced so you cannot oversell.'],
  ['Action a lead', 'New bookings show in the New leads card. Open the booking, read the request, then set its status to confirmed or completed.'],
  ['Clear an alert', 'Data Alerts lists what is wrong with the data. Fix the underlying record, then click Re-scan alerts or mark the alert resolved.'],
  ['Import AI content (guides/news)', 'Content import: upload a JSON file matching ContentImportPayload. Items arrive as "imported" (not public, 404 on site). Dry run previews first. After commit, use Content review to approve.'],
  ['Approve content', 'Content review: approving sets reviewStatus=approved and makes the page public. The page emits noindex so Google ignores it. Items sit here until drip-indexed.'],
  ['Drip indexing', 'Drip indexer: flips oldest approved+noindex items to indexed (Google can crawl them). Run 5-10 per day per collection. CLI: npm run drip:index -- guides --count=5.'],
]

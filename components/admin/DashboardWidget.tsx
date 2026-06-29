'use client'

import { useEffect, useState } from 'react'
import { BranchSuggestions } from './BranchSuggestions'
import { DashboardNewsletterPanel } from './DashboardNewsletterPanel'
import { DashboardNewsSendPanel } from './DashboardNewsSendPanel'


const box: React.CSSProperties = {
  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
  borderRadius: 8,
  padding: 20,
  marginBottom: 16,
  background: 'var(--theme-elevation-50, #fff)',
}

const ALERTS_OPEN = '/admin/collections/data-alerts?where[or][0][and][0][status][equals]=open'
const LEADS_NEW = '/admin/collections/bookings?where[or][0][and][0][status][equals]=new'

type BulkUploadCollection = 'clinics' | 'reviews' | 'news' | 'guides'

type BulkUploadItem = {
  id: number
  stableId: string
  label: string
  status: string
}

type BulkUploadReport = {
  collection: BulkUploadCollection
  batch: string
  total: number
  created: number
  updated: number
  skipped: number
  skippedUnmatched: number
  failed: number
  aggregateUpdates?: number
  errors: Array<{ line: number; stableId?: string; reason: string }>
  items: BulkUploadItem[]
}

const BULK_UPLOAD_COLLECTIONS: Array<{ key: BulkUploadCollection; label: string }> = [
  { key: 'clinics', label: 'Clinics' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'news', label: 'News' },
  { key: 'guides', label: 'Guides' },
]

// -- Collapsible section wrapper --------------------------------------------
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

// -- Top stats bar (6 cards per spec) ---------------------------------------
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
      value: totalProviders === null ? '-' : totalProviders,
      href: '/admin/collections/providers',
      accent: false,
    },
    {
      label: 'Active clinics',
      value: totalClinics === null ? '-' : totalClinics,
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
      value: activePromotions === null ? '-' : activePromotions,
      href: '/admin/collections/promotions',
      accent: false,
    },
    {
      label: 'Unactioned leads',
      value: unactionedLeads === null ? '-' : unactionedLeads,
      href: LEADS_NEW,
      accent: (unactionedLeads ?? 0) > 0 ? '#C2A14E' : false,
    },
    {
      label: 'Live markets',
      value: liveMarkets === null ? '-' : liveMarkets,
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

// -- Promotions Coverage Map ------------------------------------------------
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
  const [activeTab, setActiveTab] = useState<'services' | 'find'>('services')
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
          fetch('/api/services?limit=100&depth=0&sort=name', { credentials: 'include' }).then(r => r.json()),
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
        if (activeTab === 'services') {
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
        <button type="button" style={tabBtn(activeTab === 'services')} onClick={() => { setActiveTab('services'); setSelected(null) }}>Services path</button>
        <button type="button" style={tabBtn(activeTab === 'find')} onClick={() => { setActiveTab('find'); setSelected(null) }}>Find path</button>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: selected ? 0 : 8 }}>
        {activeTab === 'services' ? (
          <table style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>Treatment</th>
                {states.map(s => (
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
                  {states.map(s => {
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
  const [alertCritical, setAlertCritical] = useState<number>(0)
  const [alertWarning, setAlertWarning] = useState<number>(0)
  const [alertInfo, setAlertInfo] = useState<number>(0)
  const [newBookings, setNewBookings] = useState<number | null>(null)
  const [oldestBooking, setOldestBooking] = useState<string | null>(null)
  const [pendingClaims, setPendingClaims] = useState<number>(0)
  const [confirmedSubs, setConfirmedSubs] = useState<number>(0)
  const [totalProviders, setTotalProviders] = useState<number | null>(null)
  const [totalClinics, setTotalClinics] = useState<number | null>(null)
  const [activePromotions, setActivePromotions] = useState<number | null>(null)
  const [liveMarkets, setLiveMarkets] = useState<number | null>(null)

  async function loadAlertCounts() {
    try {
      const [errRes, warnRes, infoRes] = await Promise.all([
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=error&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=warning&limit=1&depth=0', { credentials: 'include' }),
        fetch('/api/data-alerts?where[and][0][status][equals]=open&where[and][1][severity][equals]=info&limit=1&depth=0', { credentials: 'include' }),
      ])
      const [errJson, warnJson, infoJson] = await Promise.all([
        errRes.json(), warnRes.json(), infoRes.json(),
      ])
      setAlertCritical(errJson.totalDocs ?? 0)
      setAlertWarning(warnJson.totalDocs ?? 0)
      setAlertInfo(infoJson.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  async function loadPendingClaims() {
    try {
      const res = await fetch('/api/claims?where[status][equals]=new&limit=1&depth=0', { credentials: 'include' })
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
      const res = await fetch('/api/subscribers?where[status][equals]=confirmed&limit=1&depth=0', { credentials: 'include' })
      const json = await res.json()
      setConfirmedSubs(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  // Each count is fetched and settled independently so one slow collection
  // (e.g. clinics, ~13k rows) can never block the other three cards.
  async function loadCount(
    url: string,
    setter: (n: number) => void,
  ) {
    try {
      const res = await fetch(url, { credentials: 'include' })
      const json = await res.json()
      setter(json.totalDocs ?? 0)
    } catch { /* non-fatal */ }
  }

  function loadStats() {
    loadCount('/api/providers?limit=1&depth=0', setTotalProviders)
    loadCount('/api/clinics?limit=1&depth=0', setTotalClinics)
    loadCount('/api/promotions?where[status][equals]=active&limit=1&depth=0', setActivePromotions)
    loadCount(
      '/api/locations?where[and][0][kind][equals]=state&where[and][1][isLive][equals]=true&limit=1&depth=0',
      setLiveMarkets,
    )
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


      {/* -- Leads & Claims ----------------------------------------------- */}
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

      </Section>

      {/* -- Broadcast ---------------------------------------------------- */}
      <Section title="Broadcast" defaultOpen={false}>
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

      {/* -- Data Tools & Danger Zone ------------------------------------- */}
      <Section title="Data Tools & Danger Zone" id="data-tools" defaultOpen={false} danger>
        <BranchSuggestions onAfterChange={loadAlertCounts} />
        <DataToolsPanel onAfterChange={loadAlertCounts} />
      </Section>
    </div>
  )
}

// -- Data tools: backup, re-scan, scoped wipe -------------------------------
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
        <BulkUploadManager onAfterChange={onAfterChange} />
      </div>

      <div style={{ border: '1px solid #B91C1C33', borderRadius: 8, padding: 14, background: '#B91C1C0a' }}>
        <strong style={{ fontSize: 14, color: '#B91C1C' }}>Wipe directory data (destructive)</strong>
        <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
          Deletes clinics, providers, reviews, photos, Q&amp;A, before/after, bookings, claims, promotions, and alerts.
          Preserves users, services, locations, guides, authors, reviewers, FAQs, media. An automatic backup is taken before any real wipe.
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

function BulkUploadManager({ onAfterChange }: { onAfterChange: () => void }) {
  const [files, setFiles] = useState<Partial<Record<BulkUploadCollection, File>>>({})
  const [reports, setReports] = useState<Partial<Record<BulkUploadCollection, BulkUploadReport>>>({})
  const [busy, setBusy] = useState<string>('')
  const [msg, setMsg] = useState('')

  async function upload(collection: BulkUploadCollection) {
    const file = files[collection]
    if (!file) {
      setMsg(`Select a ${collection} CSV first.`)
      return
    }
    setBusy(`upload:${collection}`)
    setMsg('')
    try {
      const fd = new FormData()
      fd.set('collection', collection)
      fd.set('file', file)
      const res = await fetch('/api/admin/import', { method: 'POST', body: fd, credentials: 'include' })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Upload failed.')
        return
      }
      setReports((prev) => ({ ...prev, [collection]: json.report as BulkUploadReport }))
      setMsg(`${collection} upload staged. Review the summary, then approve when ready.`)
      onAfterChange()
    } catch {
      setMsg('Network error during upload.')
    } finally {
      setBusy('')
    }
  }

  async function approve(collection: BulkUploadCollection, opts: { batch?: string; id?: number }) {
    setBusy(opts.id ? `approve:${collection}:${opts.id}` : `approve:${collection}`)
    setMsg('')
    try {
      const res = await fetch('/api/admin/import/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          batch: opts.batch,
          ids: opts.id ? [opts.id] : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(json.error || 'Approve failed.')
        return
      }
      const report = reports[collection]
      if (report && json.report?.items) {
        setReports((prev) => ({
          ...prev,
          [collection]: {
            ...report,
            items: json.report.items as BulkUploadItem[],
            aggregateUpdates: json.report.aggregateUpdates ?? report.aggregateUpdates,
          },
        }))
      }
      const approved = json.report?.approved ?? 0
      const aggregates = json.report?.aggregateUpdates ? ` Aggregate rows updated: ${json.report.aggregateUpdates}.` : ''
      setMsg(`Approved ${approved} ${collection} item${approved === 1 ? '' : 's'}.${aggregates}`)
      onAfterChange()
    } catch {
      setMsg('Network error during approval.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <strong style={{ fontSize: 14, color: '#0B1B34' }}>Bulk CSV upload and approval</strong>
      <div style={{ fontSize: 12, opacity: 0.8, margin: '4px 0 12px' }}>
        Uploads stage as draft or pending only. Publish requires an explicit approval step. Indexing stays off by default.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
        {BULK_UPLOAD_COLLECTIONS.map(({ key, label }) => {
          const report = reports[key]
          const isUploading = busy === `upload:${key}`
          const isApproving = busy === `approve:${key}`
          return (
            <div key={key} style={{ border: '1px solid #0B1B341f', borderRadius: 8, padding: 12, background: '#fff' }}>
              <strong style={{ fontSize: 13 }}>{label}</strong>
              <div style={{ marginTop: 8 }}>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFiles((prev) => ({ ...prev, [key]: e.target.files?.[0] }))}
                  style={{ fontSize: 12, maxWidth: '100%' }}
                />
              </div>
              <button type="button" disabled={!!busy} onClick={() => upload(key)} style={{ ...btn(isUploading, '#3FA68A'), marginTop: 8 }}>
                {isUploading ? 'Uploading...' : 'Upload and stage'}
              </button>

              {report && (
                <div style={{ marginTop: 10, fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>Batch {report.batch}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 4, marginTop: 6 }}>
                    <span>Total: <strong>{report.total}</strong></span>
                    <span>Created: <strong>{report.created}</strong></span>
                    <span>Updated: <strong>{report.updated}</strong></span>
                    <span>Skipped: <strong>{report.skipped + report.skippedUnmatched}</strong></span>
                    <span>Failed: <strong>{report.failed}</strong></span>
                    {report.aggregateUpdates !== undefined && <span>Aggregates: <strong>{report.aggregateUpdates}</strong></span>}
                  </div>

                  {report.errors.length > 0 && (
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer' }}>Validation errors ({report.errors.length} shown)</summary>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
                        {report.errors.slice(0, 8).map((error, index) => (
                          <li key={`${error.line}-${index}`}>
                            line {error.line}{error.stableId ? ` (${error.stableId})` : ''}: {error.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => approve(key, { batch: report.batch })}
                    style={{ ...btn(isApproving, '#0B1B34'), marginTop: 10 }}
                  >
                    {isApproving ? 'Approving...' : 'Approve all staged'}
                  </button>

                  {report.items.length > 0 && (
                    <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                      {report.items.slice(0, 6).map((item) => {
                        const itemBusy = busy === `approve:${key}:${item.id}`
                        return (
                          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.label} <span style={{ opacity: 0.65 }}>({item.status})</span>
                            </span>
                            <button type="button" disabled={!!busy} onClick={() => approve(key, { id: item.id })} style={btn(itemBusy, '#3FA68A')}>
                              {itemBusy ? '...' : 'Approve'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {msg && <p style={{ fontSize: 13, margin: '12px 0 0' }}>{msg}</p>}
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


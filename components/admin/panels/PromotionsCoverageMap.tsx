'use client'

import { useEffect, useState } from 'react'
import { box } from '../ui/styles'

// -- Promotions Coverage Map ------------------------------------------------
type CoveragePromo = {
  id: string
  title: string
  scope: string
  placement: string
  status: string
  endDate?: string
  service?: string
  state?: string
  city?: string
}

function scopeLabel(
  p: CoveragePromo,
  services: Array<{ id: string; name: string; slug: string }>,
  states: Array<{ id: string; name: string; slug: string }>,
): string {
  const svc = services.find((s) => s.id === p.service || s.slug === p.service)
  const st = states.find((s) => s.id === p.state || s.slug === p.state)
  switch (p.scope) {
    case 'national': return 'National'
    case 'service': return svc ? svc.name : 'Service'
    case 'state': return st ? st.name : 'State'
    case 'city': return p.city ? `City (${p.city})` : 'City'
    case 'service+state': return svc && st ? `${svc.name} × ${st.name}` : 'Service + State'
    case 'service+city': return svc ? `${svc.name} × City` : 'Service + City'
    case 'zip': return 'ZIP radius'
    case 'service+zip': return svc ? `${svc.name} × ZIP radius` : 'Service + ZIP radius'
    default: return p.scope
  }
}

export function PromotionsCoverageMap() {
  const [activeTab, setActiveTab] = useState<'services' | 'find'>('services')
  const [promos, setPromos] = useState<CoveragePromo[]>([])
  const [services, setServices] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [states, setStates] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ scope: string; label: string } | null>(null)
  const [showGrid, setShowGrid] = useState(false)

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
        setServices((treatRes.docs ?? []).map((t: any) => ({ id: String(t.id), name: t.name, slug: t.slug })))
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
          return p.scope === 'service' || p.scope === 'service+state' || p.scope === 'service+city'
        }
        return p.scope === 'state' || p.scope === 'city' || p.scope === 'national'
      })
    : []

  const sevenDaysOut = new Date(Date.now() + 7 * 86400000).toISOString()
  const expiringCount = promos.filter((p) => p.endDate && p.endDate < sevenDaysOut).length
  const sortedPromos = [...promos].sort((a, b) => {
    const aExp = a.endDate && a.endDate < sevenDaysOut ? 0 : 1
    const bExp = b.endDate && b.endDate < sevenDaysOut ? 0 : 1
    if (aExp !== bExp) return aExp - bExp
    return (a.endDate ?? '').localeCompare(b.endDate ?? '')
  })

  return (
    <div style={box}>
      <strong style={{ fontSize: 15 }}>Promotions coverage map</strong>
      <div style={{ fontSize: 13, opacity: 0.8, margin: '4px 0 12px' }}>
        {promos.length} active promotion{promos.length === 1 ? '' : 's'}
        {expiringCount > 0 ? `, ${expiringCount} expiring within 7 days` : ''}.
      </div>

      {promos.length > 0 ? (
        <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sortedPromos.map((p) => {
            const expiring = !!(p.endDate && p.endDate < sevenDaysOut)
            return (
              <li
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6,
                  background: expiring ? '#FEF3C7' : 'var(--theme-elevation-50, #fff)',
                  border: '1px solid var(--theme-elevation-150, #e2e8f0)',
                }}
              >
                <a href={`/admin/collections/promotions/${p.id}`} style={{ color: 'inherit', fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.title}
                </a>
                <span style={{ fontSize: 12, opacity: 0.65, flexShrink: 0 }}>{scopeLabel(p, services, states)}</span>
                <span style={{ fontSize: 11, opacity: 0.5, flexShrink: 0 }}>{p.placement}</span>
                {expiring && <span style={{ fontSize: 11, color: '#92400E', fontWeight: 700, flexShrink: 0 }}>ends soon</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.6, margin: '0 0 12px' }}>No active promotions.</p>
      )}

      <button
        type="button"
        onClick={() => setShowGrid((v) => !v)}
        style={{ fontSize: 12, fontWeight: 600, color: '#3FA68A', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: showGrid ? 14 : 0 }}
      >
        {showGrid ? '▲ Hide coverage grid' : '▼ Show coverage grid'}
      </button>

      {showGrid && (
        <>
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
                <th style={{ padding: '6px 10px', textAlign: 'left', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>Service</th>
                {states.map(s => (
                  <th key={s.id} style={{ padding: '6px 8px', textAlign: 'center', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)', whiteSpace: 'nowrap' }}>
                    {s.name.length > 6 ? s.name.slice(0, 6) + '.' : s.name}
                  </th>
                ))}
                <th style={{ padding: '6px 8px', textAlign: 'center', background: 'var(--theme-elevation-100, #f1f5f9)', border: '1px solid var(--theme-elevation-150, #e2e8f0)' }}>All</th>
              </tr>
            </thead>
            <tbody>
              {services.map(t => (
                <tr key={t.id}>
                  <td style={{ padding: '5px 10px', border: '1px solid var(--theme-elevation-150, #e2e8f0)', whiteSpace: 'nowrap' }}>{t.name}</td>
                  {states.map(s => {
                    const { count, expiringSoon, promos: matched } = countPromos(
                      p => (p.service === t.id || p.service === t.slug) &&
                           (p.state === s.id || p.state === s.slug) &&
                           (p.scope === 'service+state' || p.scope === 'service+city'),
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
                  {/* National service cell */}
                  {(() => {
                    const { count, expiringSoon } = countPromos(
                      p => (p.service === t.id || p.service === t.slug) && p.scope === 'service',
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
        </>
      )}
    </div>
  )
}

const pill: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, textDecoration: 'none',
  padding: '8px 14px', borderRadius: 999,
  background: 'var(--theme-elevation-100, #f1f5f9)', color: 'inherit',
}

'use client'

import { ALERTS_OPEN, LEADS_NEW } from './constants'

// -- Top stats bar (6 cards per spec) ---------------------------------------
export function StatsBar({
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

'use client'

import { PanelFrame } from './PanelFrame'
import type { TopResponse } from './types'

export function TopClinicsPanel({
  data,
  loading,
  error,
}: {
  data: TopResponse | null
  loading: boolean
  error: string | null
}) {
  const rows = data?.topClinics ?? []
  const empty = !loading && !error && rows.length === 0

  return (
    <PanelFrame title="Top clinics" loading={loading} error={error} empty={empty}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ textAlign: 'left', opacity: 0.55 }}>
            <th style={{ fontWeight: 500, paddingBottom: 6 }}>Clinic</th>
            <th style={{ fontWeight: 500, paddingBottom: 6, textAlign: 'right' }}>Views</th>
            <th style={{ fontWeight: 500, paddingBottom: 6, textAlign: 'right' }}>Leads</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--theme-elevation-100, #f1f5f9)' }}>
              <td style={{ padding: '6px 0' }}>
                <a
                  href={`/admin/collections/clinics/${r.id}`}
                  style={{ color: 'inherit', textDecoration: 'none', fontWeight: 500 }}
                >
                  {r.name}
                </a>
                {(r.city || r.state) && (
                  <span style={{ opacity: 0.5 }}>
                    {' '}
                    · {[r.city, r.state].filter(Boolean).join(', ')}
                  </span>
                )}
              </td>
              <td style={{ padding: '6px 0', textAlign: 'right' }}>{r.views.toLocaleString()}</td>
              <td style={{ padding: '6px 0', textAlign: 'right' }}>
                {r.leads.toLocaleString()}
                {r.leads === 0 && (
                  <span
                    title="Views with no leads submitted in this range"
                    style={{ marginLeft: 6, fontSize: 10, color: '#C2A14E' }}
                  >
                    ● no leads
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelFrame>
  )
}

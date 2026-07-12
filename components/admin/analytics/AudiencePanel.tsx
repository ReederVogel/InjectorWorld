'use client'

import { PanelFrame } from './PanelFrame'
import { BarList, GOLD, MINT } from './charts'
import type { TopResponse } from './types'

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington DC',
}

export function AudiencePanel({
  data,
  loading,
  error,
}: {
  data: TopResponse | null
  loading: boolean
  error: string | null
}) {
  const states = data?.visitorsByState ?? []
  const devices = data?.visitorsByDevice ?? []
  const referrers = data?.topReferrers ?? []
  const empty = !loading && !error && states.length === 0 && devices.length === 0 && referrers.length === 0

  return (
    <PanelFrame title="Audience" loading={loading} error={error} empty={empty}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        <div>
          <h4 style={sectionTitle}>By state</h4>
          {states.length === 0 ? (
            <p style={emptyStyle}>No geo data yet.</p>
          ) : (
            <BarList
              rows={states.slice(0, 10).map((s) => ({
                label: STATE_NAMES[s.state] || s.state,
                value: s.visitors,
              }))}
              color={MINT}
              formatValue={(n) => n.toLocaleString()}
            />
          )}
        </div>
        <div>
          <h4 style={sectionTitle}>By device</h4>
          {devices.length === 0 ? (
            <p style={emptyStyle}>No device data yet.</p>
          ) : (
            <BarList
              rows={devices.map((d) => ({
                label: d.device.charAt(0).toUpperCase() + d.device.slice(1),
                value: d.visitors,
              }))}
              color={GOLD}
            />
          )}
        </div>
        <div>
          <h4 style={sectionTitle}>Top referrers</h4>
          {referrers.length === 0 ? (
            <p style={emptyStyle}>No referrer data yet.</p>
          ) : (
            <BarList rows={referrers.map((r) => ({ label: r.host, value: r.views }))} color="#0B1B34" />
          )}
        </div>
      </div>
    </PanelFrame>
  )
}

const sectionTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, margin: '0 0 10px', opacity: 0.7 }
const emptyStyle: React.CSSProperties = { fontSize: 12, opacity: 0.5 }

import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { Gutter } from '@payloadcms/ui'
import { navCard } from '../ui/styles'
import { SiteIndexToggle } from '../SiteIndexToggle'
import { OperationsPanel } from '../panels/OperationsPanel'
import { DashboardTrafficStrip } from '../analytics/DashboardTrafficStrip'
import { ActivityFeed } from '../panels/ActivityFeed'

// Registered as admin.components.views.dashboard, so Payload's own RootPage
// already wraps this in DefaultTemplate (Nav + header) before rendering it —
// wrapping in DefaultTemplate again here would double the chrome. Only Gutter
// is needed, matching @payloadcms/next's own DefaultDashboard.
export async function CommandCenter(props: AdminViewServerProps) {
  const { initPageResult } = props

  if (!initPageResult.req.user) {
    redirect('/admin/login')
  }

  return (
    <Gutter className="dashboard">
      <SiteIndexToggle />

      <OperationsPanel showStats />

      <DashboardTrafficStrip />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '24px 0 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Quick links
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: 999,
            border: '1px solid var(--theme-elevation-150, #e2e8f0)',
            background: 'var(--theme-elevation-50, #f7f8fa)',
            opacity: 0.7,
          }}
        >
          Ctrl+K to search
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '0 0 8px' }}>
        <a href="/admin/ops" style={navCard}>Operations →</a>
        <a href="/admin/indexing" style={navCard}>Indexing →</a>
        <a href="/admin/tools" style={navCard}>Data Tools →</a>
        <a href="/admin/analytics" style={navCard}>Analytics →</a>
        <a href="/admin/collections/bookings" style={navCard}>Bookings →</a>
        <a href="/admin/collections/claims" style={navCard}>Claims →</a>
        <a href="/admin/collections/qa" style={navCard}>Q&amp;A →</a>
        <a href="/admin/collections/data-alerts" style={navCard}>Data Alerts →</a>
        <a href="/admin/collections/clinics" style={navCard}>Clinics →</a>
        <a href="/admin/collections/guides" style={navCard}>Guides →</a>
        <a href="/admin/collections/news" style={navCard}>News →</a>
      </div>

      <ActivityFeed />
    </Gutter>
  )
}

import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { BatchIndexPanel } from '../panels/BatchIndexPanel'

/**
 * The Indexing screen: one control room for what Google is allowed to index.
 *
 * This replaced DashboardPageIndexPanel, which had two problems beyond being
 * small. Its copy said "New pages with data stay noindex until an admin
 * explicitly indexes them", describing a manual gate that had not existed since
 * 2026-07-09 (pages self-indexed at 5+ clinics). And its review queue showed ten
 * rows out of 51,099 unacknowledged, actionable one at a time.
 *
 * Relationship to the URLs collection, since the two used to be easy to confuse:
 * this screen is the ACTIONS (scan, batch in, exclude, roll back) over aggregate
 * counts. SEO > URLs is the same data as a filterable table, for inspecting or
 * correcting individual rows. One dataset, two surfaces.
 */
export async function IndexingView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props

  if (!initPageResult.req.user) {
    redirect('/admin/login')
  }

  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={initPageResult.req.payload}
      permissions={initPageResult.permissions}
      req={initPageResult.req}
      searchParams={searchParams}
      user={initPageResult.req.user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <div style={{ margin: '24px 0 20px' }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Indexing</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7, maxWidth: 720 }}>
            Release urls to search engines in controlled batches. The full table lives in{' '}
            <a href="/admin/collections/page-index" style={{ color: '#3FA68A', fontWeight: 600 }}>SEO &rsaquo; URLs</a>.
          </p>
        </div>
        <BatchIndexPanel />
      </Gutter>
    </DefaultTemplate>
  )
}

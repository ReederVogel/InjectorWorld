import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { ContentIndexPanel } from '../panels/ContentIndexPanel'

/**
 * Content indexing: the screen for deciding which of YOUR documents Google gets.
 *
 * The three indexing surfaces, and why they are separate:
 *
 *   Content (here)  one row per clinic / guide / news article. Things somebody
 *                   uploaded, with a name, dates and an import batch. Controlled
 *                   individually or in filtered batches.
 *   Indexing        the ~104,000 auto-generated listing pages (treatment in a
 *                   city, brand in a city, city and state pages). Nobody wrote
 *                   these and they have no names, so they are controlled by rule,
 *                   not row by row.
 *   SEO > URLs      the raw registry table, for inspecting or correcting a single
 *                   row when something looks wrong.
 *
 * They were one screen until 2026-08-26. Merging them meant the 39,864 documents
 * an operator cares about sat underneath 104,000 machine-named rows, which made
 * the thing unusable for its actual job.
 */
export async function ContentIndexingView(props: AdminViewServerProps) {
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
          <h1 style={{ margin: 0, fontSize: 20 }}>Content indexing</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, opacity: 0.7, maxWidth: 760 }}>
            Your clinics, guides and news, with the dates and quality signals behind each one.
            Pick rows or a whole filter, then submit them to Google. Auto-generated listing pages
            are handled by rule on the{' '}
            <a href="/admin/indexing" style={{ color: '#3FA68A', fontWeight: 600 }}>Indexing</a> screen.
          </p>
        </div>
        <ContentIndexPanel />
      </Gutter>
    </DefaultTemplate>
  )
}

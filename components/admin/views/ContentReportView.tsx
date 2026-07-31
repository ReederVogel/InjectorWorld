import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { ContentReportPanel } from '../ContentReportPanel'
import { ExportPanel } from '../ExportPanel'

export async function ContentReportView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props

  if (!initPageResult.req.user) {
    redirect('/admin/login')
  }

  const isAdmin = initPageResult.req.user.role === 'admin'

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
        <h1 style={{ margin: '24px 0 8px', fontSize: 20 }}>Content Report</h1>
        <p style={{ margin: '0 0 20px', fontSize: 13, opacity: 0.65 }}>
          Document counts and publish status, plus filtered data exports.
        </p>
        {isAdmin ? (
          <>
            <ExportPanel />
            <ContentReportPanel />
          </>
        ) : (
          <div style={{ padding: 16, border: '1px solid var(--theme-elevation-150, #e2e8f0)', borderRadius: 12 }}>
            Admins only.
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

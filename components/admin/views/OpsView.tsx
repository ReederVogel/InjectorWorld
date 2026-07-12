import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { navCard } from '../ui/styles'
import { OperationsPanel } from '../panels/OperationsPanel'
import { PromotionsCoverageMap } from '../panels/PromotionsCoverageMap'
import { ALERTS_OPEN, LEADS_NEW, CLAIMS_NEW, QUESTIONS_NEW } from '../panels/constants'

export async function OpsView(props: AdminViewServerProps) {
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
        <h1 style={{ margin: '24px 0 20px', fontSize: 20 }}>Operations</h1>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <a href={LEADS_NEW} style={navCard}>Unactioned leads →</a>
          <a href={CLAIMS_NEW} style={navCard}>Pending claims →</a>
          <a href={QUESTIONS_NEW} style={navCard}>Unanswered questions →</a>
          <a href={ALERTS_OPEN} style={navCard}>Open data alerts →</a>
        </div>

        <OperationsPanel />
        <PromotionsCoverageMap />
      </Gutter>
    </DefaultTemplate>
  )
}

import { redirect } from 'next/navigation'
import type { AdminViewServerProps } from 'payload'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import { Section } from '../ui/Section'
import { BroadcastPanel } from '../panels/BroadcastPanel'
import { DangerZonePanel } from '../panels/DangerZonePanel'

export async function ToolsView(props: AdminViewServerProps) {
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
        <h1 style={{ margin: '24px 0 20px', fontSize: 20 }}>Data Tools</h1>

        <Section title="Broadcast" defaultOpen={false}>
          <BroadcastPanel />
        </Section>

        <Section title="Data Tools & Danger Zone" id="data-tools" defaultOpen={false} danger>
          <DangerZonePanel />
        </Section>
      </Gutter>
    </DefaultTemplate>
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { firstZodError, readSettingsForAdmin, settingsInput } from '@/lib/faqs/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Settings panel on the FAQs screen. Saving purges the page cache (FaqSettings afterChange). */
export async function GET() {
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard
  try {
    return NextResponse.json(await readSettingsForAdmin(payload), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return serverError('admin/faqs/settings GET', err, 'Could not load FAQ settings.')
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard

  const parsed = settingsInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 422 })

  try {
    await payload.updateGlobal({ slug: 'faq-settings', data: parsed.data as any, overrideAccess: true })
    return NextResponse.json({ success: true, settings: await readSettingsForAdmin(payload) })
  } catch (err) {
    return serverError('admin/faqs/settings POST', err, 'Could not save FAQ settings.')
  }
}

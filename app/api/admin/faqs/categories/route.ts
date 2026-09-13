import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { categoryInput, firstZodError, listCategoriesForAdmin, toCategoryData } from '@/lib/faqs/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Categories panel on the FAQs screen: list (with FAQ counts) and create. */
export async function GET() {
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard
  try {
    const data = await listCategoriesForAdmin(payload)
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return serverError('admin/faqs/categories GET', err, 'Could not load categories.')
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard

  const parsed = categoryInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 422 })

  const data = toCategoryData(parsed.data)
  if (!data.slug) return NextResponse.json({ error: 'The name needs at least one letter or number.' }, { status: 422 })

  try {
    const taken = await payload.count({ collection: 'faq-categories', where: { slug: { equals: data.slug } }, overrideAccess: true })
    if (taken.totalDocs > 0) {
      return NextResponse.json({ error: `The url /faq/${data.slug} is already used by another category.` }, { status: 409 })
    }
    const doc = await payload.create({ collection: 'faq-categories', data: data as any, overrideAccess: true })
    return NextResponse.json({ success: true, id: doc.id })
  } catch (err) {
    return serverError('admin/faqs/categories POST', err, 'Could not create the category.')
  }
}

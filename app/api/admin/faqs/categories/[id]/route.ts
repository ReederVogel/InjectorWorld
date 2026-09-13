import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin, requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { categoryInput, firstZodError, toCategoryData } from '@/lib/faqs/admin'

export const runtime = 'nodejs'

function parseId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Edit one category from the Categories panel. Links are replaced wholesale. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard

  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Bad id.' }, { status: 400 })

  const parsed = categoryInput.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstZodError(parsed.error) }, { status: 422 })
  const data = toCategoryData(parsed.data)
  if (!data.slug) return NextResponse.json({ error: 'The url needs at least one letter or number.' }, { status: 422 })

  try {
    const taken = await payload.count({
      collection: 'faq-categories',
      where: { and: [{ slug: { equals: data.slug } }, { id: { not_equals: id } }] },
      overrideAccess: true,
    })
    if (taken.totalDocs > 0) {
      return NextResponse.json({ error: `The url /faq/${data.slug} is already used by another category.` }, { status: 409 })
    }
    await payload.update({ collection: 'faq-categories', id, data: data as any, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError('admin/faqs/categories PATCH', err, 'Could not save the category.')
  }
}

/** Delete an empty category. Admin only, like deleting an FAQ. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const guard = requireAdmin(await getAuthUser(payload))
  if (guard) return guard

  const id = parseId((await params).id)
  if (!id) return NextResponse.json({ error: 'Bad id.' }, { status: 400 })

  try {
    // Checked here for a clear message; the collection's beforeDelete hook
    // enforces the same rule for any other caller.
    const inUse = await payload.count({ collection: 'faqs', where: { category: { equals: id } }, overrideAccess: true })
    if (inUse.totalDocs > 0) {
      return NextResponse.json(
        { error: `This category still has ${inUse.totalDocs} FAQ(s). Move them to another category first.` },
        { status: 409 },
      )
    }
    await payload.delete({ collection: 'faq-categories', id, overrideAccess: true })
    return NextResponse.json({ success: true })
  } catch (err) {
    return serverError('admin/faqs/categories DELETE', err, 'Could not delete the category.')
  }
}

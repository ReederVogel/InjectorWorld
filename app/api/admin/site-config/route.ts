import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  try {
    const data = await payload.findGlobal({ slug: 'site-config' })
    return NextResponse.json({ siteNoindex: data?.siteNoindex ?? true })
  } catch {
    return NextResponse.json({ siteNoindex: true })
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  if (typeof body.siteNoindex !== 'boolean') {
    return NextResponse.json({ error: 'siteNoindex must be boolean.' }, { status: 400 })
  }

  try {
    await payload.updateGlobal({ slug: 'site-config', data: { siteNoindex: body.siteNoindex } })
    // Purge all cached page layouts so meta robots tag updates immediately
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true, siteNoindex: body.siteNoindex })
  } catch (err) {
    return NextResponse.json({ error: 'Update failed.' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { serverError } from '@/lib/api-errors'
import { lookupLinkTargets } from '@/lib/faqs/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES = new Set(['services', 'brands', 'guides', 'locations'])

/** Search behind the "linked pages" pickers in the Categories panel. */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const guard = requireAdminOrEditor(await getAuthUser(payload))
  if (guard) return guard

  const type = req.nextUrl.searchParams.get('type') ?? ''
  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!TYPES.has(type)) return NextResponse.json({ error: 'Bad type.' }, { status: 400 })

  try {
    const results = await lookupLinkTargets(payload, type as any, q)
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return serverError('admin/faqs/lookup', err, 'Search failed.')
  }
}

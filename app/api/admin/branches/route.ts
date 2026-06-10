import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import {
  getBranchSuggestions,
  linkClinicsToBrand,
  dismissBranchSuggestion,
} from '@/lib/branches'

export const runtime = 'nodejs'

async function requireAdmin() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return { payload, error: NextResponse.json({ error: 'Unauthorized. Admin or editor login required.' }, { status: 401 }) }
  }
  return { payload, error: null as NextResponse | null }
}

/** GET: list current branch suggestions + existing brands (to link into). */
export async function GET() {
  const { payload, error } = await requireAdmin()
  if (error) return error
  try {
    const [suggestions, brandsRes] = await Promise.all([
      getBranchSuggestions(payload),
      payload.find({ collection: 'brands', limit: 500, depth: 0, sort: 'name' }),
    ])
    const brands = brandsRes.docs.map((b: any) => ({ id: Number(b.id), name: b.name, slug: b.slug }))
    return NextResponse.json({ suggestions, brands })
  } catch (err: any) {
    payload.logger?.error?.(`[admin branches GET] ${err?.message ?? err}`)
    return NextResponse.json({ error: 'Could not load branch suggestions.' }, { status: 500 })
  }
}

/** POST: link a group under a brand, or dismiss ("not a branch"). */
export async function POST(req: NextRequest) {
  const { payload, error } = await requireAdmin()
  if (error) return error

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const action = body?.action
  const clinicIds: number[] = Array.isArray(body?.clinicIds)
    ? body.clinicIds.map((x: any) => parseInt(String(x), 10)).filter((n: number) => !Number.isNaN(n))
    : []
  const alertKeys: string[] = Array.isArray(body?.alertKeys) ? body.alertKeys.filter((s: any) => typeof s === 'string') : []

  try {
    if (action === 'dismiss') {
      if (alertKeys.length === 0) {
        return NextResponse.json({ error: 'Nothing to dismiss.' }, { status: 400 })
      }
      await dismissBranchSuggestion(payload, alertKeys)
      return NextResponse.json({ success: true })
    }

    if (action === 'link') {
      if (clinicIds.length < 2) {
        return NextResponse.json({ error: 'Select at least two locations to link as a brand.' }, { status: 400 })
      }
      const brandId = body?.brandId ? parseInt(String(body.brandId), 10) : undefined
      const brandName = typeof body?.brandName === 'string' ? body.brandName : ''
      if (!brandId && !brandName.trim()) {
        return NextResponse.json({ error: 'Provide a brand name (or choose an existing brand).' }, { status: 400 })
      }
      const result = await linkClinicsToBrand(payload, {
        clinicIds,
        brandName,
        brandId: brandId && !Number.isNaN(brandId) ? brandId : undefined,
        alertKeys,
        websiteUrl: typeof body?.websiteUrl === 'string' ? body.websiteUrl : undefined,
      })
      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err: any) {
    payload.logger?.error?.(`[admin branches POST] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message || 'Branch operation failed.' }, { status: 500 })
  }
}

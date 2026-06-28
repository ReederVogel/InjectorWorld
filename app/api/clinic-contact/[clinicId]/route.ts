import { type NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> },
) {
  const { clinicId } = await params
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const clinic = await payload.findByID({
      collection: 'clinics',
      id: clinicId,
      depth: 0,
    })
    return NextResponse.json({
      phone: (clinic as any).phone ?? null,
      email: (clinic as any).email ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

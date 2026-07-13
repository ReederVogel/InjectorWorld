import { NextRequest, NextResponse } from 'next/server'
import { checkOrigin } from '@/lib/rate-limit'
import { getPayloadInstance } from '@/lib/payload-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const logId = typeof body?.logId === 'string' ? body.logId : ''
  const value = body?.value === 'up' || body?.value === 'down' ? body.value : null
  if (!logId || !value) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const payload = await getPayloadInstance()
    await payload.update({
      collection: 'assistant-logs',
      id: logId,
      overrideAccess: true,
      data: { feedback: value },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

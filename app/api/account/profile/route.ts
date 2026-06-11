import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'

/**
 * Patient self-edit of basic, non-sensitive profile info. Only `name` is
 * editable here (allowlist). Email changes are not supported (would need
 * re-verification) and role/links are never touchable from this route.
 *
 * No PHI is ever stored: name only.
 */
const ProfileSchema = z.object({
  name: z.string().min(1, 'Your name is required').max(200),
})

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation failed.' }, { status: 422 })
  }

  const safeName = parsed.data.name.replace(/[\r\n]/g, ' ').trim()
  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { name: safeName } as never,
      overrideAccess: true,
    })
  } catch {
    return NextResponse.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, name: safeName })
}

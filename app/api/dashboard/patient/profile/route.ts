import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'

const UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(200).optional(),
  currentPassword: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  let raw: unknown
  try { raw = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Validation failed.' }, { status: 422 })
  }

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  if (!user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const { name, email, password } = parsed.data

  const update: Record<string, unknown> = {}
  if (name) update.name = name.replace(/[\r\n]/g, ' ').trim()
  if (email) update.email = email
  if (password) update.password = password

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ success: true })
  }

  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: update as never,
      overrideAccess: true,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Could not update profile.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

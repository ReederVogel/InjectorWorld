import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { checkOrigin, RateLimiter, getIp } from '@/lib/rate-limit'

const limiter = new RateLimiter(10, 60 * 60 * 1000)

const SetupSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!limiter.check(getIp(req))) {
    return NextResponse.json({ error: 'Too many attempts. Please wait and try again.' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = SetupSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input.' }, { status: 422 })
  }

  const { token, password } = parsed.data
  const payload = await getPayload({ config })

  // Find user by setupToken
  const res = await payload.find({
    collection: 'users',
    where: { setupToken: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const user = res.docs[0] as any
  if (!user) {
    // Generic message — do not reveal whether the token existed
    return NextResponse.json({ error: 'This link is invalid or has already been used.' }, { status: 400 })
  }

  // Check expiry
  const expiry = user.setupTokenExpiry ? new Date(user.setupTokenExpiry) : null
  if (!expiry || expiry < new Date()) {
    return NextResponse.json({ error: 'This setup link has expired. Please contact support to request a new one.' }, { status: 400 })
  }

  // Set the new password and clear the token fields
  try {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        password,
        setupToken: null,
        setupTokenExpiry: null,
      } as any,
      overrideAccess: true,
    })
  } catch (err) {
    payload.logger.error(`[setup-account] update failed: ${(err as Error)?.message}`)
    return NextResponse.json({ error: 'Could not set your password. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

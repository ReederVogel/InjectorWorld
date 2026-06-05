import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'

// In-memory rate limit: max 3 claim submissions per IP per hour
const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 3
const WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

const ClaimSchema = z.object({
  claimType: z.enum(['provider', 'clinic']),
  targetId: z.string().min(1, 'Target ID is required'),
  claimantName: z.string().min(1, 'Name is required').max(200),
  claimantEmail: z.string().email('Enter a valid email address'),
  claimantPhone: z.string().max(30).optional(),
  roleAtPractice: z.string().min(1, 'Your role at the practice is required').max(100),
  licenseNumber: z.string().max(100).optional(),
  npiNumber: z.string().max(20).optional(),
  businessProof: z.string().max(500).optional(),
  message: z.string().max(2000).optional(),
  // Optional account creation fields
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting another claim.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ClaimSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  const {
    claimType,
    targetId,
    claimantName,
    claimantEmail,
    claimantPhone,
    roleAtPractice,
    licenseNumber,
    npiNumber,
    businessProof,
    message,
    password,
  } = parsed.data

  const payload = await getPayload({ config })

  // Check session — if already logged in, skip account creation
  const { user: sessionUser } = await payload.auth({ headers: req.headers })

  // Verify the target exists and is not already claimed
  try {
    const targetCollection = claimType === 'provider' ? 'providers' : 'clinics'
    const target = await payload.findByID({
      collection: targetCollection,
      id: targetId,
      depth: 0,
      overrideAccess: true,
    })
    if (!target) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }
    if ((target as any).claimed) {
      return NextResponse.json(
        { error: 'This profile has already been claimed.' },
        { status: 409 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }

  // Optionally create an account for the claimant if they don't have one
  if (!sessionUser && password) {
    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: claimantEmail } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.docs.length === 0) {
      try {
        await payload.create({
          collection: 'users',
          data: {
            name: claimantName,
            email: claimantEmail,
            password,
            role: 'patient',
          } as any,
          overrideAccess: true,
        })
      } catch (err: any) {
        if (err?.message?.toLowerCase().includes('duplicate')) {
          // Race condition: user was just created — that's fine
        } else {
          console.error('[claims] user creation failed:', err)
          return NextResponse.json(
            { error: 'Could not create account. Please try again.' },
            { status: 500 },
          )
        }
      }
    }
  }

  // Create the claim record
  try {
    const claimData: Record<string, unknown> = {
      claimType,
      claimantName,
      claimantEmail,
      claimantPhone: claimantPhone || undefined,
      roleAtPractice,
      licenseNumber: licenseNumber || undefined,
      npiNumber: npiNumber || undefined,
      businessProof: businessProof || undefined,
      message: message || undefined,
      status: 'new',
    }
    if (claimType === 'provider') claimData.targetProvider = targetId as any
    else claimData.targetClinic = targetId as any

    await payload.create({
      collection: 'claims',
      data: claimData as any,
      overrideAccess: true,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[claims] create failed:', err)
    return NextResponse.json(
      { error: 'Could not submit your claim. Please try again.' },
      { status: 500 },
    )
  }
}

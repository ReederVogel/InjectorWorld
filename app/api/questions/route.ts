import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayloadInstance } from '@/lib/payload-server'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'

// 5 question submissions per IP per hour.
const limiter = new RateLimiter(5, 60 * 60 * 1000)

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

const QuestionSchema = z.object({
  questionTitle: z.string().min(10).max(200).trim(),
  questionText: z.string().max(2000).trim().optional(),
  treatmentTag: z.string().max(80).trim().optional(),
  cityTag: z.string().max(80).trim().optional(),
  submitterEmail: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (limiter.check(getIp(req)) === false) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = QuestionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { questionTitle, questionText, treatmentTag, cityTag, submitterEmail } = parsed.data

  // Generate a unique slug by appending a timestamp fragment
  const baseSlug = slugify(questionTitle)
  const slug = `${baseSlug}-${Date.now().toString(36)}`
  const qaId = `qa-user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

  try {
    const payload = await getPayloadInstance()
    await payload.create({
      collection: 'qa',
      overrideAccess: true,
      data: {
        qaId,
        slug,
        status: 'new',
        questionTitle,
        questionText: questionText ?? undefined,
        treatmentTag: treatmentTag ?? undefined,
        cityTag: cityTag ?? undefined,
        sourcePlatform: 'user_submission',
        sourceUrl: '',
        submitterEmail: submitterEmail ?? undefined,
        date: new Date().toISOString().slice(0, 10),
      } as any,
    })
  } catch (err) {
    console.error('[POST /api/questions] error:', err)
    return NextResponse.json({ error: 'Could not save your question.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

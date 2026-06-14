import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter } from '@/lib/rate-limit'

const BOT_SUBSTRINGS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'facebot', 'ia_archiver', 'prerender', 'headlesschrome',
  'crawl', 'spider', 'bot/', 'bot;', 'scrapy', 'wget', 'curl/', 'python-requests',
]

// Per-IP+slug dedup: same visitor counted at most once per 10 minutes.
// RateLimiter handles eviction of expired entries (memory-leak fix).
const viewDedup = new RateLimiter(1, 10 * 60 * 1000)

export async function POST(req: NextRequest) {
  const ua = (req.headers.get('user-agent') || '').toLowerCase()
  if (BOT_SUBSTRINGS.some((b) => ua.includes(b))) {
    return NextResponse.json({ ok: true })
  }

  let slug: string
  try {
    const body = await req.json()
    slug = String(body?.slug || '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid.' }, { status: 400 })
  }
  if (!slug) return NextResponse.json({ error: 'slug required.' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const key = `${ip}:${slug}`

  if (!viewDedup.check(key)) {
    return NextResponse.json({ ok: true })
  }

  // Best-effort increment — never 500 the caller
  try {
    const payload = await getPayload({ config })
    const res = await payload.find({
      collection: 'providers',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    const p = res.docs[0]
    if (p) {
      await payload.update({
        collection: 'providers',
        id: p.id,
        data: { profileViewCount: ((p as any).profileViewCount || 0) + 1 } as any,
        overrideAccess: true,
        context: { disableHooks: true },
      })
    }
  } catch {
    // Silently swallow — analytics should never break the page
  }

  return NextResponse.json({ ok: true })
}

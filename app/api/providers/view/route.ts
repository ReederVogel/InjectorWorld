import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

const BOT_SUBSTRINGS = [
  'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'baiduspider', 'yandexbot',
  'sogou', 'exabot', 'facebot', 'ia_archiver', 'prerender', 'headlesschrome',
  'crawl', 'spider', 'bot/', 'bot;', 'scrapy', 'wget', 'curl/', 'python-requests',
]

// Per-IP dedup window: same IP+slug counted at most once per 10 min
const recentViews = new Map<string, number>()
const DEDUP_MS = 10 * 60 * 1000

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
  const now = Date.now()

  if (recentViews.has(key) && now - recentViews.get(key)! < DEDUP_MS) {
    return NextResponse.json({ ok: true })
  }
  recentViews.set(key, now)

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

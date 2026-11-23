import { NextResponse, type NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { serverError } from '@/lib/api-errors'
import { SEARCHABLE, searchContent, type ContentSearchCollection } from '@/lib/content-search'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/content-search?collection=guides|news&q=<text>[&mc=1][&ww=1]
 * Every article of the collection that contains the text, with match counts
 * per field and two snippets. mc = match case, ww = whole words only.
 * Read-only. Auth: admin or editor (the people who can edit articles).
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const sp = req.nextUrl.searchParams
  const collection = sp.get('collection') ?? ''
  const q = sp.get('q') ?? ''
  if (!Object.hasOwn(SEARCHABLE, collection)) {
    return NextResponse.json({ error: 'collection must be guides or news' }, { status: 400 })
  }
  if (!q.trim() || q.length > 200) {
    return NextResponse.json({ error: 'q must be 1 to 200 characters' }, { status: 400 })
  }

  const pool = (payload.db as any).pool
  if (!pool) return NextResponse.json({ error: 'No Postgres pool available.' }, { status: 500 })

  try {
    const data = await searchContent(pool, collection as ContentSearchCollection, q, {
      matchCase: sp.get('mc') === '1',
      wholeWord: sp.get('ww') === '1',
    })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return serverError('content-search', err)
  }
}

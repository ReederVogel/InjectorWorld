import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'

export const runtime = 'nodejs'

/**
 * GET /api/admin/content-report
 * Per-collection document counts for Clinics, Guides, News, FAQs, Brands:
 * total uploaded vs. published (or each collection's equivalent live-state
 * field/value, which differ — see per-collection comments below). Clinics
 * total is deduped by slug (the field carrying its own DB unique constraint)
 * so the count reflects unique pages, not raw rows. Guides/News gate on
 * reviewStatus, not the admin "status" field — see the query comments.
 * Auth: admin only.
 */
export async function GET() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  const pool = (payload.db as any).pool
  if (!pool) {
    return NextResponse.json({ error: 'No Postgres pool available.' }, { status: 500 })
  }

  try {
    const [clinics, guides, news, faqs, brands, services] = await Promise.all([
      // status: draft | review | published
      pool.query(`
        SELECT count(*)::bigint AS total,
               count(DISTINCT slug)::bigint AS unique_pages,
               count(*) FILTER (WHERE status = 'published')::bigint AS published
        FROM clinics
      `),
      // The admin `status` field (draft|published) is NOT the real public gate --
      // it was never backfilled for existing content (see lib/guide-queries.ts's
      // APPROVED comment). The live pages actually gate on reviewStatus.
      pool.query(`
        SELECT count(*)::bigint AS total,
               count(*) FILTER (WHERE review_status = 'approved')::bigint AS published
        FROM guides
      `),
      // Same as guides -- see lib/news-queries.ts's APPROVED comment.
      pool.query(`
        SELECT count(*)::bigint AS total,
               count(*) FILTER (WHERE review_status = 'approved')::bigint AS published
        FROM news
      `),
      // reviewStatus: imported | approved -- FAQs has no "status" field, "approved"
      // is the equivalent live/eligible-to-render state.
      pool.query(`
        SELECT count(*)::bigint AS total,
               count(*) FILTER (WHERE review_status = 'approved')::bigint AS published
        FROM faqs
      `),
      // Brands has no draft/published concept at all -- every row is live the
      // moment it's created, so "published" is just the total.
      pool.query(`SELECT count(*)::bigint AS total FROM brands`),
      // Services, like brands, has no draft/published concept.
      pool.query(`SELECT count(*)::bigint AS total FROM services`),
    ])

    const row = (res: any) => res.rows[0]

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      collections: {
        clinics: {
          total: Number(row(clinics).unique_pages),
          rawRows: Number(row(clinics).total),
          published: Number(row(clinics).published),
          statusField: 'status',
          liveValue: 'published',
          note: 'Total is deduped by slug (unique pages). Raw row count shown separately for reference.',
        },
        guides: {
          total: Number(row(guides).total),
          published: Number(row(guides).published),
          statusField: 'reviewStatus',
          liveValue: 'approved',
          note: 'The admin "status" field (draft/published) is not the real gate -- live pages check reviewStatus.',
        },
        news: {
          total: Number(row(news).total),
          published: Number(row(news).published),
          statusField: 'reviewStatus',
          liveValue: 'approved',
          note: 'The admin "status" field (draft/published) is not the real gate -- live pages check reviewStatus.',
        },
        faqs: {
          total: Number(row(faqs).total),
          published: Number(row(faqs).published),
          statusField: 'reviewStatus',
          liveValue: 'approved',
        },
        brands: {
          total: Number(row(brands).total),
          published: Number(row(brands).total),
          statusField: null,
          liveValue: null,
          note: 'No draft/published field exists on this collection -- every brand is live once created.',
        },
        services: {
          total: Number(row(services).total),
          published: Number(row(services).total),
          statusField: null,
          liveValue: null,
          note: 'No draft/published field exists on this collection -- every service is live once created.',
        },
      },
    })
  } catch (err: any) {
    payload.logger.error(`[content-report] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Report failed.' }, { status: 500 })
  }
}

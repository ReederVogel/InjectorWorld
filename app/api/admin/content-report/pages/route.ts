import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { countLinks, countIncomingLinks } from '@/lib/internal-links/link-stats'

export const runtime = 'nodejs'

const SITE_URL = 'https://www.injector.world'

/**
 * GET /api/admin/content-report/pages
 * Per-page SEO table for Guides and News: URL, focus keyword, outgoing
 * internal/external link counts (parsed from each Lexical body), INCOMING
 * internal link count (0 = orphan page, which is the number that actually
 * predicts whether a page can rank), and how many link suggestions are
 * pending review for it. Plus a simpler FAQ list (FAQs have no URL or focus
 * keyword of their own, so they get question/scope/status columns instead).
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
    const [guidesRes, newsRes, faqsRes, incoming, pendingRes] = await Promise.all([
      pool.query(
        `SELECT id, title, slug, focus_keyword, body, status, review_status FROM guides ORDER BY title`,
      ),
      pool.query(
        `SELECT id, title, slug, focus_keyword, body, category, status, review_status FROM news ORDER BY title`,
      ),
      pool.query(`SELECT question, scope, review_status FROM faqs ORDER BY question`),
      countIncomingLinks(payload),
      // Pending suggestions grouped by source page. The polymorphic relation
      // lives in the *_rels join table, one column per possible collection.
      pool
        .query(
          `SELECT r.guides_id, r.news_id, count(*)::int AS n
             FROM internal_link_suggestions_rels r
             JOIN internal_link_suggestions s ON s.id = r.parent_id
            WHERE s.status = 'pending'
            GROUP BY r.guides_id, r.news_id`,
        )
        .catch(() => ({ rows: [] })),
    ])

    const pendingGuides = new Map<number, number>()
    const pendingNews = new Map<number, number>()
    for (const row of (pendingRes as any).rows as any[]) {
      if (row.guides_id != null) pendingGuides.set(Number(row.guides_id), Number(row.n))
      if (row.news_id != null) pendingNews.set(Number(row.news_id), Number(row.n))
    }

    const guides = (guidesRes.rows as any[]).map((g) => {
      const links = countLinks(g.body)
      const slug = String(g.slug).toLowerCase()
      return {
        title: g.title,
        url: `${SITE_URL}/guides/${g.slug}`,
        focusKeyword: g.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external,
        incomingLinks: incoming.get(`guide:${slug}`) ?? 0,
        pendingOpportunities: pendingGuides.get(Number(g.id)) ?? 0,
        status: g.status,
        reviewStatus: g.review_status,
      }
    })

    const news = (newsRes.rows as any[]).map((n) => {
      const links = countLinks(n.body)
      const slug = String(n.slug).toLowerCase()
      return {
        title: n.title,
        url: `${SITE_URL}/news/${n.slug}`,
        focusKeyword: n.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external,
        incomingLinks: incoming.get(`news:${slug}`) ?? 0,
        pendingOpportunities: pendingNews.get(Number(n.id)) ?? 0,
        category: n.category,
        status: n.status,
        reviewStatus: n.review_status,
      }
    })

    const faqs = (faqsRes.rows as any[]).map((f) => ({
      question: f.question,
      scope: f.scope,
      reviewStatus: f.review_status,
    }))

    const orphanGuides = guides.filter((g) => g.incomingLinks === 0).length
    const orphanNews = news.filter((n) => n.incomingLinks === 0).length

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      guides,
      news,
      faqs,
      summary: { orphanGuides, orphanNews },
    })
  } catch (err: any) {
    payload.logger.error(`[content-report/pages] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Failed to load page details.' }, { status: 500 })
  }
}

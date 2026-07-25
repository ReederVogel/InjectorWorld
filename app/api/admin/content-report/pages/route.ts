import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { countLinks } from '@/lib/internal-links/link-stats'

export const runtime = 'nodejs'

const SITE_URL = 'https://www.injector.world'

/**
 * GET /api/admin/content-report/pages
 * Per-page WordPress/Yoast-style SEO table for Guides and News (URL, focus
 * keyword, internal/external link counts computed by walking each page's
 * Lexical body), plus a simpler FAQ list (FAQs have no URL or focus keyword
 * of their own -- see docs discussion -- so they get question/scope/status
 * columns instead).
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
    const [guidesRes, newsRes, faqsRes] = await Promise.all([
      pool.query(`SELECT title, slug, focus_keyword, body, status, review_status FROM guides ORDER BY title`),
      pool.query(`SELECT title, slug, focus_keyword, body, category, status, review_status FROM news ORDER BY title`),
      pool.query(`SELECT question, scope, review_status FROM faqs ORDER BY question`),
    ])

    const guides = (guidesRes.rows as any[]).map((g) => {
      const links = countLinks(g.body)
      return {
        title: g.title,
        url: `${SITE_URL}/guides/${g.slug}`,
        focusKeyword: g.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external,
        status: g.status,
        reviewStatus: g.review_status,
      }
    })

    const news = (newsRes.rows as any[]).map((n) => {
      const links = countLinks(n.body)
      return {
        title: n.title,
        url: `${SITE_URL}/news/${n.slug}`,
        focusKeyword: n.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external,
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

    return NextResponse.json({ generatedAt: new Date().toISOString(), guides, news, faqs })
  } catch (err: any) {
    payload.logger.error(`[content-report/pages] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Failed to load page details.' }, { status: 500 })
  }
}

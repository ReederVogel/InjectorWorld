import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { countLinks, countIncomingLinks } from '@/lib/internal-links/link-stats'

export const runtime = 'nodejs'

const SITE_URL = 'https://www.injector.world'

type Opportunity = {
  id: number
  anchorText: string
  targetTitle: string
  targetUrl: string
  targetType: string
  reasoning: string | null
}

/**
 * Counts a page's cited sources. These are external links on the rendered page
 * but they do NOT live in the Lexical body -- the importer builds the body from
 * plain paragraphs/headings only, and sources are a separate JSON field
 * rendered as their own citations block. Counting only the body would report 0
 * external links for a page that visibly cites six.
 * Falls back to the denormalised sourcesCount for older rows whose sources
 * array was never populated (the guide template renders that same fallback).
 */
function countSources(sources: unknown, sourcesCount: unknown): number {
  if (Array.isArray(sources)) {
    return sources.filter((s: any) => s && typeof s === 'object' && s.url).length
  }
  const n = Number(sourcesCount)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * GET /api/admin/content-report/pages
 * Per-page SEO table for Guides and News: URL, focus keyword, outgoing
 * internal/external link counts, INCOMING internal link count (0 = orphan
 * page, the number that actually predicts whether a page can rank), and the
 * pending link suggestions for it (full detail, so the admin can review and
 * approve inline). Plus a simpler FAQ list (FAQs have no URL or focus keyword
 * of their own, so they get question/scope/status columns instead).
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
        `SELECT id, title, slug, focus_keyword, body, sources, sources_count, status, review_status
           FROM guides ORDER BY title`,
      ),
      pool.query(
        `SELECT id, title, slug, focus_keyword, body, sources, category, status, review_status
           FROM news ORDER BY title`,
      ),
      pool.query(`SELECT question, scope, review_status FROM faqs ORDER BY question`),
      countIncomingLinks(payload),
      // Full pending suggestions, joined to their source page. The polymorphic
      // relation lives in the *_rels join table, one column per collection.
      pool
        .query(
          `SELECT s.id, s.anchor_text, s.target_title, s.target_url, s.target_type, s.reasoning,
                  r.guides_id, r.news_id
             FROM internal_link_suggestions s
             JOIN internal_link_suggestions_rels r ON r.parent_id = s.id
            WHERE s.status = 'pending'
            ORDER BY s.id`,
        )
        .catch(() => ({ rows: [] })),
    ])

    const oppsByGuide = new Map<number, Opportunity[]>()
    const oppsByNews = new Map<number, Opportunity[]>()
    for (const row of (pendingRes as any).rows as any[]) {
      const opp: Opportunity = {
        id: Number(row.id),
        anchorText: row.anchor_text,
        targetTitle: row.target_title,
        targetUrl: row.target_url,
        targetType: row.target_type,
        reasoning: row.reasoning ?? null,
      }
      if (row.guides_id != null) {
        const k = Number(row.guides_id)
        if (!oppsByGuide.has(k)) oppsByGuide.set(k, [])
        oppsByGuide.get(k)!.push(opp)
      }
      if (row.news_id != null) {
        const k = Number(row.news_id)
        if (!oppsByNews.has(k)) oppsByNews.set(k, [])
        oppsByNews.get(k)!.push(opp)
      }
    }

    const guides = (guidesRes.rows as any[]).map((g) => {
      const links = countLinks(g.body)
      const sourceLinks = countSources(g.sources, g.sources_count)
      const opportunities = oppsByGuide.get(Number(g.id)) ?? []
      return {
        title: g.title,
        url: `${SITE_URL}/guides/${g.slug}`,
        focusKeyword: g.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external + sourceLinks,
        externalBreakdown: { body: links.external, sources: sourceLinks },
        incomingLinks: incoming.get(`guide:${String(g.slug).toLowerCase()}`) ?? 0,
        pendingOpportunities: opportunities.length,
        opportunities,
        status: g.status,
        reviewStatus: g.review_status,
      }
    })

    const news = (newsRes.rows as any[]).map((n) => {
      const links = countLinks(n.body)
      const sourceLinks = countSources(n.sources, null)
      const opportunities = oppsByNews.get(Number(n.id)) ?? []
      return {
        title: n.title,
        url: `${SITE_URL}/news/${n.slug}`,
        focusKeyword: n.focus_keyword ?? null,
        internalLinks: links.internal,
        externalLinks: links.external + sourceLinks,
        externalBreakdown: { body: links.external, sources: sourceLinks },
        incomingLinks: incoming.get(`news:${String(n.slug).toLowerCase()}`) ?? 0,
        pendingOpportunities: opportunities.length,
        opportunities,
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

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      guides,
      news,
      faqs,
      summary: {
        orphanGuides: guides.filter((g) => g.incomingLinks === 0).length,
        orphanNews: news.filter((n) => n.incomingLinks === 0).length,
      },
    })
  } catch (err: any) {
    payload.logger.error(`[content-report/pages] ${err?.message ?? err}`)
    return NextResponse.json({ error: err?.message ?? 'Failed to load page details.' }, { status: 500 })
  }
}

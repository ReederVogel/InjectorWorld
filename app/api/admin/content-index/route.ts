import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin, requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin, enforceLimit, RateLimiter } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import {
  fetchContentPage,
  fetchContentSummary,
  fetchContentFacets,
  fetchContentDetail,
  READINESS_LABELS,
  fetchSitePages,
  type ContentTab,
  type ContentFilters,
  type SortKey,
} from '@/lib/content-index/queries'
import { STATIC_PAGES } from '@/lib/page-index/static-pages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The Content screen: one row per real document (clinic, guide, news article),
 * with its dates, import batch, readiness signals and indexing decision.
 *
 * GET  ?tab=clinics&...            list + total + summary + facets
 * GET  ?tab=clinics&detail=123     one row, expanded, for the drawer
 * POST                             bulk index / exclude / requeue
 */

const TABS: ContentTab[] = ['clinics', 'guides', 'news']
const SORT_KEYS: SortKey[] = ['name', 'uploaded', 'published', 'updated', 'reviews']
const MAX_LIMIT = 100
const MAX_BULK = 10_000

const writeLimiter = new RateLimiter(20, 60_000)

function parseTab(v: string | null): ContentTab | null {
  return TABS.includes(v as ContentTab) ? (v as ContentTab) : null
}

const clean = (v: string | null | undefined) => {
  const s = (v ?? '').trim()
  return s.length ? s : undefined
}

function readFilters(sp: URLSearchParams): ContentFilters {
  return {
    importBatch: clean(sp.get('importBatch')),
    state: clean(sp.get('state')),
    city: clean(sp.get('city')),
    status: clean(sp.get('status')),
    submitted: clean(sp.get('submitted')),
    problem: clean(sp.get('problem')),
    q: clean(sp.get('q')),
  }
}

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  const sp = req.nextUrl.searchParams
  const pool = (payload.db as any).pool

  // Site pages are a different shape: ~39 hand-written routes, no paging, no
  // filters, and their "never index" reason comes from the shared static list
  // rather than the database.
  if (sp.get('tab') === 'static') {
    try {
      const pages = await fetchSitePages(pool, STATIC_PAGES)
      return NextResponse.json({
        success: true,
        tab: 'static',
        sitePages: pages,
        summary: {
          total: pages.length,
          submitted: pages.filter((p) => p.indexed).length,
          queued: pages.filter((p) => p.indexable && !p.indexed).length,
          excluded: pages.filter((p) => !p.indexable).length,
        },
      })
    } catch (err: any) {
      return serverError('admin/content-index', err, 'Could not load site pages.')
    }
  }

  const tab = parseTab(sp.get('tab')) ?? 'clinics'

  try {
    // ── Drawer ──────────────────────────────────────────────────────────────
    const detailId = sp.get('detail')
    if (detailId) {
      const id = Number(detailId)
      if (!Number.isInteger(id) || id < 1) {
        return NextResponse.json({ error: 'detail must be a document id.' }, { status: 400 })
      }
      const detail = await fetchContentDetail(pool, tab, id)
      if (!detail) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
      return NextResponse.json({ success: true, detail, readinessLabels: READINESS_LABELS[tab] })
    }

    // ── List ────────────────────────────────────────────────────────────────
    const filters = readFilters(sp)
    const sortParam = sp.get('sort') as SortKey | null
    const sort: SortKey = sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'name'
    const page = Math.max(1, Number(sp.get('page')) || 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit')) || 50))

    // Facets and summary do not change with the filters, so they are only worth
    // fetching on the first page. Every later page skips two queries.
    const wantAux = page === 1
    const [list, summary, facets] = await Promise.all([
      fetchContentPage(pool, tab, filters, sort, page, limit),
      wantAux ? fetchContentSummary(pool, tab) : Promise.resolve(null),
      wantAux ? fetchContentFacets(pool, tab) : Promise.resolve(null),
    ])

    return NextResponse.json({
      success: true,
      tab,
      rows: list.rows,
      total: list.total,
      page,
      limit,
      summary,
      facets,
      readinessLabels: READINESS_LABELS[tab],
    })
  } catch (err: any) {
    return serverError('admin/content-index', err, 'Could not load content.')
  }
}

/**
 * Bulk index / exclude / requeue.
 *
 * Two selection modes: an explicit list of document ids, or "everything matching
 * the current filter". The second is the one that matters at 39,639 rows, and it
 * is why the same WHERE builder is reused rather than reimplemented -- the count
 * the operator saw and the rows that get written have to come from one place.
 *
 * Admin only. The collection itself allows editors, but a bulk SEO lever is a
 * narrower privilege than editing one row. dryRun defaults to true.
 */
export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const limited = await enforceLimit(req, writeLimiter, 'content-index-bulk')
  if (limited) return limited

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const action = String(body?.action ?? '')
  if (!['index', 'exclude', 'requeue'].includes(action)) {
    return NextResponse.json({ error: 'action must be index | exclude | requeue.' }, { status: 400 })
  }

  const dryRun = body?.dryRun !== false
  const pool = (payload.db as any).pool

  // ── Site pages ────────────────────────────────────────────────────────────
  // Keyed by path, not by a source document, because nothing in the database
  // owns them: they are routes in the codebase. Applied one at a time from a
  // checklist, so no dry run and no cap.
  if (body?.tab === 'static') {
    const paths: string[] = Array.isArray(body?.paths) ? body.paths.filter((p: any) => typeof p === 'string') : []
    if (paths.length === 0) return NextResponse.json({ error: 'Provide paths.' }, { status: 400 })

    // A route pinned never-indexable in static-pages.ts cannot be submitted from
    // the UI. /search and the auth pages are decisions made in code, not toggles.
    if (action === 'index') {
      const blocked = paths.filter((p) => !STATIC_PAGES.find((s) => s.path === p)?.indexable)
      if (blocked.length) {
        return NextResponse.json(
          { error: `These pages are set never-indexable in the codebase and cannot be submitted: ${blocked.join(', ')}` },
          { status: 400 },
        )
      }
    }

    const set =
      action === 'index'
        ? `index_mode = 'indexed', indexed = publishable, indexed_at = NOW(), batch_label = 'site-pages', acknowledged = true`
        : action === 'exclude'
          ? `index_mode = 'excluded', indexed = false, indexed_at = NULL, batch_label = NULL, acknowledged = true`
          : `index_mode = 'queued', indexed = false, indexed_at = NULL, batch_label = NULL`

    try {
      const res = await pool.query(
        `UPDATE page_index SET ${set}, updated_at = NOW()
          WHERE page_type::text = 'static' AND path = ANY($1::text[])`,
        [paths],
      )
      revalidatePath('/sitemap.xml')
      return NextResponse.json({ ok: true, dryRun: false, action, changed: res.rowCount ?? 0 })
    } catch (err: any) {
      return serverError('admin/content-index', err, 'Could not update site pages.')
    }
  }

  const tab = parseTab(body?.tab)
  if (!tab) return NextResponse.json({ error: `tab must be one of ${TABS.join(', ')}, static.` }, { status: 400 })

  const sourceIds: number[] | null = Array.isArray(body?.sourceIds)
    ? body.sourceIds.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)
    : null
  const allMatching = body?.allMatching === true

  if (!allMatching && (!sourceIds || sourceIds.length === 0)) {
    return NextResponse.json({ error: 'Select some rows, or set allMatching.' }, { status: 400 })
  }

  try {
    // Resolve the selection to page_index ids. Rows with no registry row cannot
    // be indexed -- there is no url for them -- so the join is inner here even
    // though the list view uses a LEFT join to surface them.
    const params: any[] = [tab === 'clinics' ? 'clinics' : tab]
    const where: string[] = []

    if (allMatching) {
      const sp = new URLSearchParams(body?.filters ?? {})
      const f = readFilters(sp)
      if (f.importBatch) { params.push(f.importBatch); where.push(`c.import_batch = $${params.length}`) }
      if (f.status) { params.push(f.status); where.push(`c.status::text = $${params.length}`) }
      if (tab === 'clinics') {
        if (f.state) { params.push(f.state); where.push(`c.state = $${params.length}`) }
        if (f.city) { params.push(f.city); where.push(`c.city = $${params.length}`) }
        switch (f.problem) {
          case 'ready':
            where.push(
              `c.clinic_type::text <> 'other'`,
              `c.description IS NOT NULL AND c.description <> ''`,
              `EXISTS (SELECT 1 FROM clinics_rels r WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)`,
            )
            break
          case 'no-services':
            where.push(`NOT EXISTS (SELECT 1 FROM clinics_rels r WHERE r.parent_id = c.id AND r.services_id IS NOT NULL)`)
            break
          case 'no-photos':
            where.push(`NOT EXISTS (SELECT 1 FROM clinics_clinic_photo_urls p WHERE p._parent_id = c.id)`)
            break
          case 'type-other':
            where.push(`c.clinic_type::text = 'other'`)
            break
        }
      }
      if (f.q) {
        params.push(`%${f.q}%`)
        where.push(tab === 'clinics' ? `c.clinic_name ILIKE $${params.length}` : `c.title ILIKE $${params.length}`)
      }
      switch (f.submitted) {
        case 'indexed': where.push(`pi.indexed = true`); break
        case 'queued': where.push(`pi.index_mode::text = 'queued'`); break
        case 'excluded': where.push(`pi.index_mode::text = 'excluded'`); break
      }
    } else {
      params.push(sourceIds)
      where.push(`c.id = ANY($${params.length}::int[])`)
    }

    // Hard gate: only publishable rows can be batched in. Same rule as the
    // PageIndex hook and /api/admin/page-index/batch -- these three must agree.
    if (action === 'index') where.push(`pi.publishable = true`, `pi.index_mode::text <> 'excluded'`)

    const table = tab === 'clinics' ? 'clinics' : tab
    const selection = `
      FROM ${table} c
      JOIN page_index pi ON pi.source_collection = $1 AND pi.source_id = c.id::text
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`

    const { rows: counted } = await pool.query(`SELECT count(*)::int AS n ${selection}`, params)
    const matched = counted[0]?.n ?? 0

    const { rows: sample } = await pool.query(
      `SELECT pi.path, ${tab === 'clinics' ? 'c.clinic_name' : 'c.title'} AS name ${selection} ORDER BY c.id LIMIT 10`,
      params,
    )

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, action, matched,
        wouldChange: Math.min(matched, MAX_BULK),
        capped: matched > MAX_BULK ? MAX_BULK : null,
        sample,
      })
    }

    const batchLabel =
      String(body?.label ?? '').trim() ||
      `${tab}-${action}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`

    const writeParams = [...params, MAX_BULK]
    const limitPlaceholder = `$${writeParams.length}`

    let setClause: string
    if (action === 'index') {
      writeParams.push(batchLabel)
      setClause = `index_mode = 'indexed', indexed = true, indexed_at = NOW(),
                   batch_label = $${writeParams.length}, acknowledged = true`
    } else if (action === 'exclude') {
      setClause = `index_mode = 'excluded', indexed = false, indexed_at = NULL,
                   batch_label = NULL, acknowledged = true`
    } else {
      setClause = `index_mode = 'queued', indexed = false, indexed_at = NULL, batch_label = NULL`
    }

    const res = await pool.query(
      `WITH picked AS (SELECT pi.id ${selection} ORDER BY c.id LIMIT ${limitPlaceholder})
       UPDATE page_index p SET ${setClause}, updated_at = NOW()
         FROM picked WHERE p.id = picked.id
       RETURNING p.path`,
      writeParams,
    )
    const changed = res.rowCount ?? 0

    try {
      await payload.create({
        collection: 'audit-logs',
        overrideAccess: true,
        data: {
          action: 'update',
          collectionSlug: 'page-index',
          documentTitle: `Content indexing (${tab})`,
          userEmail: user?.email ?? 'unknown',
          userId: String(user?.id ?? ''),
          summary:
            `${action}: ${changed} ${tab} url(s)` +
            (action === 'index' ? ` batched in as "${batchLabel}"` : '') +
            (allMatching ? ` (all matching filter ${JSON.stringify(body?.filters ?? {})})` : ` (${sourceIds?.length} selected)`),
          changedFields: ['indexMode', 'indexed', 'batchLabel'],
        },
      })
    } catch (e) {
      payload.logger?.error(`[audit] content bulk log failed: ${e}`)
    }

    // Sitemap only. Per-page robots tags refresh on their own ISR cycle (300s);
    // calling revalidatePath for thousands of paths here would cost far more
    // than letting them expire.
    revalidatePath('/sitemap.xml')

    return NextResponse.json({
      ok: true, dryRun: false, action, matched, changed,
      batchLabel: action === 'index' ? batchLabel : null,
      remaining: Math.max(0, matched - changed),
      note: 'Sitemap updates now. Individual page robots tags refresh as their cache expires (up to 5 minutes).',
    })
  } catch (err: any) {
    return serverError('admin/content-index', err, 'Bulk update failed.')
  }
}

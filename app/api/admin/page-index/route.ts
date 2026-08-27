import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdminOrEditor } from '@/lib/auth-guards'
import { checkOrigin } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { INDEX_THRESHOLDS, PAGE_TYPE_LABELS, COMPUTED_PAGE_TYPES } from '@/lib/markets'

export const runtime = 'nodejs'

/**
 * GET: aggregate stats for the Indexing screen.
 *
 * The old GET returned a 50-row "unacknowledged pages" list plus one indexed
 * count, because the screen was a per-page review queue. That queue does not
 * scale: there are ~92,000 urls, 51,099 of them were sitting unacknowledged, and
 * the panel showed ten at a time with one button each. This returns the aggregate
 * the batch tool needs instead, so the operator can see the shape of the rollout
 * and pick a slice.
 */
export async function GET(_req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  try {
    const pool = (payload.db as any).pool

    // Single-url lookup. Auto-generated pages are controlled by rule, not row by
    // row, but "find this one page and tell me why it is not in Google" is a real
    // question and there is no other way to answer it without hand-writing a
    // where-clause into the URL bar.
    const lookup = (_req.nextUrl.searchParams.get('lookup') ?? '').trim()
    if (lookup) {
      const { rows: found } = await pool.query(
        `SELECT id, path, page_type::text AS "pageType", index_mode::text AS "indexMode",
                indexed, publishable, meets_threshold AS "meetsThreshold",
                data_count::int AS "dataCount", batch_label AS "batchLabel",
                indexed_at AS "indexedAt", last_scanned_at AS "lastScannedAt"
           FROM page_index
          WHERE path ILIKE $1
          ORDER BY length(path), path
          LIMIT 20`,
        [`%${lookup}%`],
      )
      return NextResponse.json({ success: true, lookup: found })
    }

    const { rows } = await pool.query(
      `SELECT page_type::text                             AS "pageType",
              count(*)::int                               AS total,
              sum((indexed)::int)::int                    AS indexed,
              sum((index_mode = 'queued')::int)::int      AS queued,
              sum((index_mode = 'excluded')::int)::int    AS excluded,
              -- "ready" is the batch tool's default candidate set.
              sum((index_mode = 'queued' AND publishable
                   AND meets_threshold)::int)::int        AS ready,
              -- Queued and real, but too thin to offer up by default.
              sum((index_mode = 'queued' AND publishable
                   AND NOT meets_threshold)::int)::int    AS "belowThreshold",
              -- Nothing to show: unpublished doc, emptied page, or a static route
              -- pinned never-indexable.
              sum((NOT publishable)::int)::int            AS "notPublishable",
              sum((NOT acknowledged)::int)::int           AS "newUntriaged"
         FROM page_index
        GROUP BY 1
        ORDER BY total DESC`,
    )

    const KEYS = [
      'total', 'indexed', 'queued', 'excluded',
      'ready', 'belowThreshold', 'notPublishable', 'newUntriaged',
    ] as const
    const totals: Record<string, number> = {}
    for (const k of KEYS) totals[k] = 0
    for (const r of rows as any[]) {
      for (const k of KEYS) totals[k] += Number(r[k]) || 0
    }

    // Recent batches, so a rollout is auditable and one batch can be rolled back.
    const { rows: batches } = await pool.query(
      `SELECT batch_label AS "batchLabel",
              count(*)::int AS urls,
              min(indexed_at) AS "firstAt"
         FROM page_index
        WHERE batch_label IS NOT NULL
        GROUP BY 1
        ORDER BY min(indexed_at) DESC NULLS LAST
        LIMIT 15`,
    )

    // States that actually have auto-generated pages, so the rule builder's
    // dropdown only offers scopes that can return something.
    const { rows: states } = await pool.query(
      `SELECT state_slug AS slug, count(*)::int AS urls,
              count(*) FILTER (WHERE index_mode::text = 'queued' AND publishable)::int AS waiting
         FROM page_index
        WHERE state_slug IS NOT NULL
          AND page_type::text = ANY($1)
        GROUP BY 1 ORDER BY 2 DESC`,
      [[...COMPUTED_PAGE_TYPES]],
    )

    return NextResponse.json({
      success: true,
      byType: rows,
      totals,
      batches,
      states,
      thresholds: INDEX_THRESHOLDS,
      labels: PAGE_TYPE_LABELS,
      computedTypes: COMPUTED_PAGE_TYPES,
    })
  } catch (err: any) {
    return serverError('admin/page-index', err, 'Could not load the url registry.')
  }
}

/**
 * PATCH: act on a single url. Kept for one-off corrections from a row-level UI;
 * bulk work goes through /api/admin/page-index/batch.
 *
 * Body: { id, action: 'ack' | 'index' | 'exclude' | 'requeue' }
 *  - ack     -> mark triaged, leave the indexing decision alone
 *  - index   -> batch this one url in
 *  - exclude -> never index
 *  - requeue -> back to the queue
 */
export async function PATCH(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdminOrEditor(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }
  const id = body?.id
  const action = body?.action
  if (!id || !['ack', 'index', 'exclude', 'requeue'].includes(action)) {
    return NextResponse.json(
      { error: 'Provide id and action (ack | index | exclude | requeue).' },
      { status: 400 },
    )
  }

  const indexMode =
    action === 'index' ? 'indexed'
      : action === 'exclude' ? 'excluded'
        : action === 'requeue' ? 'queued'
          : undefined

  try {
    // Routed through payload.update so the collection's beforeChange hook resolves
    // `indexed`. That means a row which is not publishable cannot be forced live
    // here either, matching the batch endpoint.
    await payload.update({
      collection: 'page-index' as any, id, overrideAccess: true,
      data: { acknowledged: true, ...(indexMode ? { indexMode } : {}) },
    })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return serverError('admin/page-index', err, 'Update failed.')
  }
}

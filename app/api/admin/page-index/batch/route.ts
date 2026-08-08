import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { revalidatePath } from 'next/cache'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { checkOrigin, enforceLimit, RateLimiter } from '@/lib/rate-limit'
import { serverError } from '@/lib/api-errors'
import { PAGE_TYPES } from '@/lib/markets'

export const runtime = 'nodejs'

/**
 * Batch indexing: the control that makes a slow, deliberate search rollout
 * possible. Pick a slice of the url registry, pick how many, and flip that many
 * urls in one action -- instead of editing 92,000 rows by hand, or handing the
 * whole site to Google at once.
 *
 * This generalises what `npm run drip:index` did for guides and news only, from
 * the terminal, to every page type from the admin UI.
 *
 * Safety, because this is the highest-leverage write in the admin:
 *  - admin only. The collection itself allows editors, but a bulk SEO lever is a
 *    narrower privilege than editing one row.
 *  - dryRun defaults to TRUE. A caller must explicitly send `dryRun: false` to
 *    write anything, so a malformed request reports instead of acting.
 *  - MAX_PER_CALL caps one action, so a fat-fingered count cannot publish the
 *    entire registry in one request.
 *  - every write is stamped with a batchLabel and an audit-log entry, and
 *    `action: 'rollback'` can undo one labelled batch wholesale.
 *  - 'index' can only ever touch rows that are already publishable, so a draft or
 *    emptied page cannot be batched live.
 */

const MAX_PER_CALL = 10_000
const limiter = new RateLimiter(20, 60_000)

type Filter = {
  pageTypes?: string[]
  stateSlug?: string
  serviceSlug?: string
  brandSlug?: string
  /** Only rows clearing their per-type threshold. Default true. */
  onlyReady?: boolean
  /** Only rows not yet triaged. */
  onlyUnacknowledged?: boolean
}

/** Builds the shared WHERE clause. Every value is parameterised. */
function buildWhere(
  action: string,
  filter: Filter,
  params: any[],
): string {
  const clauses: string[] = []

  // Which rows is this action even allowed to consider?
  if (action === 'index') {
    // Hard gate: never batch in something with nothing to show.
    clauses.push(`index_mode = 'queued'`, `publishable = true`)
  } else if (action === 'exclude') {
    clauses.push(`index_mode <> 'excluded'`)
  } else if (action === 'requeue') {
    clauses.push(`index_mode <> 'queued'`)
  }

  if (filter.pageTypes?.length) {
    params.push(filter.pageTypes)
    clauses.push(`page_type::text = ANY($${params.length})`)
  }
  if (filter.stateSlug) {
    params.push(filter.stateSlug)
    clauses.push(`state_slug = $${params.length}`)
  }
  if (filter.serviceSlug) {
    params.push(filter.serviceSlug)
    clauses.push(`service_slug = $${params.length}`)
  }
  if (filter.brandSlug) {
    params.push(filter.brandSlug)
    clauses.push(`brand_slug = $${params.length}`)
  }
  // Advisory threshold, on by default: the batch tool offers up good pages first,
  // but an admin can deliberately include thin ones by sending onlyReady: false.
  if (filter.onlyReady !== false) {
    clauses.push(`meets_threshold = true`)
  }
  if (filter.onlyUnacknowledged) {
    clauses.push(`acknowledged = false`)
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
}

function orderBy(sort: string): string {
  // id is always the tiebreaker so repeated calls are deterministic and cannot
  // re-pick or skip a row between two requests.
  switch (sort) {
    case 'oldest':
      // Fairest drip: whatever has been waiting longest goes first.
      return `first_seen_with_data ASC NULLS LAST, id ASC`
    case 'data-asc':
      return `data_count ASC, id ASC`
    default:
      // Best-first: the pages most likely to rank get indexed earliest.
      return `data_count DESC, id ASC`
  }
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

  const limited = await enforceLimit(req, limiter, 'page-index-batch')
  if (limited) return limited

  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }) }

  const action = String(body?.action ?? '')
  if (!['index', 'exclude', 'requeue', 'rollback'].includes(action)) {
    return NextResponse.json(
      { error: 'action must be index | exclude | requeue | rollback.' },
      { status: 400 },
    )
  }

  // Default-safe: only an explicit `false` writes.
  const dryRun = body?.dryRun !== false
  const pool = (payload.db as any).pool

  // ── rollback: undo one labelled batch wholesale ────────────────────────────
  if (action === 'rollback') {
    const label = String(body?.batchLabel ?? '').trim()
    if (!label) return NextResponse.json({ error: 'batchLabel is required to roll back.' }, { status: 400 })

    const { rows: pre } = await pool.query(
      `SELECT count(*)::int AS n FROM page_index WHERE batch_label = $1`,
      [label],
    )
    const matched = pre[0]?.n ?? 0
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, action, batchLabel: label, matched, changed: 0 })
    }

    const res = await pool.query(
      `UPDATE page_index
          SET index_mode = 'queued', indexed = false, indexed_at = NULL,
              batch_label = NULL, updated_at = NOW()
        WHERE batch_label = $1`,
      [label],
    )
    await logBatch(payload, user, `rollback of batch "${label}": ${res.rowCount} url(s) returned to Queued`)
    revalidatePath('/sitemap.xml')
    return NextResponse.json({ ok: true, dryRun: false, action, batchLabel: label, matched, changed: res.rowCount ?? 0 })
  }

  // ── index / exclude / requeue ──────────────────────────────────────────────
  const filter: Filter = body?.filter ?? {}
  if (filter.pageTypes?.length) {
    const bad = filter.pageTypes.filter((t) => !(PAGE_TYPES as readonly string[]).includes(t))
    if (bad.length) return NextResponse.json({ error: `Unknown page type(s): ${bad.join(', ')}` }, { status: 400 })
  }

  const requested = Number(body?.count ?? 0)
  if (!Number.isInteger(requested) || requested < 1) {
    return NextResponse.json({ error: 'count must be a positive integer.' }, { status: 400 })
  }
  const count = Math.min(requested, MAX_PER_CALL)

  const params: any[] = []
  const where = buildWhere(action, filter, params)
  const sort = orderBy(String(body?.sort ?? 'data-desc'))

  try {
    // How many rows does this filter match in total, regardless of `count`? The
    // UI shows this so "index 500 of 41,529 waiting" is visible before acting.
    const { rows: totals } = await pool.query(
      `SELECT count(*)::int AS matched FROM page_index ${where}`,
      params,
    )
    const matched = totals[0]?.matched ?? 0

    // Always return a sample, dry run or not, so the caller can eyeball what the
    // filter actually selected rather than trusting a number.
    const sampleParams = [...params, Math.min(count, 10)]
    const { rows: sample } = await pool.query(
      `SELECT path, page_type::text AS "pageType", data_count::int AS "dataCount"
         FROM page_index ${where} ORDER BY ${sort} LIMIT $${sampleParams.length}`,
      sampleParams,
    )

    if (dryRun) {
      return NextResponse.json({
        ok: true, dryRun: true, action, matched,
        wouldChange: Math.min(matched, count),
        capped: requested > MAX_PER_CALL ? MAX_PER_CALL : null,
        sample,
      })
    }

    const batchLabel =
      String(body?.label ?? '').trim() ||
      `${action}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`

    // SET clause per action. `indexed` is derived here exactly as PageIndex's
    // beforeChange hook derives it -- these two must not drift.
    const setClause =
      action === 'index'
        ? `index_mode = 'indexed', indexed = true, indexed_at = NOW(), batch_label = $LABEL, acknowledged = true`
        : action === 'exclude'
          ? `index_mode = 'excluded', indexed = false, indexed_at = NULL, batch_label = NULL, acknowledged = true`
          : `index_mode = 'queued', indexed = false, indexed_at = NULL, batch_label = NULL`

    const writeParams = [...params, count]
    const limitPlaceholder = `$${writeParams.length}`
    let finalSet = setClause
    if (action === 'index') {
      writeParams.push(batchLabel)
      finalSet = setClause.replace('$LABEL', `$${writeParams.length}`)
    }

    // CTE picks the exact ids first, so the LIMIT applies to selection rather
    // than to an UPDATE (which has no ordered LIMIT of its own).
    const res = await pool.query(
      `WITH picked AS (
         SELECT id FROM page_index ${where} ORDER BY ${sort} LIMIT ${limitPlaceholder}
       )
       UPDATE page_index p
          SET ${finalSet}, updated_at = NOW()
         FROM picked
        WHERE p.id = picked.id
       RETURNING p.path`,
      writeParams,
    )

    const changed = res.rowCount ?? 0
    await logBatch(
      payload, user,
      `${action}: ${changed} url(s)` +
      (action === 'index' ? ` batched in as "${batchLabel}"` : '') +
      ` (filter: ${JSON.stringify(filter)}, sort: ${body?.sort ?? 'data-desc'})`,
    )

    // Only the sitemap index is revalidated. Per-page robots tags refresh on
    // their own ISR cycle -- calling revalidatePath for thousands of paths here
    // would be far more expensive than letting them expire.
    revalidatePath('/sitemap.xml')

    return NextResponse.json({
      ok: true, dryRun: false, action, matched, changed,
      batchLabel: action === 'index' ? batchLabel : null,
      remaining: Math.max(0, matched - changed),
      note: 'Sitemap updates immediately. Individual page robots tags refresh as their cache expires (up to 1 hour).',
      sample,
    })
  } catch (err: any) {
    // Never hand the caller err.message -- pg errors carry table, column,
    // constraint and sometimes the SQL text. serverError logs the full detail
    // against a random ref and returns only the ref. See lib/api-errors.ts.
    return serverError('admin/page-index/batch', err, 'Batch failed.')
  }
}

async function logBatch(payload: any, user: any, summary: string) {
  try {
    await payload.create({
      collection: 'audit-logs',
      overrideAccess: true,
      data: {
        action: 'update',
        collectionSlug: 'page-index',
        documentTitle: 'Batch indexing',
        userEmail: user?.email ?? 'unknown',
        userId: String(user?.id ?? ''),
        summary,
        changedFields: ['indexMode', 'indexed', 'batchLabel'],
      },
    })
  } catch (err) {
    payload.logger?.error(`[audit] failed to log batch indexing: ${err}`)
  }
}

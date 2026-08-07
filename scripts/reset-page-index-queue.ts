/**
 * reset-page-index-queue.ts — clear the indexing slate so the manual rollout
 * starts from zero.
 *
 * The schema migration (migrate-pre-push.sql + migrate-page-index-registry.sql)
 * is deliberately non-destructive: it preserves whatever each url's resolved
 * `indexed` value already was. This script is the opposite, and it is the ONLY
 * thing that de-indexes in bulk, which is why it is opt-in, dry-run by default,
 * and refuses to run against a live-indexed site.
 *
 * What it does:
 *   indexMode -> 'queued', indexed -> false, indexedAt/batchLabel -> null
 *   acknowledged -> true   (baseline: everything existing counts as already
 *                          triaged, so the "new since you last looked" feed on
 *                          the Indexing screen starts empty instead of showing
 *                          51k rows)
 *
 * What it leaves alone:
 *   indexMode='excluded' rows. Someone decided those on purpose; a reset is not
 *   a reason to reopen that decision.
 *
 * Usage:
 *   npx tsx --env-file=.env.staging scripts/reset-page-index-queue.ts            # dry run
 *   npx tsx --env-file=.env.staging scripts/reset-page-index-queue.ts --apply
 *   ... --apply --force    # required when the site is NOT sitewide-noindex
 *
 * NOTE: pass --env-file explicitly. Do NOT use `npm run` wrappers for this --
 * every script in package.json is hardcoded to --env-file=.env.local, and
 * .env.local points at PRODUCTION.
 */

import pg from 'pg'
import { getDbSsl, getDbConnectionString } from '../lib/db-ssl'

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const FORCE = args.includes('--force')

async function run() {
  const connectionString = getDbConnectionString()
  if (!connectionString) {
    console.error('[reset-queue] No DATABASE_URI. Pass --env-file=.env.staging')
    process.exit(1)
  }

  // Show which database this is about to touch before doing anything. The
  // .env.local / .env.staging mixup is the expensive mistake here.
  const host = (() => {
    try { return new URL(connectionString).host } catch { return 'unparseable' }
  })()
  console.log(`[reset-queue] Database host: ${host}`)
  console.log(`[reset-queue] Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  // Small pool on purpose: the live app's own pool is capped at 4 to stay under
  // the 25-connection ceiling, so a script must not add real contention.
  const pool = new pg.Pool({ connectionString, ssl: getDbSsl(), max: 2 })

  try {
    const { rows: cfg } = await pool.query(
      `SELECT COALESCE(site_noindex, true) AS site_noindex FROM site_config LIMIT 1`,
    )
    const siteNoindex = cfg[0]?.site_noindex !== false

    console.log(`[reset-queue] SiteConfig.siteNoindex = ${siteNoindex}`)
    if (siteNoindex) {
      console.log('[reset-queue] Site is sitewide-noindex, so nothing is in Google today. Reset is safe.\n')
    } else {
      console.log('[reset-queue] WARNING: site is LIVE-indexable. A reset here de-indexes real, ranking urls.\n')
      if (!FORCE) {
        console.error('[reset-queue] Refusing. Re-run with --force if that is genuinely intended.')
        process.exit(1)
      }
    }

    const { rows: before } = await pool.query(
      `SELECT index_mode::text AS mode,
              count(*)::int AS n,
              sum((indexed)::int)::int AS indexed
         FROM page_index
        GROUP BY 1 ORDER BY 2 DESC`,
    )
    console.log('[reset-queue] Current state:')
    console.table(before)

    const { rows: impact } = await pool.query(
      `SELECT count(*)::int AS rows_to_queue,
              sum((indexed)::int)::int AS urls_losing_index
         FROM page_index
        WHERE index_mode::text <> 'excluded'`,
    )
    console.log(
      `[reset-queue] Would move ${impact[0].rows_to_queue} rows to Queued, ` +
      `removing ${impact[0].urls_losing_index ?? 0} urls from the sitemap.`,
    )

    const { rows: unack } = await pool.query(
      `SELECT count(*)::int AS n FROM page_index WHERE acknowledged = false`,
    )
    console.log(`[reset-queue] Would acknowledge ${unack[0].n} rows (clears the new-page feed).\n`)

    if (!APPLY) {
      console.log('[reset-queue] Dry run only. Re-run with --apply to write.')
      return
    }

    const res = await pool.query(
      `UPDATE page_index
          SET index_mode   = 'queued',
              indexed      = false,
              indexed_at   = NULL,
              batch_label  = NULL,
              acknowledged = true,
              updated_at   = NOW()
        WHERE index_mode::text <> 'excluded'`,
    )
    // Excluded rows keep their decision but still get the baseline ack.
    const ack = await pool.query(
      `UPDATE page_index SET acknowledged = true, updated_at = NOW()
        WHERE acknowledged = false`,
    )

    console.log(`[reset-queue] Done. ${res.rowCount} rows queued, ${ack.rowCount} additionally acknowledged.`)

    const { rows: after } = await pool.query(
      `SELECT index_mode::text AS mode, count(*)::int AS n, sum((indexed)::int)::int AS indexed
         FROM page_index GROUP BY 1 ORDER BY 2 DESC`,
    )
    console.table(after)
    console.log('[reset-queue] Next: run the page scan so entity urls (clinics/guides/news/static) get their rows.')
  } finally {
    await pool.end()
  }
}

run().catch((err) => {
  console.error('[reset-queue] Fatal:', err)
  process.exit(1)
})

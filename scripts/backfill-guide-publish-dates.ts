/**
 * One-off: spread the guides' publishedAt across a date range.
 *
 * Why this exists: all 100 guides carried one identical publishedAt
 * (2026-07-25T20:59:19.354Z). The batch upload file shipped no per-guide
 * publishedAt, so approveContentUpload's `doc.publishedAt ?? now` fallback
 * (lib/import/content-bulk-upload.ts) stamped the whole batch with a single
 * timestamp. The original editorial package has no publish dates to recover, so
 * these are ASSIGNED dates, not recovered ones (founder's call, 2026-08-06).
 *
 * Dates are deterministic, not random: guides are ordered by a hash of their
 * slug and spread evenly across the window below. Re-running produces the same
 * result. Nothing lands in the future.
 *
 * The hash ordering matters. Every guide was created in one alphabetical import
 * run, so ordering by createdAt would hand out dates alphabetically and the
 * listing would come out in reverse-alphabetical order, which reads as machine
 * generated at a glance.
 *
 * Only `published_at` is touched. `updated_at` is left alone (it holds real
 * edit times) and `last_medically_reviewed` stays at 2026-07-20 for every
 * guide, which is correct: the source package really does record a single
 * review date for the whole set.
 *
 * Raw SQL rather than the Payload local API on purpose: one statement instead
 * of 100 round trips to a remote database. Nothing is lost by skipping the
 * hooks here. revalidateAfterChange is already a no-op outside a Next request
 * (see lib/revalidate-hook.ts), and pages refresh on their own ISR timer.
 *
 * Usage (STAGING):
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-publish-dates.ts
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-publish-dates.ts --apply
 *
 * Default is a dry run. Nothing is written without --apply.
 */

import pg from 'pg'

const WINDOW_START = Date.UTC(2026, 1, 1, 9, 0, 0) // 2026-02-01 09:00 UTC
const WINDOW_END = Date.UTC(2026, 6, 25, 9, 0, 0) // 2026-07-25 09:00 UTC, the real go-live day
const DAY = 24 * 60 * 60 * 1000

/** FNV-1a. Stable across runs, unlike Math.random or row order. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('DATABASE_URI is not set. Pass --env-file=.env.staging')

  console.log(`\nDatabase host : ${new URL(uri).host}`)
  console.log(`Mode          : ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`)

  // Small pool on purpose: the live app's pool is capped at 4 against a 25
  // connection ceiling, so a script must not add real contention.
  const pool = new pg.Pool({ connectionString: uri, max: 2, ssl: { rejectUnauthorized: false } })

  try {
    const res = await pool.query<{ id: number; slug: string; published_at: string | null }>(
      'select id, slug, published_at from guides',
    )
    const guides = res.rows
    if (guides.length === 0) {
      console.log('No guides found. Nothing to do.')
      return
    }

    const totalDays = Math.round((WINDOW_END - WINDOW_START) / DAY)
    const span = guides.length > 1 ? totalDays / (guides.length - 1) : 0

    const plan = [...guides]
      .sort((a, b) => hash(a.slug) - hash(b.slug))
      .map((g, i) => ({
        id: g.id,
        slug: g.slug,
        from: g.published_at,
        to: new Date(WINDOW_START + Math.round(i * span) * DAY).toISOString(),
      }))

    console.log(`Guides        : ${guides.length}`)
    console.log(
      `Window        : ${new Date(WINDOW_START).toISOString().slice(0, 10)} to ${new Date(WINDOW_END).toISOString().slice(0, 10)}`,
    )
    console.log(`Distinct dates: ${new Set(plan.map((p) => p.to)).size}\n`)

    console.log('First 5 and last 5:')
    for (const p of [...plan.slice(0, 5), ...plan.slice(-5)]) {
      console.log(`  ${p.slug.padEnd(42)} ${String(p.from).slice(0, 10)} -> ${p.to.slice(0, 10)}`)
    }

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to write.')
      return
    }

    // One statement, fully parameterized.
    const tuples = plan.map((_, i) => `($${i * 2 + 1}::int, $${i * 2 + 2}::timestamptz)`).join(', ')
    const params = plan.flatMap((p) => [p.id, p.to])
    const started = Date.now()
    const upd = await pool.query(
      `update guides as g set published_at = v.pub
       from (values ${tuples}) as v(id, pub)
       where g.id = v.id`,
      params,
    )
    console.log(`\nUpdated ${upd.rowCount} rows in ${Date.now() - started}ms`)

    const check = await pool.query(
      `select count(*)::int as rows, count(distinct published_at)::int as distinct_published,
              min(published_at) as earliest, max(published_at) as latest
       from guides`,
    )
    console.table(check.rows)

    const sample = await pool.query(
      'select slug, published_at from guides order by published_at desc limit 5',
    )
    console.log('Newest 5:')
    console.table(sample.rows)
  } finally {
    await pool.end()
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

/**
 * One-off: seed guides.content_updated_at for existing guides.
 *
 * `contentUpdatedAt` is the guide's "Updated" date and schema.org dateModified.
 * Going forward the Guides beforeChange hook (lib/guide-dates.ts) sets it. This
 * fills in the past. See docs/GUIDE-DATES-2026-09-13.md.
 *
 * Source of truth: approved internal-link insertions. Each one rewrote the
 * guide body at a recorded time (`internal_link_suggestions.inserted_at`), and
 * only insertions whose link is STILL in the guide (`guides.internal_links`)
 * count. That is a verifiable content change.
 *
 * Deliberately NOT used:
 * - guides.updated_at: moves on every save (link-discovery scan, status edits,
 *   raw SQL slug work). On staging it reads 2026-09-03 for guides whose content
 *   did not change then.
 * - audit_logs "body" entries from 2026-08-05: six system writes that also
 *   changed publishedAt, on exactly the six guides that had links inserted,
 *   with no script in git that edits guide bodies. They look like a re-save,
 *   not an edit, and cannot be verified. Claiming an update we cannot prove is
 *   worse for trust than showing Published only.
 * - audit_logs "author" entries: every update lists it, because the audit hook
 *   compares an id with a populated doc. Noise.
 *
 * Guides with no qualifying insertion stay NULL: the page shows Published only
 * and dateModified equals datePublished. Rows that already have a value are
 * never touched, so re-running is safe and never overwrites the hook.
 *
 * Usage (STAGING, never .env.local which is production):
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-content-updated-at.ts
 *   npx tsx --env-file=.env.staging scripts/backfill-guide-content-updated-at.ts --apply
 *
 * Default is a dry run. Nothing is written without --apply.
 */

import pg from 'pg'

const CANDIDATES_SQL = `
  SELECT g.id, g.slug, g.published_at, max(s.inserted_at) AS last_insert, count(*)::int AS links
    FROM guides g
    JOIN internal_link_suggestions_rels r ON r.guides_id = g.id AND r.path = 'source'
    JOIN internal_link_suggestions s ON s.id = r.parent_id
   WHERE s.status = 'approved'
     AND s.inserted_at IS NOT NULL
     AND g.content_updated_at IS NULL
     AND g.published_at IS NOT NULL
     AND s.inserted_at > g.published_at
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(g.internal_links, '[]'::jsonb)) l
        WHERE l->>'targetPath' = s.target_url
     )
   GROUP BY g.id, g.slug, g.published_at
   ORDER BY g.id`

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('DATABASE_URI is not set. Pass --env-file=.env.staging')

  console.log(`\nDatabase host : ${new URL(uri).host}`)
  console.log(`Mode          : ${apply ? 'APPLY (writes)' : 'DRY RUN (no writes)'}\n`)

  const pool = new pg.Pool({ connectionString: uri, max: 2 })
  try {
    const col = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'guides' AND column_name = 'content_updated_at'`,
    )
    if (col.rowCount === 0) {
      throw new Error('guides.content_updated_at does not exist. Apply the 2026-09-13 block of scripts/migrate-pre-push.sql first.')
    }

    const { rows } = await pool.query(CANDIDATES_SQL)
    for (const r of rows) {
      console.log(
        `  ${String(r.id).padEnd(5)} ${r.slug.padEnd(40)} published ${r.published_at.toISOString().slice(0, 10)}  ->  updated ${r.last_insert.toISOString()}  (${r.links} link insert${r.links === 1 ? '' : 's'})`,
      )
    }
    console.log(`\n${rows.length} guide(s) to set.`)

    if (!apply) {
      console.log('Dry run. Re-run with --apply to write.\n')
      return
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const res = await client.query(
        `UPDATE guides g SET content_updated_at = c.last_insert
           FROM (${CANDIDATES_SQL}) c
          WHERE g.id = c.id AND g.content_updated_at IS NULL`,
      )
      if (res.rowCount !== rows.length) {
        throw new Error(`Expected ${rows.length} rows, would update ${res.rowCount}. Rolled back.`)
      }
      await client.query('COMMIT')
      console.log(`Updated ${res.rowCount} guide(s).`)
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    const check = await pool.query(
      `SELECT count(*)::int AS total, count(content_updated_at)::int AS with_updated,
              count(*) FILTER (WHERE content_updated_at < published_at)::int AS before_published
         FROM guides`,
    )
    console.log('Check:', check.rows[0], '\n')
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

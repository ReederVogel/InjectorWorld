/**
 * Raw-SQL search infrastructure (ROADMAP Phase 5).
 *
 *   npm run setup:search
 *
 * Creates the database objects that Payload/Drizzle does NOT manage and that
 * `db:push` will never build for us:
 *
 *   1. Postgres full-text GIN indexes (expression-based, no columns added) on
 *      clinics, for free-text name/clinic search.
 *   2. A PostGIS GIST geography index on clinic lat/lng for radius search
 *      (ST_DWithin). PostGIS lives in its own `postgis` schema; we reference its
 *      functions via the search_path (public, postgis).
 *   3. A `search` schema holding a small geocode cache table so typed-location
 *      lookups (Nominatim) persist across restarts without adding a Payload
 *      collection.
 *
 * WHY EXPRESSION INDEXES (not a stored tsvector column): adding a real column to
 * the `clinics` table would put it in the `public` schema where
 * Drizzle's `push` reconciles to the Payload schema and could drop it. Expression
 * indexes add no column, and the `search` schema is isolated exactly like the
 * `postgis` schema, so `db:push` leaves all of this alone.
 *
 * Idempotent: every statement is CREATE ... IF NOT EXISTS. Safe to re-run.
 *
 * IMPORTANT: `db:push` (Drizzle force-push) DROPS the public-table expression
 * indexes (verified) because they are not in the Payload schema. The geocode
 * cache survives (isolated `search` schema). So `npm run build` runs this script
 * right after `db:push` to rebuild the indexes on every deploy. After any manual
 * local `db:push`, re-run `npm run setup:search`. Search stays CORRECT without the
 * indexes (queries seq-scan); only performance depends on them.
 *
 * The full-text expression is duplicated in `lib/search-sql.ts` (
 * CLINIC_TSV) so the query planner can use these indexes. Keep them in sync.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { CLINIC_TSV, CLINIC_GEOG } from '../lib/search-sql'


async function main() {
  // Mirror db-push: on a build with no database configured, skip cleanly rather
  // than crash. (Local `npm run build` runs without --env-file.)
  if (!process.env.DATABASE_URI) {
    console.log('[setup:search] No DATABASE_URI in environment. Skipping index setup.')
    process.exit(0)
  }

  const payload = await getPayload({ config })
  const pool = (payload.db as any).pool
  if (!pool) throw new Error('No Postgres pool on payload.db')

  // `fatal: false` = best-effort. PostGIS is not present on every Postgres
  // (e.g. Railway's default Postgres image ships without it), so anything that
  // depends on PostGIS must NOT break the build/deploy. The full-text GIN
  // indexes and the geocode cache do not need PostGIS and stay fatal.
  // Without the geography index, radius search degrades (seq-scan, or no geo
  // results if PostGIS is entirely absent) but the rest of search is unaffected.
  const statements: { label: string; sql: string; fatal?: boolean }[] = [
    {
      // Best-effort: enable PostGIS so the geography index below can build.
      // Fails harmlessly on Postgres images that don't bundle PostGIS, or where
      // the role lacks permission. DO Managed Postgres + a PostGIS-enabled DB
      // will succeed here and get the real radius index.
      label: 'PostGIS extension (best-effort)',
      sql: `CREATE EXTENSION IF NOT EXISTS postgis;`,
      fatal: false,
    },
    {
      // DROP + CREATE (not IF NOT EXISTS): the tsvector expression changed in
      // Phase 13 (weights + clinic address), so an old index from a prior run
      // would no longer match the query expression and the planner would ignore
      // it. Dropping first guarantees the rebuilt index matches search-sql.ts.
      label: 'clinics full-text GIN index',
      sql: `DROP INDEX IF EXISTS clinics_fts_idx;
            CREATE INDEX clinics_fts_idx ON clinics USING gin (${CLINIC_TSV});`,
    },
    {
      // Best-effort, same reasoning as PostGIS above: not every Postgres image
      // bundles pg_trgm. Powers the AI assistant's typo-tolerant fallback
      // (lib/assistant/fuzzy-clinic-search.ts) only -- the main tsquery search
      // used by the manual search bar does not depend on this.
      label: 'pg_trgm extension (best-effort)',
      sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
      fatal: false,
    },
    {
      label: 'clinics trigram GIN index (name typo tolerance)',
      sql: `CREATE INDEX IF NOT EXISTS clinics_name_trgm_idx ON clinics USING gin (clinic_name gin_trgm_ops);`,
      fatal: false,
    },
    {
      label: 'clinics PostGIS geography GIST index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_geog_idx
              ON clinics USING gist ((${CLINIC_GEOG}))
              WHERE latitude IS NOT NULL AND longitude IS NOT NULL
                AND latitude <> 0 AND longitude <> 0;`,
      fatal: false,
    },
    {
      // Every "top rated clinics" listing (homepage hero, brand/service pillar
      // pages, state/city directories, /clinics) filters on
      // status='published' then sorts by aggregate_rating_count DESC. With no
      // index on either column, Postgres had to sequentially scan and fully
      // sort the whole clinics table on every one of those queries -- fine at
      // ~17k rows, but after the 2026-07-28/29 batch imports pushed the table
      // past 29k rows (each carrying far more brandsOffered/servicesOffered
      // relations than before), this became expensive enough to spike server
      // memory and crash the app (confirmed via DO runtime logs showing
      // repeated OOM-pattern restarts + a Postgres temp-file spill on exactly
      // this query shape). This composite index lets the planner satisfy the
      // filter+sort directly instead of touching every row.
      label: 'clinics status+rating composite index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_status_rating_idx
              ON clinics (status, aggregate_rating_count DESC);`,
    },
    {
      // Listing order became `has_photo DESC, aggregate_rating_count DESC, ...`
      // on 2026-09-03 (a clinic with no photo should not sit at the top of a
      // city page). The index has to carry has_photo in the same position as
      // the ORDER BY, otherwise the planner falls back to sorting the whole
      // filtered set instead of walking the index -- which is what the
      // status+rating index above exists to prevent in the first place.
      label: 'clinics status+photo+rating composite index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_status_photo_rating_idx
              ON clinics (status, has_photo DESC, aggregate_rating_count DESC NULLS LAST,
                          created_at DESC, id DESC);`,
      fatal: false,
    },
    {
      label: 'search schema',
      sql: `CREATE SCHEMA IF NOT EXISTS search;`,
    },
    {
      label: 'geocode cache table',
      sql: `CREATE TABLE IF NOT EXISTS search.geocode_cache (
              query     text PRIMARY KEY,
              lat       double precision,
              lng       double precision,
              label     text,
              provider  text NOT NULL DEFAULT 'nominatim',
              hit_count integer NOT NULL DEFAULT 1,
              created_at timestamptz NOT NULL DEFAULT now(),
              updated_at timestamptz NOT NULL DEFAULT now()
            );`,
    },
    {
      // Providers were removed on 2026-08-24. Drop the leftover search
      // artefacts so a database that predates that change ends up clean.
      label: 'drop provider search artefacts',
      sql: `DROP INDEX IF EXISTS providers_fts_idx;
            DROP TABLE IF EXISTS search.provider_doc;`,
    },
  ]

  for (const { label, sql, fatal } of statements) {
    process.stdout.write(`- ${label} ... `)
    try {
      await pool.query(sql)
      console.log('ok')
    } catch (err) {
      if (fatal === false) {
        // Do not break the deploy: log and move on.
        console.log('skipped')
        console.warn(`  (non-fatal) ${(err as Error).message}`)
      } else {
        throw err
      }
    }
  }

  // Report final index/object state so the operator can confirm.
  const idx = await pool.query(
    `select indexname from pg_indexes
       where schemaname='public' and indexname in ('clinics_fts_idx','clinics_geog_idx')
       order by indexname`,
  )
  const cache = await pool.query(
    `select to_regclass('search.geocode_cache') as t`,
  )
  console.log('\nSearch indexes present:', idx.rows.map((r: any) => r.indexname).join(', ') || '(none)')
  console.log('Geocode cache table:', cache.rows[0].t ?? '(missing)')
  console.log('\nDone. Re-run this after any `npm run db:push`.')
  process.exit(0)
}

main().catch((err) => {
  console.error('\nsetup-search-indexes failed:')
  console.error(err)
  process.exit(1)
})

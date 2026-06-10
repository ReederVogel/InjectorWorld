/**
 * Raw-SQL search infrastructure (ROADMAP Phase 5).
 *
 *   npm run setup:search
 *
 * Creates the database objects that Payload/Drizzle does NOT manage and that
 * `db:push` will never build for us:
 *
 *   1. Postgres full-text GIN indexes (expression-based, no columns added) on
 *      providers + clinics, for free-text name/clinic search.
 *   2. A PostGIS GIST geography index on clinic lat/lng for radius search
 *      (ST_DWithin). PostGIS lives in its own `postgis` schema; we reference its
 *      functions via the search_path (public, postgis).
 *   3. A `search` schema holding a small geocode cache table so typed-location
 *      lookups (Nominatim) persist across restarts without adding a Payload
 *      collection.
 *
 * WHY EXPRESSION INDEXES (not a stored tsvector column): adding a real column to
 * the `providers`/`clinics` tables would put it in the `public` schema where
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
 * The full-text expression is duplicated in `lib/search-sql.ts` (PROVIDER_TSV /
 * CLINIC_TSV) so the query planner can use these indexes. Keep them in sync.
 */
import { getPayload } from 'payload'
import config from '../payload.config'
import { PROVIDER_TSV, CLINIC_TSV, CLINIC_GEOG } from '../lib/search-sql'

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
      label: 'providers full-text GIN index',
      sql: `CREATE INDEX IF NOT EXISTS providers_fts_idx
              ON providers USING gin (${PROVIDER_TSV});`,
    },
    {
      label: 'clinics full-text GIN index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_fts_idx
              ON clinics USING gin (${CLINIC_TSV});`,
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
       where schemaname='public' and indexname in ('providers_fts_idx','clinics_fts_idx','clinics_geog_idx')
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

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
// Generated, not copied: the index expression must be character-identical to the
// ORDER BY in lib/search-queries.ts or Postgres will not use the index.
import { clinicMeritSql } from '../lib/search-ranking-sql'


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
      // /clinics runs two aggregate queries in its render: the hero counters
      // (COUNT + COUNT DISTINCT state + AVG rating) and the per-state counts for
      // the state filter. Both were sequential scans over all 57,591 published
      // rows -- 3.8s and 8.4s measured on production 2026-09-04. The page fires
      // five queries in one Promise.all against a pool of 4, so those two were
      // enough to push a render past the 20s connect timeout, and the whole
      // block fell into its catch: the grid recovered client-side but the hero
      // rendered "—" instead of the counts.
      //
      // INCLUDE (not a plain composite) so both queries can be answered by an
      // index-only scan. Run VACUUM ANALYZE clinics after any bulk write, or the
      // visibility map is stale and Postgres still visits the heap.
      label: 'clinics stats covering index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_status_stats_idx
              ON clinics (status) INCLUDE (state, aggregate_rating);`,
      fatal: false,
    },
    {
      // Every brand and service page answers two questions: "which clinics
      // carry this?" and "how many per city?". Both walk clinics_rels, which
      // only had single-column indexes (brands_id, services_id, parent_id
      // separately) while the queries need brand+parent or service+parent
      // together -- so Postgres matched on one column and filtered the rest by
      // hand across 518,490 rows.
      //
      // Measured on staging, /brands/juvederm and /services/lip-filler:
      //   brand city rollup   2,074ms -> 340ms
      //   brand clinic list   1,370ms -> 278ms
      //   service city rollup 1,686ms -> 337ms
      //   service clinic list 3,640ms -> 276ms
      //
      // Partial (WHERE ... IS NOT NULL) because clinics_rels holds one row per
      // relationship and only one of the *_id columns is ever set, so each
      // index covers roughly a third of the table instead of all of it.
      label: 'clinics_rels brand+parent composite index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_rels_brand_parent_idx
              ON clinics_rels (brands_id, parent_id) WHERE brands_id IS NOT NULL;`,
      fatal: false,
    },
    {
      label: 'clinics_rels service+parent composite index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_rels_service_parent_idx
              ON clinics_rels (services_id, parent_id) WHERE services_id IS NOT NULL;`,
      fatal: false,
    },
    {
      // Second half of the brand/service page cost. Once clinics_rels hands
      // back the matching clinic ids fast (the two indexes above), what is left
      // is fetching city/state for each of them -- 11,799 heap visits for
      // juvederm alone -- just to GROUP BY city. INCLUDE puts those columns in
      // the index so the join never touches the table.
      //
      // Measured on production, server-side, after the clinics_rels indexes:
      //   brand city rollup     662ms -> 564ms
      //   service city rollup 1,465ms -> 381ms
      label: 'clinics id+city/state covering index',
      sql: `CREATE INDEX IF NOT EXISTS clinics_id_city_state_idx
              ON clinics (id) INCLUDE (city, state, status);`,
      fatal: false,
    },
    {
      // Search orders by the blended merit score (lib/search-ranking-sql.ts).
      // Without an index on that expression the planner has to read and sort
      // every matching row before it can name the first 24, which for the
      // largest brand means 51,074 rows on every search. Measured on staging
      // 2026-09-05, top-124 by merit:
      //
      //   botox brand filter   1,036ms -> 4ms
      //   juvederm                     -> 10ms
      //   lip filler service           -> 14ms
      //   state = TX                   -> 5ms
      //
      // Index is 2MB and builds in ~2s, so it is cheap in both directions.
      //
      // DROP + CREATE, like clinics_fts_idx above and for the same reason: the
      // expression is generated from clinicMeritSql() so that it matches the
      // ORDER BY exactly. If the merit weights in lib/clinic-merit.ts change,
      // the old index no longer matches the query expression and the planner
      // silently ignores it. Rebuilding every deploy keeps them in step.
      label: 'clinics merit ranking index',
      sql: `DROP INDEX IF EXISTS clinics_merit_idx;
            CREATE INDEX clinics_merit_idx
              ON clinics (((${clinicMeritSql('')})) DESC, id DESC)
              WHERE status = 'published';`,
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

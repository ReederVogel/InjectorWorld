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
import { PROVIDER_TSV, CLINIC_TSV, CLINIC_GEOG, providerDocTsv } from '../lib/search-sql'

// Full rebuild of the isolated provider extra-doc table (treatments + specialties
// + languages, which live in tables separate from the providers row). Idempotent:
// upserts every provider then prunes rows for deleted providers.
const PROVIDER_DOC_REBUILD = `
  INSERT INTO search.provider_doc (provider_id, doc, updated_at)
  SELECT p.id,
    ${providerDocTsv("coalesce(t.names,'')", "coalesce(s.names,'')", "coalesce(l.vals,'')")},
    now()
  FROM providers p
  LEFT JOIN (
    SELECT r.parent_id AS pid, string_agg(tr.name, ' ') AS names
    FROM providers_rels r JOIN services tr ON tr.id = r.services_id
    WHERE r.path = 'treatmentsOffered'
    GROUP BY r.parent_id
  ) t ON t.pid = p.id
  LEFT JOIN (
    SELECT _parent_id AS pid, string_agg(name, ' ') AS names
    FROM providers_specialties GROUP BY _parent_id
  ) s ON s.pid = p.id
  LEFT JOIN (
    SELECT parent_id AS pid, string_agg(value::text, ' ') AS vals
    FROM providers_languages GROUP BY parent_id
  ) l ON l.pid = p.id
  ON CONFLICT (provider_id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now();
  DELETE FROM search.provider_doc d
    WHERE NOT EXISTS (SELECT 1 FROM providers p WHERE p.id = d.provider_id);
`

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
      label: 'providers full-text GIN index',
      sql: `DROP INDEX IF EXISTS providers_fts_idx;
            CREATE INDEX providers_fts_idx ON providers USING gin (${PROVIDER_TSV});`,
    },
    {
      label: 'clinics full-text GIN index',
      sql: `DROP INDEX IF EXISTS clinics_fts_idx;
            CREATE INDEX clinics_fts_idx ON clinics USING gin (${CLINIC_TSV});`,
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
    {
      // Isolated denormalized provider doc (treatments + specialties + languages).
      // Lives in the `search` schema so db:push never touches it; reversible by
      // dropping the table. Kept fresh per-edit by lib/search-doc.ts and fully
      // rebuilt below on every deploy/run.
      label: 'provider extra-doc table',
      sql: `CREATE TABLE IF NOT EXISTS search.provider_doc (
              provider_id bigint PRIMARY KEY,
              doc         tsvector,
              updated_at  timestamptz NOT NULL DEFAULT now()
            );`,
    },
    {
      label: 'provider extra-doc GIN index',
      sql: `CREATE INDEX IF NOT EXISTS provider_doc_idx
              ON search.provider_doc USING gin (doc);`,
    },
    {
      label: 'provider extra-doc rebuild',
      sql: PROVIDER_DOC_REBUILD,
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
  let providerDocCount = '(missing)'
  try {
    const pd = await pool.query(`select count(*)::int as n from search.provider_doc`)
    providerDocCount = String(pd.rows[0].n)
  } catch {
    /* table absent */
  }
  console.log('\nSearch indexes present:', idx.rows.map((r: any) => r.indexname).join(', ') || '(none)')
  console.log('Geocode cache table:', cache.rows[0].t ?? '(missing)')
  console.log('Provider extra-doc rows:', providerDocCount)
  console.log('\nDone. Re-run this after any `npm run db:push`.')
  process.exit(0)
}

main().catch((err) => {
  console.error('\nsetup-search-indexes failed:')
  console.error(err)
  process.exit(1)
})

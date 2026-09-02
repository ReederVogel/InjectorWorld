-- migrate-page-index-registry.sql   (POST-push phase, via run-migrations.ts)
--
-- Companion to the page-index blocks at the bottom of migrate-pre-push.sql.
-- Split across the two phases on purpose:
--
--   pre-push   enum values + ADD COLUMN + the index_mode type swap. Must land
--              BEFORE db-push or Drizzle sees ambiguous drift and hangs on an
--              interactive "renamed or created?" prompt in CI.
--   post-push  everything here: data backfill, and the composite indexes that
--              are NOT declared in the Payload schema. db-push drops indexes it
--              does not know about (the same reason setup-search-indexes.ts runs
--              after it), so creating these earlier would just lose them.
--
-- Single-column indexes are deliberately absent: those fields carry
-- `index: true` in collections/PageIndex.ts, so db-push creates them itself with
-- these exact names. Pre-creating them here would only risk a naming mismatch.
--
-- IDEMPOTENT. Safe to re-run on every deploy.
-- See docs/DECISIONS.md 2026-08-08.

-- ── Backfill the two new gates ───────────────────────────────────────────────
-- Guarded on column existence so this no-ops on a fresh database where db-push
-- has just built the table and there is nothing to backfill.

-- A computed page is publishable when at least one published clinic matches it.
-- Entity rows (clinic/guide/news/...) get their real value from the scan, which
-- knows the source doc's publish state; they are created publishable=false and
-- corrected on the first scan, so they can never leak out early.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'page_index' AND column_name = 'publishable'
  ) THEN
    -- page_type <> 'static' matters. Static routes ALSO have a NULL
    -- source_collection (nothing in the database owns them, they are routes in
    -- the codebase) and they carry data_count = 1, so without this guard the
    -- backfill flips every one of them to publishable, including /login and
    -- /search. Worse, it re-broke them on every deploy: the scan would set them
    -- correctly from static-pages.ts, then the next deploy would undo it.
    -- Static publishability is owned by `indexable` in
    -- lib/page-index/static-pages.ts and written only by the scan. Never by a count.
    UPDATE page_index
       SET publishable = (COALESCE(data_count, 0) > 0)
     WHERE source_collection IS NULL
       AND page_type::text <> 'static'
       AND publishable IS DISTINCT FROM (COALESCE(data_count, 0) > 0);
  END IF;
END $$;

-- Thresholds MUST match INDEX_THRESHOLDS in lib/markets.ts. Only a first
-- approximation: every scan recomputes meets_threshold for every row from the
-- TypeScript source of truth, so drift here self-heals instead of sticking.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'page_index' AND column_name = 'meets_threshold'
  ) THEN
    UPDATE page_index
       SET meets_threshold = COALESCE(data_count, 0) >= CASE page_type::text
             WHEN 'service-city'         THEN 5
             WHEN 'brand-city-directory' THEN 5
             WHEN 'city-hub'             THEN 3
             WHEN 'service-state'        THEN 10
             WHEN 'brand-state'          THEN 10
             WHEN 'state-hub'            THEN 10
             WHEN 'service-pillar'       THEN 25
             WHEN 'brand-pillar'         THEN 25
             ELSE 1
           END;
  END IF;
END $$;

-- Re-resolve `indexed` under the new rule: indexMode='indexed' AND publishable.
-- This is the one statement that can change what search engines see, and it can
-- only ever REMOVE a url (a row already resolved indexed=true stays true unless
-- it has no data at all, which is exactly the leak this gate exists to close).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'page_index' AND column_name = 'publishable'
  ) THEN
    UPDATE page_index
       SET indexed = (index_mode::text = 'indexed' AND COALESCE(publishable, false))
     WHERE indexed IS DISTINCT FROM (index_mode::text = 'indexed' AND COALESCE(publishable, false));
  END IF;
END $$;

-- ── Composite indexes (not in the Payload schema) ────────────────────────────

-- The batch tool's hot query: "next N queued rows of this type that are ready,
-- best data first". Without this it degrades to a full scan over ~92k rows.
CREATE INDEX IF NOT EXISTS page_index_batch_pick_idx
  ON page_index (page_type, index_mode, publishable, meets_threshold, data_count DESC);

-- The sitemap's hot query. Partial, because only indexed rows are ever read and
-- they are a small minority of the table.
CREATE INDEX IF NOT EXISTS page_index_sitemap_idx
  ON page_index (page_type, path) WHERE indexed = true;

-- Entity rows are looked up by source doc when a clinic/guide/news doc changes
-- and its row needs re-resolving without a full scan.
CREATE INDEX IF NOT EXISTS page_index_source_lookup_idx
  ON page_index (source_collection, source_id);

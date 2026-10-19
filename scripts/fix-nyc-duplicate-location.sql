-- fix-nyc-duplicate-location.sql (2026-10-19)
--
-- Merge the duplicate NYC metro location into the live one.
--   id 51  "New York City" (new-york-city-ny): seeded 2026-06-01, not live.
--   id 962 "New York"      (new-york-ny):      import-created 2026-06-23, live, 363 clinics.
-- Both normalise to "new york,ny" in lib/location-slug-lookup.ts and id 51 won, so every
-- NYC clinic's canonical and breadcrumb pointed at a Coming soon page.
-- Plan: docs/NYC-DUPLICATE-LOCATION-PLAN-2026-10-19.md
--
-- Idempotent: every statement finds the duplicate by slug and only acts while the kept row
-- exists, so once id 51 is gone the whole file is a no-op. run-migrations.ts sends the file
-- as one multi-statement query, which Postgres runs in a single implicit transaction.

-- 1. Carry the seeded settings over to the row that stays.
UPDATE locations AS keep
   SET featured  = (COALESCE(keep.featured, false) OR COALESCE(dup.featured, false)),
       sort_rank = LEAST(COALESCE(keep.sort_rank, 999), COALESCE(dup.sort_rank, 999)),
       latitude  = COALESCE(keep.latitude, dup.latitude),
       longitude = COALESCE(keep.longitude, dup.longitude)
  FROM locations AS dup
 WHERE keep.slug = 'new-york-ny'      AND keep.kind = 'metro'
   AND dup.slug  = 'new-york-city-ny' AND dup.kind  = 'metro';

-- 2. Detach the 12 seeded neighborhoods. NOT re-parented: no NYC clinic has a neighborhood,
--    so under new-york-ny they would add a filter whose every option returns 0 clinics.
UPDATE locations
   SET parent_id = NULL
 WHERE parent_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');

-- 3. Repoint anything else that still references the duplicate (0 rows on staging and
--    production on 2026-10-19; kept so a newer reference is moved, not lost).
UPDATE faqs SET location_id = (SELECT id FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro')
 WHERE location_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');
UPDATE zip_codes SET location_id = (SELECT id FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro')
 WHERE location_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');
UPDATE promotions SET city_id = (SELECT id FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro')
 WHERE city_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');
UPDATE header_config_rels SET locations_id = (SELECT id FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro')
 WHERE locations_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');
UPDATE faq_categories_rels SET locations_id = (SELECT id FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro')
 WHERE locations_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro')
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');

-- 4. Admin edit locks on the duplicate are meaningless once it is gone.
DELETE FROM payload_locked_documents_rels
 WHERE locations_id IN (SELECT id FROM locations WHERE slug = 'new-york-city-ny' AND kind = 'metro');

-- 5. Delete the duplicate, only while the kept row exists.
DELETE FROM locations
 WHERE slug = 'new-york-city-ny' AND kind = 'metro'
   AND EXISTS (SELECT 1 FROM locations WHERE slug = 'new-york-ny' AND kind = 'metro');

-- Migrate clinics_rels from old 'treatmentsOffered' (orphan rows) to
-- new 'brandsOffered' -> juvederm for all 13,481 Juvederm-sourced clinics.
--
-- Step 1: Delete the stale orphan rows (services_id and brands_id are both NULL).
-- Step 2: Insert brandsOffered -> juvederm for every clinic in the DB.
-- Step 3: Verify counts.
--
-- Run AFTER services + brands have been seeded.
-- Run with: psql "<DO_URI>" -f scripts/migrate-clinic-rels-to-services-brands.sql

BEGIN;

-- 1. Remove stale orphan rows with old path (all have NULL ids — completely useless).
DELETE FROM clinics_rels WHERE path = 'treatmentsOffered';

-- 2. Get juvederm brand id (will error cleanly if brands not yet seeded).
DO $$
DECLARE
  juvederm_id INT;
  inserted INT;
BEGIN
  SELECT id INTO juvederm_id FROM brands WHERE slug = 'juvederm';
  IF juvederm_id IS NULL THEN
    RAISE EXCEPTION 'Juvederm brand not found in brands table. Run seed-services-brands.ts first.';
  END IF;

  -- Insert brandsOffered -> juvederm for every clinic (all from Juvederm dataset).
  INSERT INTO clinics_rels ("order", parent_id, path, brands_id)
  SELECT
    ROW_NUMBER() OVER (ORDER BY c.id) AS "order",
    c.id AS parent_id,
    'brandsOffered' AS path,
    juvederm_id AS brands_id
  FROM clinics c
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RAISE NOTICE 'Inserted % brandsOffered -> juvederm rows.', inserted;
END $$;

COMMIT;

-- Verify
SELECT path, count(*) FROM clinics_rels GROUP BY path ORDER BY path;
SELECT count(*) as total_clinics FROM clinics;
SELECT count(*) as clinics_with_brand FROM clinics_rels WHERE path='brandsOffered';

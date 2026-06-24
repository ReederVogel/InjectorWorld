-- Phase 14: ZIP codes + paid ZIP featuring
-- Run against local and live DB before deploying.
-- Idempotent (IF NOT EXISTS / ADD VALUE IF NOT EXISTS guards throughout).
--
-- NOTE (Revamp): enum_promotions_scope_type was DROPPED in the Revamp pre-push
-- migration and replaced by enum_promotions_scope. The DO blocks below that add
-- 'zip' and 'treatment+zip' are kept as no-ops (EXCEPTION catches the missing type).
-- zip_scope and zip_radius_miles columns were also removed in the Revamp Promotions
-- overhaul — do not re-add them here or they will cause schema drift on next db-push.

-- 1. zip_codes table (mirrors what Payload/Drizzle generates for ZipCodes collection)
CREATE TABLE IF NOT EXISTS "zip_codes" (
  "id"          serial PRIMARY KEY,
  "zip"         varchar(5)         NOT NULL,
  "city"        varchar            NOT NULL,
  "state"       varchar(2)         NOT NULL,
  "county"      varchar,
  "lat"         double precision   NOT NULL,
  "lng"         double precision   NOT NULL,
  "updated_at"  timestamp with time zone,
  "created_at"  timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "zip_codes_zip_idx" ON "zip_codes" ("zip");

-- GIN index on city+state for fast prefix lookups used by suggest autocomplete.
CREATE INDEX IF NOT EXISTS "zip_codes_city_idx" ON "zip_codes" USING btree (lower("city"));

-- 2. New Promotions scopeType values (legacy — enum_promotions_scope_type was dropped
--    in the Revamp. These blocks are kept so old DBs that still have the type get the
--    values added. On new DBs the EXCEPTION handler makes them a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_promotions_scope_type' AND e.enumlabel = 'zip'
  ) THEN
    ALTER TYPE "enum_promotions_scope_type" ADD VALUE 'zip';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_promotions_scope_type' AND e.enumlabel = 'treatment+zip'
  ) THEN
    ALTER TYPE "enum_promotions_scope_type" ADD VALUE 'treatment+zip';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3. zip_scope and zip_radius_miles columns were removed in the Revamp Promotions
--    overhaul (migrate-pre-push.sql drops them). Do NOT re-add them here.

-- 4. New DataAlert type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_data_alerts_type' AND e.enumlabel = 'zip_feature_request'
  ) THEN
    ALTER TYPE "enum_data_alerts_type" ADD VALUE 'zip_feature_request';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

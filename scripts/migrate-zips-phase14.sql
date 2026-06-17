-- Phase 14: ZIP codes + paid ZIP featuring
-- Run against local and live DB before deploying.
-- Idempotent (IF NOT EXISTS / ADD VALUE IF NOT EXISTS guards throughout).
--
-- This migration covers:
--   1. zip_codes table (Payload creates it via db:push, but we add it here as
--      a safety net so the live DO deploy does not hang on a new-table prompt).
--   2. New scopeType enum values for ZIP featuring on Promotions.
--   3. New columns on Promotions: zip_scope, zip_radius_miles.
--   4. New DataAlert type: zip_feature_request.

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

-- 2. New Promotions scopeType values
-- ALTER TYPE ... ADD VALUE is not transactional in Postgres, hence the DO block guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'zip'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_promotions_scope_type')
  ) THEN
    ALTER TYPE "enum_promotions_scope_type" ADD VALUE 'zip';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'treatment+zip'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_promotions_scope_type')
  ) THEN
    ALTER TYPE "enum_promotions_scope_type" ADD VALUE 'treatment+zip';
  END IF;
END $$;

-- 3. New Promotions columns
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "zip_scope"         varchar;
ALTER TABLE "promotions" ADD COLUMN IF NOT EXISTS "zip_radius_miles"  numeric DEFAULT 10;

-- Index so zip_scope lookups stay fast.
CREATE INDEX IF NOT EXISTS "promotions_zip_scope_idx" ON "promotions" ("zip_scope")
  WHERE "zip_scope" IS NOT NULL;

-- 4. New DataAlert type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'zip_feature_request'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_data_alerts_type')
  ) THEN
    ALTER TYPE "enum_data_alerts_type" ADD VALUE 'zip_feature_request';
  END IF;
END $$;

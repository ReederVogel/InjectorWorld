-- Phase 1: Clinics-first schema additions
-- Type & Status
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS clinic_type text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS data_confidence numeric;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false;

-- Services
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS offers_virtual_consult boolean NOT NULL DEFAULT false;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS accepts_new_patients boolean NOT NULL DEFAULT true;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS starting_price numeric;
-- NOTE: languages is a Drizzle join table (clinics_languages), not a jsonb column.
-- Drop the incorrect jsonb column if it was created by an older version of this migration.
ALTER TABLE clinics DROP COLUMN IF EXISTS languages;

-- Social
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_url text;

-- Providers status
ALTER TABLE providers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';

-- Set all existing clinics to published so current live data stays visible
UPDATE clinics SET status = 'published' WHERE status = 'draft';

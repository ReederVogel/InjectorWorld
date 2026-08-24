-- Phase 1: Clinics-first schema additions
-- Type & Status
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS clinic_type text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS data_confidence numeric;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false;

-- Services
-- offers_virtual_consult and accepts_new_patients were REMOVED here on 2026-08-24.
-- Both columns were dropped from Clinics on 2026-08-23 (dead fields, never
-- populated by the importer). This file runs in run-migrations.ts, i.e. AFTER
-- db-push, so re-adding them here silently resurrected both columns on every
-- single build and quietly undid that cleanup. Do not add them back.
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS starting_price numeric;
-- NOTE: clinics.languages is gone entirely as of 2026-08-23 (column, join table
-- and enum). This DROP is kept because it is still the correct end state for any
-- database that predates that change.
ALTER TABLE clinics DROP COLUMN IF EXISTS languages;

-- Social
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_url text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tiktok_url text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_url text;

-- Providers status — REMOVED 2026-08-24 with the Providers collection.
-- ALTER TABLE has no IF EXISTS for the table itself, so this line hard-failed
-- run-migrations (and therefore the whole build) the moment providers was dropped.

-- Set all existing clinics to published so current live data stays visible
UPDATE clinics SET status = 'published' WHERE status = 'draft';

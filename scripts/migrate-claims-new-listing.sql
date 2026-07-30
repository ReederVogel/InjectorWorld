-- Phase 4a: new-listing claims.
--
-- A clinic owner whose practice genuinely is not in the directory now files a
-- Claim instead of the old /api/auth/register application (which created an
-- orphan user linked to nothing). Such a claim carries the requested clinic's
-- details instead of a targetClinic; approving it creates the clinic as a draft
-- and then links it exactly like any other claim.
--
-- Additive and idempotent: three nullable columns, no backfill, no constraint
-- changes. target_clinic_id was already nullable, so nothing there needs
-- altering. Existing rows are untouched and keep working as before.
ALTER TABLE claims ADD COLUMN IF NOT EXISTS requested_clinic_name varchar;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS requested_city varchar;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS requested_state varchar;

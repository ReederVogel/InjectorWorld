-- Phase 10: Subscribers schema migration (idempotent)
-- Adds all new columns from the Phase 10 double opt-in schema.
-- Run with: psql "postgres://postgres:admin@localhost:5432/injectors_world_dev" -f scripts/migrate-subscribers-phase10.sql

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS name varchar;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'pending';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS interest_type varchar NOT NULL DEFAULT 'general';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS state_code varchar;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS treatment_tag varchar;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirm_token varchar;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at timestamp with time zone;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS ip_at_signup varchar;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;

-- Add unique constraint on email if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscribers_email_unique'
    AND conrelid = 'subscribers'::regclass
  ) THEN
    ALTER TABLE subscribers ADD CONSTRAINT subscribers_email_unique UNIQUE (email);
  END IF;
END $$;

-- Add indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm_token ON subscribers(confirm_token);
CREATE INDEX IF NOT EXISTS idx_subscribers_city_tag ON subscribers(city_tag);
CREATE INDEX IF NOT EXISTS idx_subscribers_state_code ON subscribers(state_code);

SELECT 'Phase 10 migration complete.' AS result;

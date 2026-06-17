-- Phase 15: Content bulk upload + review + gradual indexing
-- Idempotent (IF NOT EXISTS / ADD VALUE IF NOT EXISTS guards throughout).
-- Applied locally before db:push to avoid Drizzle interactive-prompt hang.
-- Also registered in scripts/run-migrations.ts for Railway/DO deploy.

-- 1. Enum types for news
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_news_review_status') THEN
    CREATE TYPE "enum_news_review_status" AS ENUM ('imported', 'in-review', 'approved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_news_index_state') THEN
    CREATE TYPE "enum_news_index_state" AS ENUM ('noindex', 'indexed');
  END IF;
END $$;

-- 2. Enum types for guides
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_guides_review_status') THEN
    CREATE TYPE "enum_guides_review_status" AS ENUM ('imported', 'in-review', 'approved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_guides_index_state') THEN
    CREATE TYPE "enum_guides_index_state" AS ENUM ('noindex', 'indexed');
  END IF;
END $$;

-- 3. New columns on news
ALTER TABLE "news"
  ADD COLUMN IF NOT EXISTS "review_status"  "enum_news_review_status"  NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS "index_state"    "enum_news_index_state"    NOT NULL DEFAULT 'noindex',
  ADD COLUMN IF NOT EXISTS "nofollow"       boolean                    NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "import_batch"   varchar,
  ADD COLUMN IF NOT EXISTS "approved_at"    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "approved_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "answer_snippet" varchar,
  ADD COLUMN IF NOT EXISTS "at_a_glance"    jsonb,
  ADD COLUMN IF NOT EXISTS "faq"            jsonb,
  ADD COLUMN IF NOT EXISTS "sources"        jsonb;

-- 4. New columns on guides
ALTER TABLE "guides"
  ADD COLUMN IF NOT EXISTS "review_status"  "enum_guides_review_status" NOT NULL DEFAULT 'imported',
  ADD COLUMN IF NOT EXISTS "index_state"    "enum_guides_index_state"   NOT NULL DEFAULT 'noindex',
  ADD COLUMN IF NOT EXISTS "nofollow"       boolean                     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "import_batch"   varchar,
  ADD COLUMN IF NOT EXISTS "approved_at"    timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "approved_by_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "answer_snippet" varchar,
  ADD COLUMN IF NOT EXISTS "at_a_glance"    jsonb,
  ADD COLUMN IF NOT EXISTS "faq"            jsonb,
  ADD COLUMN IF NOT EXISTS "sources"        jsonb;

-- 5. CRITICAL BACKFILL: existing published news → approved + indexed + nofollow=false
--    This runs every deploy (idempotent: WHERE clause only updates rows not already approved).
UPDATE "news"
  SET "review_status" = 'approved',
      "index_state"   = 'indexed',
      "nofollow"      = false
  WHERE "status" = 'published'
    AND "review_status" = 'imported';

-- 6. CRITICAL BACKFILL: ALL existing guides → approved + indexed + nofollow=false
UPDATE "guides"
  SET "review_status" = 'approved',
      "index_state"   = 'indexed',
      "nofollow"      = false
  WHERE "review_status" = 'imported';

-- 7. Indexes
CREATE INDEX IF NOT EXISTS "news_review_status_idx"  ON "news"("review_status");
CREATE INDEX IF NOT EXISTS "news_index_state_idx"    ON "news"("index_state");
CREATE INDEX IF NOT EXISTS "news_import_batch_idx"   ON "news"("import_batch");
CREATE INDEX IF NOT EXISTS "guides_review_status_idx" ON "guides"("review_status");
CREATE INDEX IF NOT EXISTS "guides_index_state_idx"  ON "guides"("index_state");
CREATE INDEX IF NOT EXISTS "guides_import_batch_idx" ON "guides"("import_batch");

-- 8. New DataAlerts enum values for content import issues
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_missing_reviewer';
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_missing_author';
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_few_sources';
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_missing_cover';
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_validation_error';
ALTER TYPE "enum_data_alerts_type" ADD VALUE IF NOT EXISTS 'content_duplicate_slug';

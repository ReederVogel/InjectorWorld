-- Phase 11: News collection
-- Run against local and Railway DB before deploying.
-- Idempotent (IF NOT EXISTS / IF EXISTS guards throughout).

-- 1. Enum types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_news_category') THEN
    CREATE TYPE "enum_news_category" AS ENUM (
      'treatment-update',
      'industry',
      'company',
      'announcement',
      'product-launch',
      'research',
      'regulation'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_news_status') THEN
    CREATE TYPE "enum_news_status" AS ENUM (
      'draft',
      'published'
    );
  END IF;
END $$;

-- 2. News table
CREATE TABLE IF NOT EXISTS "news" (
  "id"                      serial PRIMARY KEY,
  "title"                   varchar NOT NULL,
  "slug"                    varchar NOT NULL,
  "excerpt"                 varchar NOT NULL,
  "cover_image_id"          integer REFERENCES "media"("id") ON DELETE SET NULL,
  "cover_image_url"         varchar,
  "body"                    jsonb,
  "category"                "enum_news_category" NOT NULL DEFAULT 'industry',
  "author_id"               integer NOT NULL REFERENCES "authors"("id") ON DELETE SET NULL,
  "medical_reviewer_id"     integer REFERENCES "medical_reviewers"("id") ON DELETE SET NULL,
  "published_at"            timestamp with time zone,
  "related_treatment_id"    integer REFERENCES "treatments"("id") ON DELETE SET NULL,
  "status"                  "enum_news_status" NOT NULL DEFAULT 'draft',
  "featured"                boolean NOT NULL DEFAULT false,
  "meta_title"              varchar,
  "meta_description"        varchar,
  "meta_image_id"           integer REFERENCES "media"("id") ON DELETE SET NULL,
  "updated_at"              timestamp with time zone,
  "created_at"              timestamp with time zone
);

-- 3. Unique index on slug
CREATE UNIQUE INDEX IF NOT EXISTS "news_slug_idx" ON "news"("slug");

-- 4. Index on status + published_at (used in frontend queries)
CREATE INDEX IF NOT EXISTS "news_status_published_at_idx" ON "news"("status", "published_at" DESC);

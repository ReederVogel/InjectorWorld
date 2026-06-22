-- Pre-push migrations: add schema changes BEFORE db-push runs.
--
-- db-push hangs in CI when Drizzle detects an ambiguous new column and asks
-- "renamed or created?". Pre-creating the column here eliminates that ambiguity
-- — Drizzle sees it already exists and silently validates instead of prompting.
--
-- Rules:
--   • All statements are wrapped in DO blocks with table-existence guards so
--     this is safe to run on a fresh database (tables don't exist yet → no-ops;
--     db-push then creates everything from scratch with no drift to detect).
--   • NEVER remove or rename columns here — only ADD IF NOT EXISTS.
--   • Add a comment for each entry: collection name + what changed + phase.

-- Helper: slugToTable maps Payload collection slugs to Postgres table names.
-- Payload lowercases and replaces hyphens with underscores.
-- e.g. 'medical-reviewers' → 'medical_reviewers', 'video-testimonials' → 'video_testimonials'

-- ──────────────────────────────────────────────────────
-- VideoTestimonials.thumbnail (upload → media) → thumbnail_id
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_testimonials'
  ) THEN
    ALTER TABLE video_testimonials ADD COLUMN IF NOT EXISTS thumbnail_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'video_testimonials'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'video_testimonials' AND column_name = 'thumbnail_id'
  ) THEN
    ALTER TABLE video_testimonials
      ADD CONSTRAINT video_testimonials_thumbnail_id_media_id_fk
      FOREIGN KEY (thumbnail_id) REFERENCES media(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- SocialPosts.avatar (upload → media) → avatar_id
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'social_posts'
  ) THEN
    ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS avatar_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'social_posts'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'social_posts' AND column_name = 'avatar_id'
  ) THEN
    ALTER TABLE social_posts
      ADD CONSTRAINT social_posts_avatar_id_media_id_fk
      FOREIGN KEY (avatar_id) REFERENCES media(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Providers.profilePhoto (upload → media) → profile_photo_id
-- Covers the R2 media upload field added to Providers.
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'providers'
  ) THEN
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS profile_photo_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'providers'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'providers' AND column_name = 'profile_photo_id'
  ) THEN
    ALTER TABLE providers
      ADD CONSTRAINT providers_profile_photo_id_media_id_fk
      FOREIGN KEY (profile_photo_id) REFERENCES media(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- News.coverImage (upload → media) → cover_image_id
-- News.author (relationship → authors) → author_id
-- News.medicalReviewer (relationship → medical_reviewers) → medical_reviewer_id
-- News.relatedTreatment (relationship → treatments) → related_treatment_id
-- News.approvedBy (relationship → users) → approved_by_id
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'news'
  ) THEN
    ALTER TABLE news ADD COLUMN IF NOT EXISTS cover_image_id integer;
    ALTER TABLE news ADD COLUMN IF NOT EXISTS author_id integer;
    ALTER TABLE news ADD COLUMN IF NOT EXISTS medical_reviewer_id integer;
    ALTER TABLE news ADD COLUMN IF NOT EXISTS related_treatment_id integer;
    ALTER TABLE news ADD COLUMN IF NOT EXISTS approved_by_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='cover_image_id') THEN
    ALTER TABLE news ADD CONSTRAINT news_cover_image_id_media_id_fk FOREIGN KEY (cover_image_id) REFERENCES media(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='author_id') THEN
    ALTER TABLE news ADD CONSTRAINT news_author_id_authors_id_fk FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='medical_reviewer_id') THEN
    ALTER TABLE news ADD CONSTRAINT news_medical_reviewer_id_medical_reviewers_id_fk FOREIGN KEY (medical_reviewer_id) REFERENCES medical_reviewers(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='related_treatment_id') THEN
    ALTER TABLE news ADD CONSTRAINT news_related_treatment_id_treatments_id_fk FOREIGN KEY (related_treatment_id) REFERENCES treatments(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='approved_by_id') THEN
    ALTER TABLE news ADD CONSTRAINT news_approved_by_id_users_id_fk FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Clinics.brand (relationship → brands) → brand_id
-- Added when Brands collection was introduced.
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinics'
  ) THEN
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS brand_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinics' AND column_name='brand_id') THEN
    ALTER TABLE clinics ADD CONSTRAINT clinics_brand_id_brands_id_fk FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Subscribers.linkedUser (relationship → users) → linked_user_id
-- Added in Phase 10 newsletter.
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'subscribers'
  ) THEN
    ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS linked_user_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='subscribers' AND column_name='linked_user_id') THEN
    ALTER TABLE subscribers ADD CONSTRAINT subscribers_linked_user_id_users_id_fk FOREIGN KEY (linked_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Phase 1: Clinics type/status/services/social columns
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinics'
  ) THEN
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS clinic_type text;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS data_confidence numeric;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS needs_manual_review boolean NOT NULL DEFAULT false;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS offers_virtual_consult boolean NOT NULL DEFAULT false;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS accepts_new_patients boolean NOT NULL DEFAULT true;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS starting_price numeric;
    -- NOTE: languages is a Drizzle join table (clinics_languages), not a jsonb column here.
    ALTER TABLE clinics DROP COLUMN IF EXISTS languages;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS instagram_url text;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS tiktok_url text;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS facebook_url text;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- Phase 1: clinics_rels.treatments_id for treatmentsOffered relationship
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinics_rels'
  ) THEN
    ALTER TABLE clinics_rels ADD COLUMN IF NOT EXISTS treatments_id integer;
    CREATE INDEX IF NOT EXISTS clinics_rels_treatments_id_idx ON clinics_rels (treatments_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clinics_rels' AND column_name='treatments_id') THEN
    ALTER TABLE clinics_rels ADD CONSTRAINT clinics_rels_treatments_fk FOREIGN KEY (treatments_id) REFERENCES treatments(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Phase 1: clinics_languages enum type
-- Pre-create only the enum — Drizzle creates the table itself.
-- Pre-creating the table causes a "serial" ALTER error in db:push.
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE enum_clinics_languages AS ENUM ('en','es','fr','zh','yue','ko','pt','ar','hi','ru');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- Phase 1: Providers.status publish gate
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'providers'
  ) THEN
    ALTER TABLE providers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
  END IF;
END $$;

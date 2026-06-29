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
    -- related_treatment_id intentionally NOT re-added: the treatments collection
    -- was removed and replaced by related_service_id (added further below). Re-adding
    -- it here would let the news→treatments FK statement fire against a dropped table.
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

-- news_related_treatment_id_treatments_id_fk REMOVED: the treatments collection
-- was deleted. The related_treatment_id column is dropped further below and
-- replaced by related_service_id. This FK referenced a table that no longer exists
-- and was the cause of the deploy failure ("relation treatments does not exist").
-- Guard kept defensive for any DB where treatments somehow still exists.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='treatments')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='news' AND column_name='related_treatment_id') THEN
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
-- Clinics.brand → brand_id — REMOVED. This was the OLD practice-group "brand"
-- single relationship. The new product-brands model relates clinics to brands
-- via the hasMany brandsOffered field (clinics_rels.brands_id), not a single
-- clinics.brand_id. The column is dropped in the cleanup section below. Re-adding
-- the column + a FK to the dropped old brands table caused the deploy failure
-- ("relation brands does not exist" at this statement).
-- ──────────────────────────────────────────────────────

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
-- Phase 1: clinics_rels.treatments_id — REMOVED (treatments collection deleted).
-- treatmentsOffered now points to the services collection (clinics_rels.services_id,
-- pre-added further below). The treatments_id column is dropped in the cleanup
-- section. Re-adding the column + a FK to the dropped treatments table was dead
-- churn that also risked the same "relation treatments does not exist" failure.
-- ──────────────────────────────────────────────────────

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

-- ──────────────────────────────────────────────────────
-- Revamp Phase 1: Promotions schema overhaul
-- Old Promotions had:  active (bool), scopeType (enum_promotions_scope_type),
--   treatmentScope/locationScope/bodyAreaScope relationships, bannerImageUrl (text),
--   rank (number), organic-pin placement value.
-- New Promotions has:  status (enum), scope (enum), treatment/state/city
--   relationships, bannerImage (media relationship), featuredRank (number),
--   featured-pin placement value.
--
-- Drizzle detects enum_clinics_clinic_type as a possible rename of
-- enum_promotions_scope_type and stalls on an interactive prompt.
-- Fix: drop the stale column + enum first, then pre-create the new enums
-- so Drizzle skips the rename-detection prompt entirely.
-- ──────────────────────────────────────────────────────

-- 1. Drop all old Promotions columns that no longer exist in the new schema.
--    Drizzle detects dropped+added columns as possible renames and stalls on
--    interactive prompts. Pre-removing old and pre-adding new eliminates all
--    rename-detection ambiguity so db:push runs non-interactively.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) THEN
    ALTER TABLE promotions
      DROP COLUMN IF EXISTS scope_type,
      DROP COLUMN IF EXISTS treatment_scope_id,
      DROP COLUMN IF EXISTS location_scope_id,
      DROP COLUMN IF EXISTS body_area_scope,
      DROP COLUMN IF EXISTS zip_scope,
      DROP COLUMN IF EXISTS zip_radius_miles,
      DROP COLUMN IF EXISTS active,
      DROP COLUMN IF EXISTS advertiser_name,
      DROP COLUMN IF EXISTS banner_image_url,
      DROP COLUMN IF EXISTS rank;
  END IF;
END $$;

-- 2. Drop stale enums (columns that used them are gone)
DROP TYPE IF EXISTS enum_promotions_scope_type;

-- 3. Pre-create enum_clinics_clinic_type so Drizzle won't try to rename
--    enum_promotions_scope_type → enum_clinics_clinic_type
DO $$ BEGIN
  CREATE TYPE enum_clinics_clinic_type AS ENUM (
    'medspa', 'dermatology', 'plastic-surgery', 'dental-aesthetics', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Pre-create enum_promotions_status (new, replaces active boolean)
DO $$ BEGIN
  CREATE TYPE enum_promotions_status AS ENUM ('draft', 'active', 'paused', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Pre-create enum_promotions_scope (new, replaces scopeType)
DO $$ BEGIN
  CREATE TYPE enum_promotions_scope AS ENUM (
    'national', 'treatment', 'state', 'city', 'treatment+state', 'treatment+city'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Pre-add new Promotions columns so Drizzle validates instead of prompting.
--    Use IF NOT EXISTS guards — safe to re-run on a fresh DB.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) THEN
    ALTER TABLE promotions
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS featured_rank integer,
      ADD COLUMN IF NOT EXISTS banner_link_url text,
      ADD COLUMN IF NOT EXISTS banner_alt_text text;
  END IF;
END $$;

-- status column (enum type, add separately to avoid casting issues)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotions' AND column_name = 'status'
  ) THEN
    ALTER TABLE promotions ADD COLUMN status enum_promotions_status NOT NULL DEFAULT 'draft';
  END IF;
END $$;

-- scope column (enum type)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotions' AND column_name = 'scope'
  ) THEN
    ALTER TABLE promotions ADD COLUMN scope enum_promotions_scope NOT NULL DEFAULT 'national';
  END IF;
END $$;

-- Relationship ID columns for treatment, state, city, clinic, bannerImage
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) THEN
    ALTER TABLE promotions
      ADD COLUMN IF NOT EXISTS treatment_id integer,
      ADD COLUMN IF NOT EXISTS state_id integer,
      ADD COLUMN IF NOT EXISTS city_id integer,
      ADD COLUMN IF NOT EXISTS clinic_id integer,
      ADD COLUMN IF NOT EXISTS banner_image_id integer;
  END IF;
END $$;

-- 7. Handle promotions.placement enum value: add 'featured-pin', update old
--    'organic-pin' rows to 'featured-pin', then Drizzle can safely alter the type.
DO $$ BEGIN
  -- Add new value if not present (Postgres allows adding enum values)
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_promotions_placement' AND e.enumlabel = 'featured-pin'
  ) THEN
    ALTER TYPE enum_promotions_placement ADD VALUE 'featured-pin';
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

-- Migrate old 'organic-pin' rows to 'featured-pin'.
-- Wrapped in a DO block so it is a no-op on a fresh DB (table not yet created).
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'promotions'
  ) THEN
    UPDATE promotions SET placement = 'featured-pin' WHERE placement::text = 'organic-pin';
  END IF;
END $$;

-- Backfill NULL title values before Drizzle sets NOT NULL on the column.
-- promotions.title is required in Payload and existing rows may be NULL.
-- Must run BEFORE db-push.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'promotions' AND column_name = 'title'
  ) THEN
    UPDATE promotions SET title = 'Promotion' WHERE title IS NULL;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────
-- Users.linkedBrand (relationship → brands) → linked_brand_id
-- Phase 3 revamp: brand dashboard role requires this field.
-- ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_brand_id integer;
  END IF;
END $$;

-- FK guarded with brands-table existence: the brands table is dropped+recreated
-- in the services/brands migration below (db-push rebuilds it). During pre-push
-- the brands table is absent, so this FK is skipped and db-push adds it when it
-- creates the new brands table. Without the brands-existence guard this fails
-- with "relation brands does not exist".
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brands'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'linked_brand_id'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_linked_brand_id_brands_id_fk
      FOREIGN KEY (linked_brand_id) REFERENCES brands(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────────────
-- services + brands collections (replace treatments)
--
-- Drizzle hangs interactively when it sees new enum names
-- that look like renames of dropped ones, or new integer
-- columns alongside dropped integer columns.  Pre-drop the
-- stale artifacts and pre-create/pre-add the new ones so
-- Drizzle sees everything as already-existing and skips its
-- interactive rename prompts entirely.
-- ──────────────────────────────────────────────────────

-- 0. Pre-drop the old treatments tables.
--    Drizzle's rename-detection fires when it sees dropped tables alongside
--    new tables of similar structure.  With treatments + treatments_body_areas
--    still present, Drizzle asks "Is services_body_areas a rename of treatments?"
--    and hangs waiting for interactive input.  Drop these first so Drizzle only
--    sees CREATE (no dropped candidates to match against) and skips the prompt.

DROP TABLE IF EXISTS treatments_body_areas;   -- join table: must go before treatments (FK)
DROP TABLE IF EXISTS treatments CASCADE;       -- main table: CASCADE cleans residual FK refs

-- 0b. Pre-drop old brands table (only if it has the OLD schema).
--     The old practice-group brands schema had instagram_url, tiktok_url, linkedin_url,
--     claimed, brand_id, etc. The new product-brands schema has manufacturer, category,
--     guide_id, avg_price_from_usd, etc. These share no columns, so Drizzle would prompt
--     on every column. We drop only when the old column `instagram_url` is present.
--     If brands already has the new schema (seeded), we skip the drop to preserve data
--     and allow db-push to add the FK constraint without a violation.
--     CASCADE drops FK constraints in other tables that point to brands.id
--     (users.linked_brand_id FK is dropped but the column itself stays).

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='brands' AND column_name='instagram_url') THEN
    DROP TABLE brands CASCADE;
  END IF;
END $$;

-- 0c. Prune orphaned clinics_rels.brands_id rows before FK is added.
--     If brands was just dropped (old schema) OR is empty (fresh install),
--     any clinics_rels rows with a non-null brands_id would violate the FK
--     that db-push is about to add. Safe to delete: they'll be re-populated
--     by the seed + import after deploy.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinics_rels' AND column_name='brands_id') THEN
    -- Delete orphaned clinics_rels.brands_id rows if brands table doesn't exist OR is empty.
    -- Checked in two steps to avoid "relation brands does not exist" when table was just dropped.
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables
        WHERE table_schema='public' AND table_name='brands') THEN
      DELETE FROM clinics_rels WHERE brands_id IS NOT NULL;
    ELSIF NOT EXISTS (SELECT 1 FROM brands LIMIT 1) THEN
      DELETE FROM clinics_rels WHERE brands_id IS NOT NULL;
    END IF;
  END IF;
END $$;

-- 1. Drop stale columns that reference the deleted treatments collection.
--    PostgreSQL auto-drops FK constraints when the column is dropped.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinics_rels' AND column_name='treatments_id') THEN
    ALTER TABLE clinics_rels DROP COLUMN treatments_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='clinics' AND column_name='brand_id') THEN
    ALTER TABLE clinics DROP COLUMN brand_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='providers_rels' AND column_name='treatments_id') THEN
    ALTER TABLE providers_rels DROP COLUMN treatments_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='news' AND column_name='related_treatment_id') THEN
    ALTER TABLE news DROP COLUMN related_treatment_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='guides' AND column_name='related_treatment_id') THEN
    ALTER TABLE guides DROP COLUMN related_treatment_id;
  END IF;
END $$;

-- 2. Drop old brands subscription columns (removed in new product-brands schema).

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='brands') THEN
    ALTER TABLE brands
      DROP COLUMN IF EXISTS subscription_status,
      DROP COLUMN IF EXISTS subscription_tier,
      DROP COLUMN IF EXISTS subscription_started_at,
      DROP COLUMN IF EXISTS subscription_expires_at;
  END IF;
END $$;

-- 3. Drop stale enums from deleted treatments collection and old brands fields.
--    CASCADE handles any residual column references (e.g. treatments table itself).

DROP TYPE IF EXISTS enum_treatments_body_areas CASCADE;
DROP TYPE IF EXISTS enum_treatments_category CASCADE;
DROP TYPE IF EXISTS enum_treatments_price_unit CASCADE;
DROP TYPE IF EXISTS enum_brands_subscription_status CASCADE;
DROP TYPE IF EXISTS enum_brands_subscription_tier CASCADE;

-- 4. Pre-create new enums for the services collection.

DO $$ BEGIN
  CREATE TYPE enum_services_category AS ENUM ('body-area', 'skin', 'thread', 'body', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_services_body_areas AS ENUM (
    'forehead', 'brow', 'under-eye', 'crows-feet', 'cheeks',
    'lips', 'chin', 'jawline', 'neck', 'decolletage'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_services_price_unit AS ENUM ('per_unit', 'per_session', 'per_syringe');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Pre-create new enums for the brands (product-brands) collection.

DO $$ BEGIN
  CREATE TYPE enum_brands_category AS ENUM ('neurotoxin', 'filler', 'biostimulator', 'skin', 'body', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enum_brands_price_unit AS ENUM ('per_unit', 'per_session', 'per_syringe');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Pre-add new relationship columns to _rels tables so Drizzle sees them as
--    existing rather than treating them as renames of the dropped columns above.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='clinics_rels') THEN
    ALTER TABLE clinics_rels ADD COLUMN IF NOT EXISTS services_id integer;
    ALTER TABLE clinics_rels ADD COLUMN IF NOT EXISTS brands_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='providers_rels') THEN
    ALTER TABLE providers_rels ADD COLUMN IF NOT EXISTS services_id integer;
  END IF;
END $$;

-- 7. Pre-add related_service_id to news and guides.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='news') THEN
    ALTER TABLE news ADD COLUMN IF NOT EXISTS related_service_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='guides') THEN
    ALTER TABLE guides ADD COLUMN IF NOT EXISTS related_service_id integer;
  END IF;
END $$;

-- 8. Payload-internal + global relationship tables.
--    These ALSO get a <collection>_id column per related collection, so the
--    treatments→services swap creates the exact same "drop treatments_id +
--    add services_id" ambiguity that makes db-push prompt interactively.
--    Two tables are affected and MUST be pre-handled (this was the final
--    db-push hang: "Is services_id in payload_locked_documents_rels created
--    or renamed?"):
--
--    a) payload_locked_documents_rels — Payload's internal lock table, holds one
--       <collection>_id per collection. treatments removed → drop treatments_id;
--       services added → add services_id. brands_id already present (brands slug
--       unchanged), added defensively.
--    b) header_config_rels — HeaderConfig global. featuredTreatments (→ treatments)
--       became featuredServices (→ services) and featuredBrands (→ brands) was added.
--       Drop the dead treatments_id, pre-add services_id + brands_id.
--
--    bookings.treatment_id and promotions.treatment_id are intentionally LEFT
--    ALONE: their field is still named `treatment` (relationTo flipped to services),
--    so the column name is unchanged — no rename ambiguity, db-push just re-points
--    the FK once services exists.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='payload_locked_documents_rels') THEN
    ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS treatments_id;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS services_id integer;
    ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS brands_id integer;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='header_config_rels') THEN
    ALTER TABLE header_config_rels DROP COLUMN IF EXISTS treatments_id;
    ALTER TABLE header_config_rels ADD COLUMN IF NOT EXISTS services_id integer;
    ALTER TABLE header_config_rels ADD COLUMN IF NOT EXISTS brands_id integer;
  END IF;
END $$;

-- Reviews collection removed from payload.config.ts (2026-06-29).
-- Drizzle db-push tries to DROP this FK but fails when the constraint never
-- existed in prod. Dropping it here (IF EXISTS) first means db-push pulls a
-- schema that already matches and generates no DROP statement.
-- NOTE: Reviews collection re-added in Phase 4. The guard below is a no-op on
-- any DB where the constraint was already cleaned up. db-push re-creates the
-- FK when it creates the reviews table on the fresh schema.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'payload_locked_documents_rels_reviews_fk'
      AND table_name = 'payload_locked_documents_rels'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  END IF;
END $$;

-- Phase 5: Clinics bulk-upload + moderation columns.
-- Pre-add IF NOT EXISTS so db-push sees them already present and does not
-- generate an interactive "add or rename?" prompt.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinics'
  ) THEN
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS noindex boolean NOT NULL DEFAULT true;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS published_at timestamptz;
    ALTER TABLE clinics ADD COLUMN IF NOT EXISTS import_batch text;
  END IF;
END $$;

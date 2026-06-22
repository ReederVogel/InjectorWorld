-- Fix: Phase 1 schema additions for clinics collection.
-- 1. Replace incorrect languages jsonb column with proper Drizzle join table.
-- 2. Add treatments_id column to clinics_rels for treatmentsOffered relationship.
-- The Clinics.languages field (select hasMany:true) needs a join table, not a jsonb column.

ALTER TABLE clinics DROP COLUMN IF EXISTS languages;

DO $$ BEGIN
  CREATE TYPE enum_clinics_languages AS ENUM ('en','es','fr','zh','yue','ko','pt','ar','hi','ru');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SEQUENCE IF NOT EXISTS clinics_languages_id_seq;

CREATE TABLE IF NOT EXISTS clinics_languages (
  "order"    integer                  NOT NULL,
  parent_id  integer                  NOT NULL,
  value      enum_clinics_languages,
  id         integer                  NOT NULL DEFAULT nextval('clinics_languages_id_seq'::regclass),
  CONSTRAINT clinics_languages_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS clinics_languages_order_idx  ON clinics_languages ("order");
CREATE INDEX IF NOT EXISTS clinics_languages_parent_idx ON clinics_languages (parent_id);

DO $$ BEGIN
  ALTER TABLE clinics_languages
    ADD CONSTRAINT clinics_languages_parent_fk
    FOREIGN KEY (parent_id) REFERENCES clinics(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- clinics_rels: add treatments_id for treatmentsOffered relationship
ALTER TABLE clinics_rels ADD COLUMN IF NOT EXISTS treatments_id integer;
CREATE INDEX IF NOT EXISTS clinics_rels_treatments_id_idx ON clinics_rels (treatments_id);
DO $$ BEGIN
  ALTER TABLE clinics_rels
    ADD CONSTRAINT clinics_rels_treatments_fk
    FOREIGN KEY (treatments_id) REFERENCES treatments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

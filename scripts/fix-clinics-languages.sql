-- DISABLED 2026-08-24. Kept as a tombstone so the MIGRATIONS[] list in
-- run-migrations.ts stays a complete historical record.
--
-- What this used to do: replace an incorrect clinics.languages jsonb column
-- with the proper Drizzle join table (clinics_languages + enum_clinics_languages
-- + FK + indexes).
--
-- Why it is disabled: the Clinics.languages field was removed entirely on
-- 2026-08-23 (it held zero rows across every clinic). This file runs from
-- run-migrations.ts, which executes AFTER db-push, so it re-created the
-- clinics_languages table on every single build and silently undid that
-- cleanup. The table, its enum and its FK are dropped in migrate-pre-push.sql.
--
-- Do not re-enable. If clinic languages ever come back, add the field to
-- collections/Clinics.ts and let db-push create the join table itself.

SELECT 1;

# DigitalOcean Deployment Notes

Status as of 2026-06-17. This doc is the single source of truth for how injector.world
is deployed on DigitalOcean, what was changed to make it work, and what is temporary
and must be cleaned up later. Read this before touching deploy, database, or env config.

---

## 1. Infrastructure (what is running)

| Piece | Value |
|---|---|
| Host | DigitalOcean App Platform. App name shows as `starfish-app`, web service component `injectorworld`. App id `954e58f6-462c-491a-8391-132c461e0f98`. |
| Database | DigitalOcean Managed PostgreSQL 18, region NYC1, Basic 1GB / 1 vCPU / 10GB. Cluster host `app-4630986a-8a8a-450b-aa00-96850dc69c6a-do-user-35689547-0.f.db.ondigitalocean.com:25060`, db `defaultdb`, user `doadmin`. |
| Media | DigitalOcean Spaces bucket `iw-media`, region SFO3. S3-compatible, reached through the existing `R2_*` env vars (no code rename needed). |
| Build | DO Node buildpack auto-runs `npm run build`. Run command `npm start`. Build Command in DO is "None" (correct, buildpack default). |

Important: this Managed Postgres does NOT have PostGIS available (`extension "postgis"
is not available`). The app is built to tolerate this: the PostGIS geography index and
`CREATE EXTENSION postgis` are `fatal: false` in `scripts/setup-search-indexes.ts`, so
the build passes. Effect: radius / map distance search degrades (sequential scan, or no
geo results), everything else works.

---

## 2. Environment variables set on the DO app

All of these are set in the DO App > Settings > Environment Variables. Secrets are NOT
copied here on purpose.

| Key | Value | Scope | Notes |
|---|---|---|---|
| `DATABASE_URI` | full `postgresql://doadmin:...@...:25060/defaultdb?sslmode=...` | Run and build time | Must be the URI (not URL). Public connection string. |
| `PAYLOAD_SECRET` | (secret) | Run and build time | >= 32 chars. Required at build time or build throws. |
| `DB_SSL_CA` | (the DO CA certificate PEM) | Run and build time | Downloaded from DB > Connection Details > "Download CA certificate". |
| `NEXT_PUBLIC_SITE_URL` | live app URL, no trailing slash | Run and build time | Needed for CORS/CSRF/cookies, e.g. logout. Without it Payload defaults to localhost and logout silently fails. |
| `R2_BUCKET` | `iw-media` | Run | |
| `R2_ENDPOINT` | `https://sfo3.digitaloceanspaces.com` | Run | DO Spaces region endpoint. |
| `R2_REGION` | `sfo3` | Run | NEW var. DO Spaces validates region; `auto` (R2 default) does not work for Spaces. |
| `R2_PUBLIC_URL` | `https://iw-media.sfo3.digitaloceanspaces.com` | Run | |
| `R2_ACCESS_KEY_ID` | (secret) | Run | Spaces access key. |
| `R2_SECRET_ACCESS_KEY` | (secret) | Run | Spaces secret. |

The two scope rule that bit us: `DATABASE_URI` and `PAYLOAD_SECRET` MUST be scoped
"Run and build time", not just "Run time". `next build` runs in production mode and needs
them, otherwise the build fails before it starts.

---

## 3. Code changes made to make the deploy work

All committed to `main`. Files:

1. `lib/db-ssl.ts` (NEW) - two helpers used by both the app pool and the migration script:
   - `getDbSsl()`: returns SSL config. Localhost = no SSL. Remote = full TLS verification
     using `DB_SSL_CA`. Includes `normalizePem()` which rebuilds the PEM from its base64
     body, so a CA value mangled on paste (newlines collapsed, wrapped in quotes) still works.
   - `getDbConnectionString()`: strips any `ssl*` query params (e.g. `sslmode=verify-full`,
     `sslrootcert=...`) from `DATABASE_URI`. Reason: node-postgres parses `sslmode` from the
     connection string and that OVERRIDES the explicit `ssl` object, throwing away our CA.
     The two functions MUST be used together.

2. `payload.config.ts` - pool now uses `getDbConnectionString()` + `getDbSsl()`. Pool `max`
   is `DB_POOL_MAX || 4`.

3. `scripts/run-migrations.ts` - uses the same two helpers for its raw `pg.Pool`.

4. `package.json` - build order changed. Now:
   `db-push -> run-migrations -> setup-search-indexes -> next build`.
   Previously run-migrations ran first; on a fresh database that failed with
   "relation subscribers does not exist" because the tables had not been created yet.
   db-push creates all tables first, then the idempotent raw migrations no-op.

5. `next.config.mjs` - added `experimental.cpus: 1`. Forces `next build` to use a single
   static-generation worker. Multiple workers each open their own DB pool and together blew
   past the small DB connection limit (Postgres error 53300, "remaining connection slots are
   reserved..."). One worker keeps total connections low. Do NOT shrink the pool to 1 to fix
   this; pool size 1 deadlocks Payload (it needs more than one connection per page).

6. `lib/storage.ts` - region is now `R2_REGION || 'auto'` instead of hardcoded `auto`, so DO
   Spaces (which requires a real region) works.

---

## 4. Data migration (done once, manually)

Local dev DB -> DO DB, via pg_dump / pg_restore (PostgreSQL 18 client tools).

- Dumped `public` schema of local `injectors_world_dev` to a custom-format file.
- Restored into DO `defaultdb` with `--clean --if-exists --no-owner --no-acl`.
- Migrated content: 218 providers, 99 clinics, 90 locations, 2800 reviews, 15 treatments,
  13 guides, 3 news, 2 brands, 3 authors, 2 media.
- One harmless error during restore: the PostGIS geography index could not be recreated on
  DO (no PostGIS). Ignored, as designed.

Manual schema correction after restore: the local DB had a STALE `subscribers` table
(Phase 10 newsletter schema was never re-pushed locally). It had an old `confirmed` column
and was missing `opt_in_at`. This made `db-push` stop on an interactive drizzle prompt
("Is opt_in_at created or renamed...") which hangs a non-interactive build. Fixed directly
on DO (subscribers had 0 rows):
```
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS opt_in_at timestamp(3) with time zone;
ALTER TABLE subscribers DROP COLUMN IF EXISTS confirmed;
```
After this, db-push sees no ambiguous add/drop and runs clean. `news` was checked and
matches the code (no drift).

---

## 5. TEMPORARY / MUST FIX LATER (the important part)

These are pragmatic shortcuts taken to get deployed. They are not safe long-term.

### 5.1 Database firewall is wide open (security)
Trusted Sources on the DB currently contains `0.0.0.0/1` and `128.0.0.0/1`, which together
allow EVERY IP. This was needed because the App Platform BUILD container has an
unpredictable egress IP and "app as trusted source" only reliably covers the running app,
not the build. DO rejects the literal `0.0.0.0/0`, hence the two halves.

The DB is still password + SSL protected, but it is reachable from the whole internet.

Fix later (pick one):
- Move to private VPC networking: attach the DB to the app / use the VPC (private) connection
  string so build and run connect over DO's internal network, then remove the open rules.
- Or at minimum, rotate the `doadmin` password (DB > Settings > Reset Password, then update
  `DATABASE_URI`). The current password was pasted into a chat AND the DB is internet-facing.

### 5.2 db-push runs on every deploy (fragility + data-loss risk)
The build runs `tsx scripts/db-push.ts` (drizzle force push) against the production DB every
deploy. If the code schema ever diverges from the live DB in an ambiguous way (a column
rename, an add+drop pair), drizzle prints an interactive prompt that a CI build cannot answer,
and the build hangs until timeout. Worse, push can drop columns and lose data on a wrong guess.

Fix later: switch to generated, reviewed migrations (drizzle-kit generate + a migrate step)
and remove `db-push` from the production build. Until then, before any schema change, make
the live DB match first (or expect to hand-align it like we did with subscribers).

### 5.3 PostGIS missing
Radius / map distance search is degraded because this Managed DB has no PostGIS. If geo search
matters, enable PostGIS (may require a different DB plan/config) and re-run
`npm run setup:search` against DO to build the geography GIST index.

### 5.4 Local dev DB schema is stale
The local `injectors_world_dev` was behind the code (the subscribers drift came from there).
Re-run `npm run db:push` locally so the local schema matches the code, otherwise the next
local dump will carry stale schema again.

### 5.5 cpus: 1 slows the build
`experimental.cpus: 1` makes static generation single-threaded. Fine for ~61 pages, but if the
page count grows a lot, builds get slow. Safe to raise only if the DB connection limit is also
raised (bigger DB plan). It is the connection ceiling, not CPU, that forced this.

---

## 6. Harmless build log noise (ignore)
- `engines.node >=20` wide range warning.
- npm audit vulnerabilities count.
- "No build cache found".
- PostGIS extension / geography index "skipped (non-fatal)".

---

## 7. How a normal deploy works now
1. Push to `main`. DO auto-builds, or use App > Actions > Force rebuild and deploy.
2. Build: db-push (clean, no prompt as long as schema matches) -> run-migrations (no-op) ->
   setup-search (GIN indexes + geocode cache; PostGIS parts skipped) -> next build (cpus:1,
   prerenders with data).
3. Deploy is zero-downtime. Live URL is in App > Overview.

If a deploy fails, check in this order: env var scope (build vs run), DB trusted sources
(can the build reach the DB), then db-push schema drift (interactive prompt in the log).

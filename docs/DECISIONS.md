# injector.world — Decision Log (append-only)

Every locked decision lives here with a date and a reason. Read this before building
anything. Never silently contradict an entry. To change a decision, add a NEW dated entry
that supersedes the old one (do not delete history).

---

## 2026-06-10 — Build fix: PostGIS index made non-fatal (surfaced during Railway deploy)

Surfaced while deploying the Phase 7 R2 work to Railway. The Railway build failed at
`scripts/setup-search-indexes.ts` (Phase 5) with `function st_makepoint(...) does not exist` (code
42883) — Railway's default Postgres image ships WITHOUT PostGIS, so the clinic geography GIST index
could not be built and the whole `npm run build` exited 1 before `next build` ran. This is unrelated
to R2; it just had never been deployed to a PostGIS-less DB before.

- **Fix: PostGIS steps are now best-effort, not fatal.** `setup-search-indexes.ts` gained a per-statement
  `fatal?: boolean`. The loop try/catches each statement: `fatal: false` ones log `skipped` + a warning
  and continue; the rest still throw. Marked non-fatal: a new best-effort `CREATE EXTENSION IF NOT EXISTS
  postgis;` (so a PostGIS-capable DB like DO Managed Postgres self-enables and gets the real index) and
  the `clinics_geog_idx` geography index. The full-text GIN indexes, `search` schema, and geocode cache
  stay fatal (they need no PostGIS). Verified locally (PostGIS present) all six steps still print `ok`.
- **Consequence / known degradation on Railway:** with no PostGIS, radius/`ST_DWithin` geo search will
  not work on Railway (the index is skipped; a geo query would seq-scan or error at runtime). Full-text
  search and everything non-geo are unaffected. This is acceptable for the temporary Railway host; moving
  to DO Managed Postgres (PostGIS-enabled) makes the extension step succeed and geo search work with NO
  code change. A belt-and-suspenders runtime guard so geo queries degrade gracefully instead of 500ing
  on a PostGIS-less DB is a separate Phase 5/12 hardening item (not done here to keep blast radius small).


## 2026-06-10 — Phase 7: media on object storage (Cloudflare R2, S3-compatible)

ROADMAP Phase 7 executed. Fixes the 🔴 "Media uploads are ephemeral" audit finding: the `Media`
collection stored to local disk (`../media`, gitignored), which on Railway/DO is wiped on every
deploy/restart, so any admin-uploaded image vanished. Now admin uploads go to S3-compatible object
storage and persist. Founder decisions taken up front (AskUserQuestion): R2 keys NOT ready yet (wire
code + docs now, founder does the live upload+restart persist test once Cloudflare is set up — dev runs
on local-disk fallback meanwhile); public serving via the managed `r2.dev` URL (custom domain later =
env-only); scope = Media collection only (scraped `profilePhotoUrl`/`clinicPhotoUrls` strings stay
as-is, handled on real-data day; owner-dashboard photo upload deferred); keep a dev local-disk fallback.
NO schema/DB change (Media field shape + imageSizes unchanged), so no `db:push`/`generate:types`. tsc
clean, production build green, dev boots clean, `/`, `/admin`, `/guides` all 200.

- **Cloudflare R2 now, DigitalOcean Spaces later = ENV-ONLY swap (founder call).** R2 is the temporary
  host (Railway deploy; free tier ~10 GB + zero egress). Because both R2 and DO Spaces speak the S3 API,
  the SAME adapter (`@payloadcms/storage-s3`) serves both: moving to DO Spaces means replacing the six
  `R2_*` env values with the DO Spaces ones (endpoint `https://nyc3.digitaloceanspaces.com`, region
  `nyc3`, etc.) and changing NO code. This is the whole reason R2 was chosen over a proprietary store.
  Vercel Blob stays permanently banned (CLAUDE.md lock).
- **All storage config in one file: `lib/storage.ts`.** Exports `isRemoteStorageEnabled` (true only when
  all of `R2_BUCKET`/`R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_PUBLIC_URL` are set) and
  `mediaStoragePlugins()` (the `s3Storage` plugin pointed at Media, or `[]`). Spread into the Payload
  `plugins` array after `seoPlugin`. R2 specifics: `region: 'auto'`, `forcePathStyle: true`, and NO ACL
  (R2 ignores S3 ACLs; public access is granted on the bucket via r2.dev / custom domain, so we never
  send `acl: 'public-read'`).
- **Public URL override is mandatory for R2 (the S3 endpoint is private).** R2's
  `<account>.r2.cloudflarestorage.com` endpoint is the private S3 API; files are served from a SEPARATE
  public domain. The plugin's `generateFileURL` builds every file's public URL from `R2_PUBLIC_URL`
  (`${base}/${prefix?}/${filename}`), and `disablePayloadAccessControl: true` serves directly from R2
  instead of proxying through the Payload static route. Without this the `doc.url` would point at the
  private endpoint and images would not load.
- **Dev local-disk fallback (founder call).** When the R2 env vars are absent, `mediaStoragePlugins()`
  returns `[]` and Media keeps its `staticDir` local-disk storage, so a fresh clone runs `npm run dev`
  with zero keys. Verified both ways: no env -> `isRemoteStorageEnabled=false`, 0 plugins; fake env ->
  `true`, 1 plugin (the `s3Storage` plugin constructs without error).
- **imageSizes unchanged, all variants persist.** The existing `thumbnail`/`card`/`hero`/`og` sizes are
  generated by sharp on upload and the plugin uploads the original + every variant to R2 (each is its own
  object), all public. No imageSizes change was needed.
- **`next.config.mjs` allows the R2 public host.** Added `**.r2.dev` to `images.remotePatterns` plus the
  CSP `img-src` and `connect-src` (so `next/image` and the browser don't block R2 images). A custom domain
  is auto-derived from `R2_PUBLIC_URL` (origin + hostname) so switching to one needs no code change. The
  old placeholder hosts (pravatar/picsum/unsplash) stay while the data is fake; DO Spaces
  (`*.digitaloceanspaces.com`) stays allowed for the future swap.
- **`.env.example` updated.** Replaced the stale commented `DO_SPACES_*` block with the six blank `R2_*`
  placeholders + setup notes (create bucket, bucket-scoped S3 token, enable public access). Real keys live
  only in `.env.local` (gitignored, never committed); `.env.example` keeps placeholders only.
- **Verified LIVE end-to-end (2026-06-10, same day).** Founder created the R2 bucket
  (`injectors-world-media`, APAC), enabled the **Public Development URL** (Cloudflare's current name for
  the managed r2.dev public access), and made a bucket-scoped **Object Read & Write** S3 API token. With
  the six `R2_*` in `.env.local`, a throwaway script uploaded a real PNG via the Payload local API: the
  returned `doc.url` was `https://pub-...r2.dev/<file>` (on R2, not local), and an HTTP GET of that URL
  returned `200 image/png` from the public internet -> upload persisted AND is publicly served. Test
  image + doc then deleted (the Payload delete also removed the R2 object), confirming delete also
  reaches R2. (imageSizes `og`/`card` came back null only because the 600x400 test image is smaller than
  those targets and Payload does not upscale; real large photos generate every variant to R2.) Also
  verified earlier: local-disk fallback still serves with no keys, tsc + production build green.


## 2026-06-10 — Phase 6: branches / brand experience (multi-location layer)

ROADMAP Phase 6 executed. Turns the dead Brands collection + unrendered `additionalClinics` into a
live multi-location layer: brand hub pages, clinic↔brand links, provider multi-clinic rendering, an
admin branch-confirm tool, and claimed-owner location self-management. Founder decisions taken up
front (AskUserQuestion): brand URL = `/brands/[slug]` + `/brands` index; brands populated via
auto-suggest+confirm AND admin-manual (NOT a CSV `brand` column — explicitly out of scope); brand hub
indexable only when ≥1 branch is in a live market, else `noindex,follow`; branch linking = BOTH admin
confirm AND claimed-owner self-link. `db:backup` taken first. NO schema/DB change was needed — every
field already existed from Phase 1 (Brands collection, Clinics.brand, Providers.additionalClinics), so
no `db:push`/`generate:types`. tsc clean, production build green (both brand hubs prerendered), all
changed pages 200, `scan:alerts` added zero new alert types (and resolved the 4 `possible_branch`).

- **Brands populated by confirming the detector's suggestions, not a CSV column (founder call: option
  2+3).** The Phase 4 `possible_branch` detector already found the two genuine multi-location groups
  in the fake data (Radiance Aesthetics: LA/SD/SF; Lone Star Med Spa: Austin/Dallas/Houston — each
  shares a phone AND website across distinct google_place_ids). `scripts/seed-brands.ts`
  (`npm run seed:brands`) runs the SAME code path as the admin "Link as brand" button
  (`getBranchSuggestions` → `linkClinicsToBrand`), so seeding doubles as an end-to-end test of the
  confirm flow. Idempotent: linked groups are excluded from future suggestions. Other same-prefix fake
  clinics (Bayou/Coastal/Solace/etc.) have distinct phones+sites and were correctly NOT grouped.
- **`/brands/[slug]` hub + `/brands` index = dedicated routes, NOT the catch-all.** `lib/brand-queries.ts`
  aggregates every branch (clinics) + every provider under a brand in two queries (one clinics, one
  providers `clinic: { in: [...] }`), with per-branch provider counts computed in memory. Hub shows an
  always-dark navy hero (logo/monogram + stats), a branch map (`BrandBranchMap` reusing
  `ListingMapInner`), branch cards (each → `/clinics/[slug]`, "coming soon" chip for non-live markets),
  and a provider grid. JSON-LD: `Organization` (with `subOrganization` MedicalBusiness branches +
  AggregateRating) + branch `ItemList` + `BreadcrumbList`. Index lists brands that have ≥1 linked
  clinic. The brand hero band uses the locked `bg-[#0B1B34] text-white` always-dark pattern (no
  `text-white` on `bg-brand-primary`).
- **Indexability is market-aware (founder call).** `getBrandBySlug` flags `hasLiveLocation` by checking
  each branch's state against the live state Locations (`kind=state`, `isLive=true`). The hub's
  `generateMetadata` sets `robots: NOINDEX_ROBOTS` (noindex,follow) UNLESS a branch is in a live market.
  Both seeded brands are CA/TX (live) → indexable, verified (no robots meta emitted).
- **Clinic → brand links.** `/clinics/[slug]` shows a "Part of [Brand]" link under the name and an
  "Other [Brand] locations" sidebar card listing sibling branches + a "View all locations" link to the
  hub. `clinic-queries` exposes the raw `brandRef`; the page resolves it via `getBrandForClinic`
  (returns the brand summary + sibling clinics, excluding the current one).
- **Provider multi-clinic render (`additionalClinics`).** `provider-queries` maps `additionalClinics`
  onto the provider; the profile shows "Also practices at" (branches with links) inside the Practice
  location block and "+N locations" on the hero location line. Directory/search/promotion provider
  mappers got an `additionalLocationCount` (array length, no depth cost) so cards show "+N" next to the
  location pin (bucket-B location prominence preserved). Demo: Yara Pearce (Houston) also practices at
  the Dallas + Austin Lone Star branches.
- **Branch auto-suggest + admin confirm (`lib/branches.ts`, never silent merge).** Shared, pure
  `detectBranchGroups` (mirrors the scan's brand-prefix+phone / website keys, ≥2 distinct place ids,
  excludes already-linked groups) + payload-backed `getBranchSuggestions` (skips groups whose alert was
  dismissed), `linkClinicsToBrand` (creates/uses a brand, sets each clinic's `brand` to a RAW number id,
  resolves the group's `possible_branch` alerts), and `dismissBranchSuggestion`. New admin API
  `/api/admin/branches` (GET suggestions + existing brands, POST link/dismiss; admin/editor only) and a
  `BranchSuggestions` panel in the dashboard cockpit (`DashboardWidget`). `scan.ts`'s `raiseBranchAlerts`
  now self-heals: a group where every member already shares one brand is no longer flagged (the 4 demo
  alerts are now `resolved`).
- **Claim-based branch linking + brand-owner locations dashboard.** New `/api/dashboard/locations` (GET
  typeahead clinic search, POST replace `additionalClinics`; provider-role only, allowlisted to that ONE
  field, never the primary `clinic`/license). `DashboardLocations` panel in `/dashboard`: shows the
  primary location (read-only) + brand link, current additional locations (add/remove), one-click
  "suggested from your brand" sibling chips, and a clinic search to add any existing location. A location
  we do not list yet routes to support email (verified before publishing) rather than a fake pending-add
  form — honest, no schema churn.
- **Verification honesty.** Brand hubs, clinic links, and provider "Also practices at" verified in SSR
  HTML via dev-server curl (all 200; content present). The admin `BranchSuggestions` panel + the two
  dashboard APIs were verified via the shared `lib/branches.ts` code path (the seed ran link end-to-end:
  2 brands, 6 clinics linked, 4 alerts resolved) and tsc + production build; the Payload admin SPA and
  the authed provider dashboard were not click-tested in a browser here (documented heaviness of the
  admin SPA in the preview harness, and the seed password is stale), consistent with prior phases.


## 2026-06-10 — Phase 5: production-grade search & maps

ROADMAP Phase 5 executed. Turns the demo-grade "load the whole directory and filter in memory"
into real server-side search across providers AND clinics, with Postgres full-text, PostGIS radius,
geocoding, a unified merit+distance ranking, Hero clinics, and map marker clustering. Founder
decisions taken up front (all "recommended"): Nominatim geocoding; Postgres tsvector + GIN full-text
(first raw-SQL migration); 25-mile default radius (miles); ranking = sponsored top then merit+distance
blend; `/search` stays noindex,follow. `db:backup` taken before any work. tsc clean, production build
green, scan:alerts unchanged (Phase 5 added zero data). Verified end-to-end (SQL + HTTP API + browser).

- **First raw-SQL migration in the project (`scripts/setup-search-indexes.ts`, `npm run setup:search`).**
  Payload/Drizzle does not manage full-text or PostGIS indexes and `db:push` will not build them.
  Creates: provider + clinic full-text GIN indexes (expression-based), a PostGIS GIST geography index
  on clinic lat/lng, and an isolated `search` schema with a `geocode_cache` table. Idempotent
  (CREATE ... IF NOT EXISTS). The full-text/geography expressions live once in `lib/search-sql.ts`
  (imported by both the index script and the query layer) so the planner can actually use the indexes.
- **CRITICAL: `db:push` DROPS public-table expression indexes (verified empirically).** Drizzle
  force-push reconciles `public` to the Payload schema and removes indexes it does not know about (same
  reason PostGIS lives in its own schema). The `search` schema survives. Fix: `npm run build` now runs
  `setup:search` right after `db:push` so deploys rebuild the indexes; after any manual local `db:push`,
  re-run `npm run setup:search`. SEARCH STAYS CORRECT WITHOUT THE INDEXES (queries seq-scan); only speed
  depends on them, so a missed re-run degrades performance, never correctness. Both `db-push` and
  `setup:search` skip cleanly when `DATABASE_URI` is absent (local `npm run build` has no env file, so
  they no-op and do not touch local indexes; on Railway/DO the process env has DATABASE_URI so both run).
- **Server search (`lib/search-queries.ts` rewritten; same `searchDirectory` export, expanded params).**
  SQL now does the filtering and returns only matching IDs (+ distance); we hydrate those rows via
  Payload (to reuse field mapping + merit) then rank + paginate. This keeps the in-memory set to the
  FILTERED subset, not the whole directory (the old approach). Filters: free-text `q` -> prefix tsquery
  GIN full-text on names; `treatment` -> relational EXISTS on `providers_rels`; `location` -> state /
  city / neighborhood text; `lat/lng` -> PostGIS `ST_DWithin` radius. All user text is parameterized
  ($1,$2,...) via a small Where builder; lat/lng/radius are validated finite numbers interpolated as
  literals. Candidate cap of 3000 rows before ranking. Real `page`/`limit` pagination (cap 100).
- **`/api/search` route (GET, public, force-dynamic, 60 req/min/IP in-memory rate limit).** Params:
  `q, treatment, location, lat, lng, radius, type (all|providers|clinics), page, limit, geo=1`. When
  `geo=1` and no lat/lng, it geocodes the typed location. `/search` page now requests a generous page-1
  window (limit 100) so the existing client "Load more" UX is unchanged while the underlying query is
  SQL-filtered, not a full scan. `/search` also accepts a `q` free-text param now.
- **PostGIS radius (`ST_DWithin` on geography).** Real "within N miles" from a clinic's coords; a
  provider's radius is its clinic's coords. Replaces the browser haversine sort. Distance is returned as
  `distanceMiles` on each result and carried into ranking. Verified: Beverly Hills geocoded ->
  nearest clinic 2.4 mi, 13 clinics / 33 providers within 25 mi.
- **Geocoding (`lib/geocode.ts`, swappable adapter, Nominatim default).** Typed location -> coords.
  Only the location string is ever sent (no PII, no names/emails). "near me" is NOT geocoded server-side
  (it needs the browser's navigator.geolocation; callers pass those coords). Two-layer cache: in-process
  Map + the isolated `search.geocode_cache` table, so we stay polite to the free endpoint (serialized,
  >= 1.1s spacing, meaningful User-Agent, US-only, 6s timeout). Cache writes are best-effort and never
  break search. Env: `GEOCODER`, `GEOCODER_USER_AGENT`, optional `NOMINATIM_BASE_URL` (added to
  `.env.example`). Future Mapbox/Google plug in behind the same contract.
- **Unified ranking (`lib/clinic-merit.ts` + `lib/ranking.ts`).** Clinics finally have a real merit
  score (rating + log review-count + completeness, photo penalty) mirroring `lib/merit.ts`, instead of
  sort-by-review-count. `ranking.ts` blends merit + distance (`distanceScore = 1/(1+miles/D)`, D=12,
  weight 2.5, only applied on geocoded searches) and floats pinned/sponsored items to the top. Weights
  are tunable constants (`RANKING_WEIGHTS`, `CLINIC_MERIT_WEIGHTS`), same pattern as `MERIT_WEIGHTS`.
- **Sponsorship in search = honored only for a resolved STATE scope (deliberate).** When a search
  resolves to a state (e.g. "botox in New York"), `searchDirectory` floats that scope's organic-pin
  providers to the top via the existing `getOrganicPins('state', ...)`, mirroring the state hub.
  Free-text-only / geo-only / city-only searches have no promotable scope, so no sponsored floating
  (avoids surfacing irrelevant paid results on a noindex page). Sponsored cards/banners still render on
  the indexable city/treatment money pages (Phase 3), which is where they are sold. The ranking API
  already accepts pinned ids, so widening sponsorship scope later is a one-liner.
- **Hero search now shows clinics + providers (`lib/hero-queries.ts` + Hero components).** The Hero
  still preloads providers and filters client-side; clinics are DERIVED from the matched providers
  (grouped by clinic), so they are always treatment-correct with NO extra query. Added a Providers |
  Clinics toggle to the live results panel (Clinics tab only when present), a compact `ClinicResultCard`
  (name, location, rating, "N injectors here", View clinic). Added clinic `slug` + rating to the hero
  provider's clinic mapping so the cards can link + show a star. Verified in browser: "Injectors 5 /
  Clinics 3", clicking Clinics renders 3 clinic cards.
- **Map marker clustering (`components/ui/ClusterLayer.tsx`).** Used the `leaflet.markercluster` plugin
  IMPERATIVELY (via `useMap()`, build markers into an `L.markerClusterGroup`) rather than a
  react-leaflet wrapper, to avoid React 19 / react-leaflet 5 version-compat risk. Brand-styled cluster
  bubbles (navy + mint ring, count) via a custom `iconCreateFunction` (so no dependency on the plugin's
  default blue/green palette). Wired into `ListingMapInner` (/clinics + city clinic view) and
  `DirectoryMap` (/injectors). Marker popups became imperative HTML strings (with HTML-escaping); they
  lose Next `<Image>` in the popup (acceptable for a tiny popup, external photo URLs). Each map keeps
  its own icons via `makeIcon`/`buildPopup`; active-icon hover-sync preserved via marker refs. Added
  `leaflet.markercluster` + `@types/leaflet.markercluster`. Verified in browser on /clinics: cluster
  bubbles 2 + 24 + 72 + 1 standalone = 99 clinics.
- **Verification honesty.** Search query layer + ranking + radius + geocoding verified via direct SQL/JS
  test scripts AND the live HTTP `/api/search` route. Hero clinics tab and map clustering verified in a
  real browser via the preview harness (DOM-confirmed: cluster element counts, clinic cards). A
  pre-existing root-level hydration warning (Next internal error boundaries at pathname "/", names none
  of the Phase 5 components, no non-deterministic render in touched files) was observed but is NOT a
  Phase 5 regression. Production build green; all changed pages (/, /search, /clinics, /injectors,
  /botox/new-york-ny) return 200.


## 2026-06-10 — Phase 4: combined CSV import + admin data-management tools

ROADMAP Phase 4 executed. Founder decisions taken up front (all "recommended"): directory-data-only
wipe (with a by-state scope); combined CSV via a `record_type` column with dry-run default ON (keep the
separate-file upload too); missing metros auto-created at import time (live for launch states, coming-soon
otherwise) AND flagged; add an `importBatch` marker field (schema change). Schema touched → `db:backup`
then `db:push` + `generate:types` were run. tsc clean, production build green. Verified end-to-end on the
dev DB (backup → import → scan → wipe → restore).

- **`importBatch` text field (indexed, admin readOnly) added to clinics/providers/reviews/photos/qa.**
  Stamped on every imported row (operator label or `import-<ISO>` default). Enables scoped re-import and
  groups a batch for the by-state wipe. Five new DataAlerts types added too: `invalid_zip`,
  `invalid_coordinates`, `invalid_phone`, `duplicate_npi`, `possible_branch` (DataAlerts options +
  `AlertInput` union kept in sync).
- **CRITICAL infra fix: `scripts/db-push.ts` was a silent no-op.** It set `PAYLOAD_FORCE_PUSH`/`NODE_ENV`
  AFTER the static `import config`, but ESM hoists imports, so `payload.config` evaluated `push:` (→ false)
  before the assignments ran. Schema changes never reached the DB — which is why the bucket-C `promo_*`
  enum values were ALSO missing from the live enum (silently dropped; `upsertAlert` swallowed the enum
  errors). On a prod build (NODE_ENV=production) it would skip schema sync entirely. Fixed with dynamic
  `await import(...)` after setting the env. The forced push then applied all 5 import_batch columns + all
  9 missing enum values (4 promo_* from bucket C + my 5).
- **photos.csv + qa.csv importers built** (`lib/import/import-data.ts`). Upsert by photoId/qaId; resolve
  provider/clinic from the run map or DB; broken-relationship + missing-source alerts; photos with neither
  a valid provider nor clinic are skipped (error). Q&A: status = answered when answer_text present else new;
  stable slug (reuse existing on re-import, disambiguate new with the qaId). Both stamped with importBatch.
  Verified: 210 photos + 50 Q&A imported from data/fake.
- **Missing-metro auto-create (fixes audit "9 invisible clinics" 🔴).** When a clinic's city has no metro
  Location, `autoCreateMetro` creates one (slug `<city>-<st>`, parent = state Location). Launch states
  (CA/TX/NY/FL) → isLive=true/noindex=false so the clinic surfaces immediately; other states → coming-soon.
  Still raises the `unmatched_city` info alert so an admin reviews it. Verified: Tampa, Orlando, San Antonio,
  Fort Worth, Sacramento, Beverly Hills, Buffalo, Brooklyn all created + live.
- **New dedupe/quality detectors.** Import-time + DB-wide scan: malformed ZIP (5 / ZIP+4), out-of-range
  lat/lng, non-E.164 phone (clean US numbers are NORMALIZED to +1XXXXXXXXXX rather than flagged; only
  unfixable ones flag), duplicate NPI across different name/license, and `possible_branch` (clinics sharing
  a brand-prefix+phone or a website across DISTINCT google_place_ids — flagged for human review, NEVER
  merged; full branch feature stays Phase 6). Branch key is brand-prefix+phone / website, not full name,
  because real branches differ by a city suffix ("Lone Star Med Spa Austin" vs "... Dallas").
- **Single combined CSV (`splitByRecordType`).** One file with a `record_type` column (clinic/provider/
  review/photo/qa, singular or plural) is split into the per-entity arrays the engine already expects; each
  row keeps all columns and each importer reads only its own. `parseCsv` now uses `relax_column_count` so a
  ragged combined file (varying width per record type) parses. Dependency order (clinic → provider →
  review/photo/qa) is preserved by the existing run order.
- **Dry-run mode (default ON in the admin import).** `runImport({dryRun})` validates, resolves
  relationships (new clinics/providers get a `dry:<id>` sentinel so downstream rows resolve), and counts
  would-create/update without any DB write, alert persist, or providerCount recompute. Note: dry-run can't
  detect enum/required-field create-rejects (those surface only on a real create), so the live skip count
  can be a touch higher than the preview — documented behaviour.
- **Scoped wipe (launch-day fake → real swap).** `lib/import/wipe.ts` + `scripts/wipe-data.ts`
  (`npm run db:wipe`) + `app/api/admin/wipe/route.ts`. Scopes: `directory` (reviews, photos,
  before-after-cases, qa, bookings, claims, promotions, data-alerts, providers, clinics — child→parent) and
  `state` (only that state's directory data via collected clinic/provider ids). PRESERVES users, treatments,
  locations, guides, authors, medical-reviewers, faqs, media, AND audit-logs (the wipe is recorded there).
  Safety, all enforced: admin-only (wipe route is admin-only, stricter than import's admin/editor); typed
  phrase ("WIPE DIRECTORY" / "WIPE STATE <CODE>"); automatic backup BEFORE any real wipe (backup failure
  aborts the wipe, no rows touched); dependency-order delete; one summary AuditLog entry. Bulk deletes pass
  `context: { disableHooks: true }`; the audit + revalidate hooks now early-return on that flag so a wipe
  doesn't fire thousands of per-row audit/revalidate calls (one summary entry + one revalidate instead).
- **Backup/scan extracted + buttons.** `lib/db-backup-core.ts` (`backupDatabase`, `latestBackup`) and
  `lib/import/scan.ts` (`runScan`) are now shared by the CLI scripts AND new admin endpoints
  `/api/admin/backup` (GET last / POST new) and `/api/admin/scan` (POST). The admin DashboardWidget gained
  a "Data tools" panel: Back up now (+ last-backup timestamp), Re-scan alerts, and the scoped wipe UI
  (preview → typed-phrase confirm → wipe), plus the bulk-import box now does combined-or-separate files
  with a batch label, a Dry run (preview) button and a Commit button.
- **EXPORT CSV (Block 1e) SKIPPED** as optional, to keep blast radius down. **Block 6 (real batch test)
  SKIPPED** — no real data available; tested against data/fake only.
- **Verification honesty:** the Payload admin SPA is too heavy for the preview harness here (documented in
  the 2026-06-10 cockpit entry), so the Data-tools UI was not click-tested in a browser. The endpoints +
  engine behind every button were verified directly via the CLI equivalents (import dry-run + real, scan,
  db:wipe directory-dry + state-live + no-confirm-refusal, db:backup, db:restore) and DB queries. Left the
  dev DB in the good post-import state (restored backup C: 99 clinics / 218 providers / 2800 reviews /
  233 photos / 60 Q&A, FL intact, schema columns present).


## 2026-06-10 — Admin UX cockpit pass (completes bucket C)

Finishes the one bucket-C item left open ("Admin UX is bare"). Founder picked the full cockpit pass
(all three pillars) and read-only trust guardrails. ALL CHANGES ARE PRESENTATIONAL: only `admin.*`
config (descriptions, groups, columns, `readOnly`, custom `Cell`) plus new admin-only React
components. NO schema/DB change, so no `db:push`/`generate:types`; ran `generate:importmap` for the
new path-referenced components. tsc clean, production build green (all admin components compiled,
importmap resolves all 8), `/`, `/admin`, `/admin/login`, and the data-alerts/bookings/promotions
list routes all 200.

- **Decision: leverage Payload's native surfaces, do NOT build bespoke custom views.** A custom
  leads/alerts console is high-maintenance and drifts from the schema, against the locked "fewer
  files" principle. The bareness was missing orientation/legibility/guardrails, not missing screens.
  Three pillars instead:
- **Pillar 1 (Orient):** brand the panel (`graphics.Logo` + `graphics.Icon` wordmark, mint dot as the
  one accent, theme-var text so it flips in dark); an `afterNavLinks` "Open live site" quick link; and
  the `beforeDashboard` `DashboardWidget` evolved into an operator cockpit — a "Needs you now" priority
  strip (error alerts + leads stale >= 2 days), a quick-actions row (Import, Manage markets, New
  promotion, Review leads, Resolve alerts, View live site), a collapsible plain-English "How this works"
  for the 5 real workflows, then the existing Data-integrity + New-leads cards + bulk CSV import.
- **Pillar 2 (Legibility):** one-line `admin.description` on every collection (what it is / when to
  touch it); `listSearchableFields` on the browse-heavy ones (Providers, Clinics, Bookings, Locations);
  moved Claims from the "Access" group to "Operations" (it is an operational queue); and five tiny
  color-coded list-cell components sharing one `Badge` helper — DataAlerts severity + status, Bookings
  status (with a "Nd waiting" suffix on stale new leads), Promotions active/expired/inactive (reads
  endDate), Claims status. Cells are defensive (`cellData ?? rowData[field]`, safe fallback render) so a
  prop-shape surprise degrades to a dash, never a crash.
- **Pillar 3 (Guardrails, founder call):** system-managed trust fields are `admin.readOnly` so they
  can't be fabricated by hand — `aggregateRating`/`aggregateRatingCount` (computed from imported
  reviews) and `claimed`/`claimedBy` (set on claim approval) on Providers/Clinics, `claimed`/`claimedBy`
  on Brands, and `alertKey` on DataAlerts. Still settable by import/hooks/API; only the admin form is
  locked. Directly de-risks the trust/legal findings (no hand-typed 4.9 ratings).
- **Verification honesty:** the local Payload admin SPA is too heavy for the preview harness here
  (120-164s cold compiles, wedged headless renderer) and the documented seed password (`changeme`) is
  no longer current, so an authed in-browser click-through of the cockpit/badges could not be captured.
  Functional verification stands on tsc + production build + importmap resolution + 200s on all admin
  routes + the fact that none of the new code reads `.id` unguarded (a transient dev-only
  `reading 'id'` RSC/importmap error appeared during cold compile, absent on warm 200 responses).


## 2026-06-09 — Audit bucket C: Admin / Ops overhaul (post full-audit)

Third execution block off `docs/AUDIT-FINDINGS.md` ("Admin / operator usability + warnings" and
"Dead / unwired schema"). Founder decisions taken up front via in-chat question. Schema touched
(new DataAlerts enum values only): `db:backup` then `db:push` + `generate:types` were run. tsc
clean, build passes, scan:alerts at baseline (18: info 15 / warning 3), dev boots, `/`, `/admin`,
`/questions`, `/botox/new-york-ny` all 200.

- **Promotions completeness validation added to the existing `beforeChange` (gated on `active`).**
  Drafts and deactivation stay free: validation only fires when the promo is (or is going) active,
  so the scan's auto-deactivate of a broken legacy promo never trips it. Rules: sponsored-card /
  organic-pin REQUIRE a provider; banner REQUIRES `bannerImageUrl` + `bannerLinkUrl`; scope target
  must match `scopeType` (treatment scopes need `treatmentScope`, location scopes need
  `locationScope`, body-area needs `bodyAreaScope`). Each throws a plain-English error telling the
  operator what to set or to save it inactive as a draft. Uses a merged `field()` reader
  (`data ?? originalDoc`) so partial API updates do not raise false "missing".
- **Expired-promo handling = BOTH flag + auto-deactivate (founder call).** Frontend queries already
  filter `endDate > now`, so this is admin hygiene, not broken render. `scripts/scan-data-alerts.ts`
  now detects active promos with a past `endDate`, raises a `promo_expired` warning, AND flips
  `active=false` via `overrideAccess`. Self-healing: once inactive it is no longer raised, so
  `reconcileAlerts` auto-resolves the alert next scan. No new cron infra: the scan is the de-facto
  scheduled job.
- **New DataAlerts types for promotion health** (the only schema change this bucket): `promo_missing_provider`,
  `promo_missing_image`, `promo_expired`, `promo_scope_mismatch`. Added to `collections/DataAlerts.ts`
  options AND the `AlertInput` union in `lib/import/import-data.ts` (kept in sync). New scan detectors,
  on ACTIVE promos only (inactive do not render and the new validation blocks activating broken ones):
  scope mismatch (warning), banner without image (warning), sponsored/pin with no provider set
  (`promo_missing_provider`, error) vs provider set-but-deleted (kept the existing `orphaned_promotion`,
  error). All defense-in-depth: they catch legacy / overrideAccess / import-created promos that bypass
  the form validation, and self-heal once fixed.
- **Banner spec mismatch resolved at 6:1 (founder call).** Field description said 1200x160 (7.5:1) but
  `AdBanner` renders 6:1, squishing images. Locked 6:1 = no component change (least risk); updated the
  `bannerImageUrl` description to "1200 x 200 px (6:1), JPG/PNG under ~200 KB, cropped to fit so keep
  content centered" and noted image + link are required to go active.
- **Q&A revalidate hook wired.** `collections/QA.ts` had no `afterChange`/`afterDelete`, so answering /
  publishing a question did not refresh `/questions` until the 5-min ISR window. Now uses the shared
  `lib/revalidate-hook.ts` like Providers / Guides.
- **Operator lead alerts on the admin dashboard = unread count + oldest unactioned (founder call).** No
  email in v1, so `components/admin/DashboardWidget.tsx` gained a "New leads" card mirroring the
  data-integrity card: count of bookings with `status=new` plus how long the oldest has waited (red
  left-border once it is >= 2 days stale, amber otherwise, mint when zero), linking to the filtered
  Bookings list. Reuses the admin cookie session (Bookings read is admin/editor only). No schema change.
- **Dead / unwired schema = LABEL "NOT LIVE YET (Phase N)" (founder call), never removed.** Phase-1
  scaffolding that confuses operators is now self-documenting via `admin.description`: Brands collection
  + `Providers.additionalClinics` -> Phase 6 (branches); `subscriptionTier`/`subscriptionStatus` on
  providers/clinics/brands -> Phase 9 (pricing, corrected from a stale "Phase 8" note); 
  `Users.savedProviders`/`savedClinics` -> Phase 8 (corrected from a stale "Phase 7" note). Description
  text only (no DB column change), so no extra `db:push` needed for those. Colons used instead of em
  dashes per the hard copy rule.


## 2026-06-09 — Audit bucket B: Core UX fixes (post full-audit)

Second execution block off `docs/AUDIT-FINDINGS.md` ("Core UX"). Founder decisions taken
up front via in-chat question. No schema change (no db:push / generate:types). tsc clean,
build pass, all changed pages return 200 (verified via dev-server curl + SSR HTML greps).

- **Desktop header search = always-visible inline bar (founder call), routing to a new `/search`
  page (founder call).** The header search icon was `md:hidden` (mobile only); inner pages had no
  desktop search. Added `components/header/HeaderSearchBar.tsx` (compact treatment + location pill,
  submits to `/search?treatment=&location=`). Wired into `HeaderClient` as a SECOND header row
  (`hidden md:block`, inside the sticky `<header>`) shown only on inner pages — `usePathname() !== '/'`
  hides it on the homepage where the Hero owns search. Chosen over cramming it into the main nav row
  (mega-nav + right cluster already fill the row; a second row reads as "always-visible inline
  search" without overflow). The mobile overlay now also routes to `/search` (was routing to the
  best-match directory page) so mobile + desktop share one destination. Removed the now-unused
  `toSlug` helper.
- **New `/search` results page (`app/(frontend)/search/page.tsx`, `dynamic = 'force-dynamic'`,
  `robots: noindex,follow`).** Search results are thin/duplicate, so noindex,follow (follow so
  crawlers still reach the linked profiles). Backed by `lib/search-queries.ts#searchDirectory` — a
  PRAGMATIC v1: loads providers (depth 2) + clinics and filters IN MEMORY by treatment name +
  location text (state full-name → code map so "California" matches state "CA"). Providers ranked by
  `byMeritDesc`, clinics by review count. This is deliberately simple; real server-side search
  (Postgres full-text + PostGIS radius + geocoding) stays ROADMAP Phase 5. The page reuses
  `HeaderSearchBar` (prefilled, to refine) + `ProviderClinicResults`. Empty state points to the 4
  launch markets. NOTE: homepage `SearchAction` JSON-LD was NOT re-added — the schema expects a
  single `q` param and `/search` uses treatment+location; re-adding cleanly is a separate small task.
- **State hub now lists providers AND clinics (launch-blocker fix).** `/new-york` etc. previously
  showed only treatment + city grids — zero injectors. Extended `getStateHub` to fetch all providers
  `licenseState = stateCode` (depth 2) + all clinics `state = stateCode` (with in-DB provider counts).
  The catch-all state-hub branch now mirrors the city-directory: fetches `getOrganicPins('state',…)`,
  applies `applyMeritOrder` (admin pins first, then merit desc, sponsored excluded), and passes the
  ordered providers to `StateHubPage`. New "Injectors in [state]" section renders sponsored cards
  (already wired) above a new generic `components/shared/ProviderClinicResults.tsx` (Providers |
  Clinics tabs, both panels mounted via `hidden` for SEO, client "Load more" 12 at a time, shared
  `iw_saved_clinics` localStorage). Founder asked for "all providers/clinics from the state,
  paginated, with sponsored + merit" — delivered. Added a provider `ItemList` (Physician) to the
  state-hub JSON-LD (the audit flagged state hubs as thin).
- **Provider location prominence (audit "high").** A provider's location came only from its clinic
  and showed small in a card corner; multi-clinic made "where is this provider" ambiguous. Added a
  prominent pin-icon location line (`neighborhood, city, state`) to: `DirectoryProviderCard` (above
  the license row; dropped the redundant corner city), `ProviderResultCard` (Hero), `FeaturedInjectors`,
  and the provider profile hero (under the title, linking to the clinic). All use ink-tertiary/
  secondary tokens (dark-safe).
- **`/injectors` pagination = client "Load more", 24/batch (founder call).** The index SSR-loaded all
  providers + map with no pagination. Kept the single SSR fetch and all client filter/map/compare
  logic intact; the card grid now renders 24 at a time with a "Load more injectors" button + "Showing
  N of M" line, resetting to 24 when filter/sort/location changes. Map pins still cover the full
  filtered set (clustering is Phase 5). Raised `getProvidersListing` limit 100 → 1000 so "Load more"
  can reach every provider. Server-side `?page=` pagination was rejected as Phase-5 scope (would break
  the current client-side global filter + map-over-all-results).


## 2026-06-09 — Audit bucket A: Truth & Legal fixes (post full-audit)

First execution block off `docs/AUDIT-FINDINGS.md`. Founder decisions taken before the work
(via in-chat question). Pure frontend/copy + query changes, NO schema change. tsc clean, build pass.

- **Reviews "verified" — KEPT AS-IS (founder call).** The audit flagged that `Reviews.verified`
  defaults true and the importer marks every row (incl. scraped) verified = false-advertising risk.
  Founder chose to leave it for now. STILL OPEN / accepted risk — must be revisited before public
  launch (Phase 12) with real provenance or honest labels. No code changed here.
- **License "verified" — now HONEST + checkable.** New `lib/license.ts#licenseClaim(url)`: renders
  "License verified" ONLY when a `licenseVerificationUrl` (state-board record) exists, else the
  neutral "License on file" (no verification claim). The board URL is linked from the provider
  profile (existing "Verify" link). Threaded `licenseVerificationUrl` through the 4 card-feeding
  query types + mappers (`ProviderListItem`, `DirectoryProvider`, `FeaturedProvider`,
  `HeroProviderCard`) and applied the helper in every per-provider badge: DirectoryProviderCard,
  ProvidersGrid, QuickViewPanel, FeaturedInjectors, ProviderResultCard, and the profile pill +
  profile meta-description. Cards do NOT link the badge externally (avoids nested-anchor bugs); they
  route to the profile where the board link lives. Provider dashboard pill left as-is (private page,
  not a public representation). CompareModal shows only "ST #NUM" (no claim) — untouched.
- **"No paid rankings" copy — REMOVED everywhere user-facing (founder call).** We sell sponsored
  cards + ad banners, so a blanket "no paid rankings" claim is FTC-risky. Stripped from: Hero,
  PreFooterCta, StateHubPage, NeighborhoodPage, CityDirectoryPage (description + the "Zero paid
  rankings" trust chip), the catch-all `generateMetadata` (city-directory + state-hub descriptions),
  careers page, and `public/llms.txt` (softened to just the sponsored-labelling disclosure). The
  CLAUDE.md historical note is documentation, left intact. Mockups/design files are historical, not
  touched.
- **Consent-gating before/after — DONE.** Homepage "Real Patient Stories" query
  (`getHomePageData`) now filters `consentGranted: { equals: true }`; the provider-profile
  before/after query was already gated. `Photos` collection is not rendered anywhere on the
  frontend, so there is no current display risk there (gate when a gallery is built).


## 2026-06-09 — Fake 4-state dataset generated (CA/TX/NY/FL)

Prep for ROADMAP Phase 4 (import hardening): a realistic, intentionally-faulty fake dataset
to stress-test the existing import engine + dedupe + DataAlerts BEFORE the single-combined-CSV
work. No schema change — data only. Branch: not committed (per instruction, no push).

- **Generator, not hand-written CSVs.** `scripts/gen-fake-data.ts` — deterministic (PRNG seed
  `20260609`), so re-running reproduces byte-identical files. Why: ~2,700 review rows can't be
  authored by hand, and a seeded generator makes faults reproducible and the expected counts exact.
- **File layout.** Output to `data/fake/` (never overwrites `data/samples/`):
  `clinics.csv` (95), `providers.csv` (213), `reviews.csv` (2762), `photos.csv` (210), `qa.csv` (50).
  `data/fake/EXPECTED.md` documents the full fault map + expected import/scan counts.
- **Volume = "heavier".** 60 base (clean) clinics — CA 18 / TX 16 / NY 14 / FL 12 — 1–4 providers
  each, 5–30 reviews each; the rest are curated fault rows. Cities chosen so most clinics match a
  seeded metro Location (LA/SF/San Diego, Houston/Dallas/Austin, New York, Miami).
- **Only clinics/providers/reviews are imported.** `npm run import` has no photos/qa importer yet
  (ROADMAP TODO), so `photos.csv`/`qa.csv` are generated future-ready but NOT ingested today.
- **Faults split into "detected today" vs "carried gap".** Detected (62 of 66 import alerts +
  3 scan): missing_coordinates, missing_source, missing_trust_field, duplicate_clinic (place_id),
  duplicate_provider (name+state+license), unknown_treatment (alias-map miss), broken_relationship
  (provider→bad clinic, no-treatment, review→bad clinic/provider), unmatched_city, and `other`
  errors from required-field/enum/slug rejects. Carried-but-undetected (deliberate, for Phase 4 to
  build detectors): bad zip, out-of-range lat/lng, dirty phone format, duplicate NPI-alone, and
  same-brand branches (same name/phone/website, distinct place-ids). Documented in EXPECTED.md.
- **Verified end-to-end on the dev DB.** Fresh import = clinics 87/1/7, providers 198/1/14, reviews
  2754/1/7; 66 alerts (info 14 / warning 28 / error 24); `scan:alerts` = 18 (info 15 / warning 3).
  Every count reconciles to a labelled fault. `npm run db:backup` taken before import; rollback
  available. Two ordering gotchas fixed during the run and baked into the generator: (1) fake review
  ids offset to `rev-50000001+` so they don't clobber the seed's `rev-00000001+` mock reviews;
  (2) base clinic/provider slugs forced unique so the only `invalid: slug` reject is the one curated
  collision fault (otherwise random name reuse caused unlabelled cascade rejects).

---

## 2026-06-09 — P0 production-readiness fixes (post Phase-3 audit)

Audit of Phase 0–3 (features + security + SEO + backend) surfaced these blockers; all fixed.

- **On-demand ISR revalidation added (`lib/revalidate-hook.ts`).** Every public page is
  `revalidate=300` but there was NO `revalidatePath` anywhere, so admin edits (e.g. toggling a
  market live) did not show on the production/Railway site for up to 5 min — the root cause of
  "admin me live kiya par coming-soon hi dikhta hai." `revalidateAfterChange`/`revalidateAfterDelete`
  now call `revalidatePath('/', 'layout')` and are wired into Locations, Providers, Clinics,
  Treatments, Promotions, Reviews, Guides. Wrapped in try/catch so CLI scripts (import/seed/set-live)
  that run the same hooks don't crash (revalidatePath throws outside a Next request — harmless no-op).
  `route-resolver` module cache got a 60s TTL so newly-added locations become routable without a
  server restart.
- **Relationship IDs coerced to numbers in API routes.** `/api/claims` passed `targetId` as a
  string → every claim submission 500'd (`ValidationError: Target Provider`). Fixed with `parseInt`
  (+ NaN guard). Same hardening applied to `/api/bookings` (provider/clinic ids). This is the locked
  "relationship IDs must be raw numbers" rule, which the API routes were violating.
- **CRITICAL auth bug fixed: cookie-based auth was broken everywhere.** `payload.auth({ headers })`
  does NOT read the `payload-token` cookie in this setup (returns null); it only honors a token
  passed as `Authorization: JWT <token>`. This silently broke the provider dashboard (load + save),
  the admin CSV-import widget, and claim session detection — all 401/redirect-to-login in a real
  browser. (`components/header/Header.tsx` was already stubbed to `user={null}`, so there was no
  working example masking it.) Fix: new `lib/auth-user.ts#getAuthUser(payload)` reads the cookie via
  `next/headers` `cookies()` and hands it to `payload.auth` as a JWT. Wired into `/api/admin/import`,
  `/api/dashboard/save`, `/api/claims`, and `/app/(frontend)/dashboard/page.tsx`. Verified: cookie-jar
  upload → 200; `/dashboard` with a session cookie resolves the user. `Header.tsx` intentionally left
  stubbed — making it read `cookies()` would force every page out of static/ISR generation.
- **Railway data path = admin CSV-upload widget (chosen by founder).** The widget
  (`DashboardWidget` → `/api/admin/import`) now authenticates correctly, so on Railway: log into
  `/admin`, upload clinics/providers/reviews CSVs, then toggle markets live (reflects immediately via
  the revalidation hook). Railway has its own DB — local imports do not affect it. photos.csv/qa.csv
  importers still don't exist (P2).

## 2026-06-09 — Phase 3 hardening (review pass)

- **`isLive` is the master switch (footgun fix).** `isMarketNoindex` now returns true whenever a
  market is NOT live, regardless of the `noindex` flag. New `isMarketIndexable(loc)` = live AND not
  noindex. Why: the two flags are independent checkboxes; an admin could set a coming-soon market
  `noindex=false` by mistake and accidentally index a thin page. Now non-live = always noindex; the
  `noindex` flag is only a fine-grained override for live markets you want to temporarily hide.
- **Sitemap filters indexable (live AND not noindex), not just live.** A live-but-noindex market
  would otherwise appear in sitemap.xml while carrying a noindex tag — a contradiction. Now both
  conditions are required.
- **Coming-soon pages use `noindex, follow` (was `noindex, nofollow`).** So crawlers still follow the
  "Available now" links onward to live markets even though the thin page itself is not indexed.
  Standard practice for thin/utility pages.
- **"Coming soon" chip on Browse-by-State is muted grey, not mint.** Mint = verified/active/success in
  this design system, so it was the wrong signal for an inactive market; 46 mint dots also broke the
  "at most two mint accents per viewport" brand rule. Now `text-white/40` + `bg-white/30` dot.
- **Treatment-state pages (`/botox/ohio`) also render the coming-soon block** (not just noindex). This
  extended the coming-soon UI beyond the three originally-scoped components for consistency.
- **Still open (not Phase 3):** the "Zero paid rankings" / "no paid placements" copy on the city
  directory page + its metadata pre-dates the monetization tiers and should be revisited (the Trust
  Bar claim was already removed; this copy was missed). Flagged for a separate pass.

## 2026-06-09 — Phase 3 (markets control) executed

- **Single source of truth = `lib/markets.ts`.** `isMarketLive` (default false), `isMarketNoindex`
  (default true), `NOINDEX_ROBOTS`, `LAUNCH_STATE_CODES = [CA,TX,NY,FL]`. Homepage, router
  `generateMetadata`, and sitemap all read from here so liveness logic is never duplicated. Why:
  three call sites were each fetching locations independently; one helper keeps them consistent.
- **No schema change.** Phase 1 already added `Locations.isLive` + `noindex`. Phase 3 only polished
  the admin (moved both to the sidebar with plain-English labels — `position`/`label` are
  presentational, no DB column change) and threaded the fields through `LocationInfo` + `mapLocation`
  + `StateRow` (TS only). So no `db:push`/`generate:types` needed.
- **Coming-soon states stay clickable (not hidden, not disabled).** Browse-by-State renders non-live
  states dimmer with a mint "Coming soon" chip but keeps the link, so a visitor lands on the
  coming-soon page and can join the waitlist. Chosen over hiding them (loses the waitlist funnel) or
  disabling the link (dead-ends the visitor).
- **Waitlist = VISUAL-ONLY STUB (`WaitlistSignup`).** The coming-soon email form validates + confirms
  client-side but persists nothing. Why: Phase 10 (Newsletter) owns the real Subscribers collection +
  double opt-in; building a throwaway capture now would overlap that and add a premature schema. The
  stub keeps the coming-soon page complete without faking a backend.
- **noindex scope.** `robots: noindex,nofollow` is applied to non-live city-directory, state-hub,
  city-hub, treatment-state, and neighborhood pages. Treatment pillars (`/botox`) are national and
  stay indexable. Coming-soon UI itself is rendered only on the three named components
  (CityDirectoryPage, StateHubPage, CityHubPage); treatment-state + neighborhood get noindex only
  (kept blast radius small — they are deep pages that only have data in live markets anyway).
- **Sitemap = live markets only.** `getAllStateSlugs`/`getAllCitySlugs` now filter `isLive=true`
  (sitemap-only helpers). Coming-soon pages are noindex, so they must not appear in sitemap.xml.
- **Launch set applied by idempotent script, not manual admin.** `scripts/set-live-markets.ts`
  (`npm run set:live`) enforces exactly CA/TX/NY/FL + their child cities/metros/neighborhoods live,
  the 4 states also `featured` + `sortRank` 1-4 (so they lead the homepage grid), everything else
  coming-soon. Why a script over admin clicks: repeatable, documents the locked launch set, and
  re-runnable after any data reload. db:backup taken before running; scan:alerts clean after
  (1 pre-existing info alert, unrelated to locations).

## 2026-06-08 — Phase 2 follow-up (planning)

- **Production-grade search & maps is its own phase (now Phase 5), not folded into Phase 2.**
  Why: Phase 2 surfaced clinics on city money pages, but real search is a much bigger job —
  server search API, Postgres full-text, PostGIS radius (`ST_DWithin` + GIST; PostGIS is
  installed but currently unused for queries), geocoding, a unified provider+clinic ranking,
  Hero search showing clinics (today providers-only in `lib/hero-queries.ts`), and marker
  clustering. It needs data at scale to test, so it depends on Phases 2, 3, 4. The roadmap was
  renumbered: old Phases 5–11 shifted to 6–12.
- **Honest gap recorded:** today "search" is client-side filtering of a pre-loaded list, not
  server search; distance is browser haversine; clinics have no ranking algorithm (providers use
  `lib/merit.ts`, clinics sort by review count only). This is acceptable for the demo/MVP and is
  explicitly deferred to Phase 5.
- **Generate the fake faulty dataset NOW, before the importer hardening (Phase 4).** The founder
  will produce realistic, intentionally-imperfect fake data for the 4 launch states (CA, TX, NY,
  FL) — some fields wrong, some missing, some duplicated — so the import pipeline, dedupe, and
  DataAlerts are stress-tested against real-shaped dirty data rather than clean data. Must follow
  `data/scraper-brief.md` schemas and the locked snake_case→camelCase + raw-number relationship
  ID rules. The import engine already exists (`npm run import`), so this data is loadable/testable
  immediately. ASSUMPTION (already locked Phase 1): the 4 states are CA, TX, NY, FL.

## 2026-06-08 — Phase 2 (clinics in the directory) executed

- **Surface clinics via a tab toggle, not a separate stacked section.** City/treatment money
  pages (e.g. `/botox/new-york-ny`) got a `Providers | Clinics` segmented control (default
  Providers, so existing behaviour is unchanged). Why: matches how directories like Zocdoc /
  RealSelf separate doctors from practices; keeps the page scannable instead of doubling its
  length, and the default tab means zero change for the common provider-first flow.
- **Clinics tab = treatment-relevant only.** Show only clinics that have at least one provider
  offering this treatment (derived from the providers already matched, with a provider-count
  badge). Why: keeps the Clinics tab consistent with the Providers list on the same page; a
  city's unrelated clinics would be noise on a `/botox/...` page. Alternative (all city clinics)
  was rejected.
- **No new query for clinics.** `getCityDirectory` already fetched the city's clinics to derive
  provider scope; the Clinics list is computed from that result set. Zero added DB round-trips.
- **Clinic card reuses the `/clinics` index style** (photo, name, neighborhood, rating, save
  button sharing the same `iw_saved_clinics` localStorage key) plus a provider-count line and a
  `View clinic` CTA to `/clinics/[slug]`. New components: `CityListingTabs`,
  `DirectoryClinicsView`, `DirectoryClinicCard`.
- **Both tab panels stay mounted (toggled via `hidden`), not conditionally rendered.** Why:
  clinic anchor links land in the server-rendered HTML for crawlers and the tab switch is
  instant. The clinics map is still lazy (`ListingMapInner`, dynamic, renders only in Map view).
- **Provider map (Phase 4 mobile fix) left untouched.** The Clinics tab uses the existing
  `/clinics` inline List/Map pattern (`scrollWheelZoom` off, no scroll-trap) rather than the
  provider full-screen overlay, so the Phase 4 work is not at risk.
- **SEO:** added a clinic `ItemList` (`MedicalBusiness` items) alongside the existing provider
  `ItemList`; `BreadcrumbList` + FAQ schema unchanged. No schema/data changes in this phase.

## 2026-06-08 — Phase 1 (data model lock) executed

- **Provider multi-location = primary + additional, additive.** Kept `Providers.clinic`
  (single, required) as the primary location; added `additionalClinics` (hasMany, optional)
  for branches. Why: avoids refactoring all existing `provider.clinic` references; zero breakage.
- **Brands collection added.** Parent company that groups clinic branches. Clinics got an
  optional `brand` relationship. Each clinic stays its own location/page.
- **Markets control fields on Locations.** `isLive` (default false) and `noindex` (default true).
  Defaults are conservative so new/coming-soon cities never get indexed by accident. The 4 live
  states get switched on in Phase 3.
- **Subscription fields added now, wired later.** `subscriptionTier` (free/starter/pro/elite,
  default free) + `subscriptionStatus` on Providers, Clinics, Brands. No gating logic yet (Phase 8).
- **User saved lists.** `savedProviders` + `savedClinics` (hasMany) on Users, for the Phase 7
  patient profile.
- **Photos gallery already supported.** The existing `Photos` collection relates to both
  `provider` and `clinic`, so no gallery schema change was needed.
- **SSL localhost fix (payload.config.ts).** The Railway SSL setting forced SSL whenever
  DATABASE_URI was set, which broke local Postgres (no SSL). Now localhost/127.0.0.1 disables
  SSL; remote (Railway/DO) keeps it. Fixes `npm run db:push` locally.

## 2026-06-08 — This session

- **Build-then-swap strategy.** Build the full product on fake data, then wipe and load real
  data at launch. Why: pre-launch there are no real users, so the swap is safe and it lets us
  see the whole vision working before going public.
- **Fake data mimics real data, with faults.** Generate dirty fake data (missing fields, bad
  formats, duplicates) so the import pipeline is tested against reality, not clean data. Why:
  clean fake data gives false confidence and hides bugs that surface on real-data day.
- **Schema-first.** Lock the full data model before generating bulk fake data. Why: a model
  change after data exists forces regenerating everything.
- **Launch markets = 4 states:** California, Texas, New York, Florida. Rest = coming soon +
  noindex. Why: real data only for priority markets; thin pages get noindex to avoid SEO penalty.
  ASSUMPTION TO CONFIRM: "LA" was read as Los Angeles (California), not Louisiana.
- **One combined CSV.** The 7 source CSVs are merged, cleaned, and sorted into a single CSV,
  then uploaded in admin. The import pipeline must accept that one file.
- **Clinics are shown in listings,** not just providers. Why: clinics are first-class directory
  entities and the data has them.
- **Branch model = 3 layers:** Brand (parent company) / Clinic (one physical location, its own
  page) / Provider (a person, can work at multiple clinics). A "branch" is just another Clinic
  record grouped under a Brand. Why: each location needs its own page for local SEO.
- **Branch detection = auto-suggest, never auto-merge.** System flags likely branches (same
  name/phone/website) as a DataAlert; a human confirms. Why: two same-named providers in
  different cities are not the same person; silent merge corrupts data.
- **Branch claim = existing claim/auth flow.** A claimed owner can link their other locations
  by selecting from the existing list, or add a new one pending admin verification.
- **Admin index/noindex control** for states and cities. Why: control which markets are live
  and indexable without code changes.
- **Patient accounts + profile page** with saved providers. (Was Phase 2 / deferred; now in plan.)
- **Pricing = Free + 3 paid tiers** (Free claimed / Starter / Pro / Elite), feature-gated
  (photos, social links, before/after, analytics, featured). Manual billing v1; Stripe later.
- **Verification + organic ranking stay free and unbuyable.** Only clearly-labeled sponsorships
  are paid. Why: trust is the product in a health directory.
- **Remove the "zero paid placements" claim** from the Trust Bar. Why: it contradicts selling
  paid tiers and sponsored slots. (Chosen: drop the claim.)
- **Newsletter** (double opt-in, Resend, CAN-SPAM) and a **News page** (separate from Guides,
  with NewsArticle schema + RSS) are in the plan, post-core.
- **Project structure:** adopt only a minimal foundation now (docs/, .env.example,
  .claude/settings.json, db:backup, deploy-check). Defer advanced scaffolding (rules/ split,
  agents/, hooks/, skills/, .mcp.json, CLAUDE.local.md) until there is real pain or a team.
  Why: structure you do not maintain goes stale and misleads; a noob solo dev needs fewer files.

---

## Earlier locked decisions (carried from CLAUDE.md, for quick reference)

- Stack: Next.js 15 + Payload 3 + Postgres + PostGIS. Production = DigitalOcean. Vercel = demo only.
- Media = DO Spaces via @payloadcms/storage-s3. Never Vercel Blob.
- Leads v1 = admin dashboard only, no email (Resend dormant behind RESEND_API_KEY).
- Auth = single Users collection, roles admin/editor/provider/patient.
- AI Face/Skin Analyzer = SKIPPED (Texas CUBI, Illinois BIPA biometric law + medical liability).
- AI layer (review summarizer, NL search, bio generator) = SKIPPED for now (quota/perf).
- Design: token-only colors, mobile-first, dark-mode rules (never `text-white` on `bg-brand-primary`).
- Hard copy rules: no em dashes, real copy never lorem ipsum, no emojis unless asked.

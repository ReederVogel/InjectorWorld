# injector.world — Execution Roadmap (LOCKED 2026-06-08)

This is the live execution plan. CLAUDE.md is the law (what + why, locked design/decisions).
This file is the order of work. `docs/DECISIONS.md` is the append-only decision log.
`docs/DONE.md` is the ship gate every phase must pass.

## Core strategy (locked this session)

- **Build the full product on fake data first, then swap real data at launch.**
  Pre-launch there are no real users, so wiping fake data and loading real is safe.
- **Fake data is generated to mimic real data, including faults** (missing fields,
  bad formats, duplicates) so the import pipeline is stress-tested before launch.
- **Schema-first:** lock the full data model (brand / clinic-location / provider-multi-clinic,
  plus tier + markets + patient fields) BEFORE generating bulk fake data. Otherwise a later
  model change forces regenerating all fake data.
- **Launch markets:** 4 live states on the homepage — California, Texas, New York, Florida.
  Everything else = "coming soon" + noindex. (Confirm: "LA" was read as Los Angeles = California.)
- **One combined CSV:** the 7 source CSVs are merged + cleaned + sorted into ONE CSV, then
  uploaded in admin. The pipeline must accept that single file.

## Workflow (every phase, no exceptions)

1. New focused chat. Load context from CLAUDE.md + docs/DECISIONS.md.
2. If the phase touches data or schema: run `npm run db:backup` first.
3. New git branch. Small commits.
4. Do the phase. End by running the `docs/DONE.md` gate (tsc clean, build pass, all pages 200).
5. Append any new decision to `docs/DECISIONS.md`.

One phase = one chat. Keep blast radius small. Everything reversible via git + db backup.

---

## Phases

Each phase is dependency-ordered. Do not start a phase until its "depends on" is done.

### Phase 0 — Foundation, rails & docs
- **Goal:** an undo button for everything + a locked plan.
- **Scope:** `docs/` (ROADMAP, DECISIONS, DONE, onboarding) [DONE], `.env.example` [DONE],
  `.claude/settings.json` (allow safe commands, deny destructive), `db:backup` + `db:restore`
  scripts, `deploy-check` command. Quick fixes: admin title encoding bug in payload.config.ts,
  remove "zero paid placements" claim from the Trust Bar.
- **Depends on:** nothing.
- **Done when:** rails exist, backup/restore works, quick fixes shipped.

### Phase 1 — Data model lock (schema-first)
- **Goal:** final schema so bulk fake data never needs regenerating.
- **Scope:** new `Brands` collection. `Clinics` gets optional `brand` relationship (each clinic
  stays its own physical location). `Providers.clinic` (single) becomes `clinics` (hasMany).
  `Locations` gets `isLive` + `noindex` fields (markets control). Add now-but-wire-later fields:
  `subscriptionTier`/`subscriptionStatus` on providers + clinics, patient `savedProviders`.
  Run `db:push` + `generate:types`.
- **Depends on:** Phase 0.
- **Done when:** schema final, types regenerated, no data yet.

### Phase 2 — Clinics in the directory — DONE (2026-06-08)
- **Goal:** listings show clinics, not just providers.
- **Scope:** search, map, city pages, filters render clinics + providers. Clinic card component.
- **Depends on:** Phase 1.
- **Shipped:** City/treatment money pages (e.g. `/botox/new-york-ny`) now have a
  `Providers | Clinics` tab toggle (default Providers, zero behaviour change when a city has
  no clinics for the treatment). Clinics tab = treatment-relevant clinics only (>=1 provider
  offering this treatment), with a provider-count badge, save button (shared
  `iw_saved_clinics` localStorage with `/clinics`), and an inline List/Map view (reuses
  `ListingMapInner`, `scrollWheelZoom` off so no scroll-trap). New: `CityListingTabs`,
  `DirectoryClinicsView`, `DirectoryClinicCard`, `DirectoryClinic` type +
  `getCityDirectory` clinics computation (no extra query — reuses the clinics already fetched).
  SEO: added a clinic `ItemList` (MedicalBusiness) alongside the provider ItemList; both panels
  stay mounted (toggled via `hidden`) so clinic anchor links are in the server-rendered HTML.
  No schema change, no data import. The provider map (Phase 4 mobile fix) was left untouched.

### Phase 3 — Markets control (admin index/noindex) — DONE (2026-06-09)
- **Goal:** admin decides which states/cities are live vs coming-soon.
- **Scope:** admin toggle on Locations (`isLive`, `noindex`). Homepage Browse-by-State shows the
  4 live states; rest render "coming soon" + `noindex`. Sitemap excludes non-live.
- **Depends on:** Phase 1.
- **Shipped:** `isLive`/`noindex` moved to the Locations admin sidebar with plain-English labels
  (presentational only, no DB/schema change — Phase 1 already added the fields). New single source
  of truth `lib/markets.ts` (`isMarketLive`, `isMarketNoindex`, `NOINDEX_ROBOTS`, `LAUNCH_STATE_CODES`)
  read by homepage, router metadata, and sitemap. `isLive`/`noindex` threaded through `LocationInfo`
  + `mapLocation` + `StateRow` (TS only). Homepage Browse-by-State: live states normal+clickable
  with provider counts; non-live render dimmer with a mint "Coming soon" chip but stay clickable
  (so the visitor reaches the waitlist). Non-live state/city/city-directory pages render a
  `ComingSoonMarket` block (waitlist email capture via `WaitlistSignup` — VISUAL-ONLY STUB, real
  capture deferred to Phase 10 Newsletter) instead of the directory. `generateMetadata` adds
  `robots: noindex,follow` on non-live city-directory / state-hub / city-hub / treatment-state /
  neighborhood pages (treatment pillars stay national + indexable). `isLive` is the master switch:
  `isMarketNoindex` is true for ANY non-live market (footgun-proof), `isMarketIndexable` = live AND
  not noindex. Sitemap helpers (`getAllStateSlugs`/`getAllCitySlugs`) filter live AND not noindex.
  Browse-by-State coming-soon chip is muted grey (not mint — brand rule). Launch set applied via
  idempotent `scripts/set-live-markets.ts` (`npm run set:live`): CA/TX/NY/FL + their cities/metros/
  neighborhoods → live+indexable, the 4 states also featured + sortRank 1-4; everything else
  coming-soon. Verified: homepage 4 live + 46 coming-soon, /ohio noindex+coming-soon+waitlist,
  /botox/new-york-ny 200+indexable, sitemap live-only. tsc clean. No new branch (worked on
  `phase-2-clinics`). New components: `ComingSoonMarket`, `WaitlistSignup`.

### Hardening pass — DONE (2026-06-09, post Phase-3 audit)
Not a numbered phase; a stabilization sweep after a full Phase 0–3 audit (features + security +
SEO + backend). See `docs/DECISIONS.md` 2026-06-09 entries. Shipped:
- **On-demand ISR revalidation** (`lib/revalidate-hook.ts` on Locations/Providers/Clinics/Treatments/
  Promotions/Reviews/Guides) — admin edits now reflect immediately instead of waiting 5 min. Root
  cause of "admin me live kiya par coming-soon dikhta hai." Route-resolver got a 60s TTL.
- **Cookie-auth fix** (`lib/auth-user.ts`) — `payload.auth({headers})` did not read the session
  cookie, silently breaking the provider dashboard (load+save), the admin CSV-import widget, and
  claim session detection. Now reads cookie → JWT. (`Header.tsx` left stubbed on purpose to keep
  pages static.)
- **Relationship-ID coercion** in `/api/claims` + `/api/bookings` (string → number) — claims were
  500ing on every submit.
- **Security lock-down** — Bookings read/update → admin/editor only (PII); admin-panel access →
  admin/editor only; Claims `create:false` (raw/GraphQL spam blocked, custom rate-limited route
  still works via overrideAccess); 20 MB import file cap.
- **Truthful copy** — "Zero paid placements" claims (false, we sell sponsored slots) → "rankings
  can't be bought" / sponsors labeled. **providerCount recompute** wired into import.
  Homepage SearchAction JSON-LD removed (no `/search` page yet).

### Phase 4 — Single combined CSV import
- **Goal:** the fake (real-like) data goes in through one file.
- **Scope:** 7-to-1 combined CSV schema, dry-run mode, validation, dedupe, DataAlerts, branch
  auto-suggest hints. Reflects in admin. Generate fake data that mimics real (with faults) and
  test against it. Also import one small REAL batch to stress-test dirty data.
- **Prep done up front (2026-06-08):** the founder generates a realistic, intentionally-faulty
  fake dataset for the 4 launch states (CA, TX, NY, FL) BEFORE building the importer, so the
  pipeline + dedupe + DataAlerts have real-shaped dirty data to be tested against. The import
  ENGINE already exists from earlier work (`lib/import/`, `scripts/import-providers.ts`,
  `npm run import`); this phase hardens it for the single combined-CSV format. Data must match
  `data/scraper-brief.md` schemas + the locked snake_case→camelCase + raw-number-ID rules.
- **Depends on:** Phases 1, 2, 3.
- **Added from the audit (2026-06-09):** build `photos.csv` + `qa.csv` importers (engine handles
  only clinics/providers/reviews today); add the missing metro `Location` records that imported
  clinics reference (Tampa, Orlando, San Antonio, Sacramento, Beverly Hills, Buffalo, Brooklyn, …)
  or they never surface on a city page. `recomputeProviderCounts` already runs at end of import.

### Phase 5 — Search & maps (production-grade)
- **Goal:** turn the demo-grade search into real, scalable search across providers AND clinics.
- **Why this is its own phase (added 2026-06-08):** Phase 2 surfaced clinics on city money
  pages, but the homepage Hero search still shows providers only, "search" is really client-side
  filtering of a pre-loaded list, distance is browser-side haversine (PostGIS is installed but
  unused for queries), there is no geocoding, and clinics have no ranking algorithm (providers
  use `lib/merit.ts`; clinics are sorted by review count only).
- **Scope:**
  - **Server search API** (`/api/search?q=&lat=&lng=&type=`) — debounced, returns ranked
    providers + clinics. Full-text on names/treatments (Postgres `tsvector`), not client filter.
  - **PostGIS radius search** — real "within N miles" via `ST_DWithin` + a GIST index on
    lat/lng. Replace the browser haversine sort.
  - **Geocoding** — typed location (address / "near me") → coordinates (Mapbox / Google /
    Nominatim). No PII in URLs.
  - **Unified ranking** — one explainable algorithm that ranks providers AND clinics together,
    blending merit + distance + sponsorship. Extend `lib/merit.ts` to clinics (or a sibling
    `lib/clinic-merit.ts`).
  - **Hero search shows clinics + providers** (currently providers-only in `lib/hero-queries.ts`).
  - **Map at scale** — marker clustering (e.g. Leaflet.markercluster) so thousands of pins stay
    fast; real pagination instead of hardcoded `limit` values.
- **Depends on:** Phases 2, 3, 4 (needs clinics, markets, and data at scale to test radius +
  clustering meaningfully).
- **Shipped (2026-06-10):** First raw-SQL migration `scripts/setup-search-indexes.ts`
  (`npm run setup:search`): provider/clinic full-text GIN + clinic PostGIS GIST geography indexes +
  isolated `search` schema with `geocode_cache`. (`db:push` drops the public-table indexes, verified, so
  `npm run build` rebuilds them after push; both skip cleanly without DATABASE_URI.) `lib/search-sql.ts`
  holds the shared tsvector/geography expressions. `lib/search-queries.ts` rewritten to SQL-filter
  (prefix tsquery full-text + `providers_rels` treatment EXISTS + `ST_DWithin` radius), hydrate matched
  IDs via Payload, rank, and paginate (real `page`/`limit`, no whole-directory load). New `/api/search`
  GET route (q/treatment/location/lat/lng/radius/type/page/limit/geo, 60 req/min/IP). `lib/geocode.ts`
  swappable Nominatim adapter (no PII, two-layer cache, polite throttle). `lib/clinic-merit.ts` +
  `lib/ranking.ts` blend merit + distance (tunable weights); sponsored floated for resolved state scope.
  Hero now shows a Providers | Clinics toggle (clinics derived from matched providers, no extra query;
  `ClinicResultCard`). Map marker clustering via `components/ui/ClusterLayer.tsx` (imperative
  `leaflet.markercluster`, brand-styled bubbles) on `ListingMapInner` + `DirectoryMap`. Browser-verified:
  /clinics clusters 2+24+72+1=99; Hero "Injectors 5 / Clinics 3". See DECISIONS 2026-06-10.

### Phase 6 — Branches / brand experience — DONE (2026-06-10)
- **Goal:** the "dhamakedar" multi-location layer.
- **Scope:** brand hub pages (all locations + all providers under a brand). Auto-suggest likely
  branches via DataAlerts (same name/phone/website) with human confirm, never silent merge.
  Claim-based branch linking ("select your other locations from the list"). Brand-owner dashboard
  to manage multiple locations.
- **Depends on:** Phases 1, 4.
- **Shipped:** No schema change (Phase 1 already added every field). Founder calls: brand URL =
  `/brands/[slug]` + `/brands` index; populate via auto-suggest+confirm AND admin-manual (no CSV
  `brand` column); hub indexable only when ≥1 branch is in a live market; branch linking = admin
  confirm AND owner self-link. New: `lib/brand-queries.ts`, `app/(frontend)/brands/[slug]` +
  `/brands` index, `components/brands/BrandBranchMap`, `lib/branches.ts` (shared detect/link/dismiss),
  `/api/admin/branches` + `BranchSuggestions` cockpit panel, `/api/dashboard/locations` +
  `DashboardLocations` panel, `scripts/seed-brands.ts` (`npm run seed:brands`). Clinic page shows
  "Part of [Brand]" + other locations; provider profile shows "Also practices at" + "+N locations" on
  cards (`additionalLocationCount` on directory/search/promotion mappers). `scan.ts` branch detector
  self-heals once a group is linked. Seeded 2 demo brands (Radiance Aesthetics CA, Lone Star Med Spa
  TX) from the Phase 4 `possible_branch` clusters; 4 branch alerts resolved. tsc clean, build green
  (both hubs prerendered), all changed pages 200. See DECISIONS 2026-06-10.

### Phase 7 — Media on object storage (R2 now, DO Spaces later) — DONE (2026-06-10)
- **Goal:** uploads persist (was local-disk only -> wiped on every Railway/DO restart).
- **Scope:** `@payloadcms/storage-s3` pointed at Cloudflare R2 + public r2.dev URL. Real photos.
- **Depends on:** Phase 4 (records exist to attach media to).
- **Shipped:** All storage config isolated in `lib/storage.ts` (`isRemoteStorageEnabled` +
  `mediaStoragePlugins()`), spread into `payload.config.ts` plugins. R2 = S3-compatible, so the
  DO Spaces move later is ENV-ONLY (swap six `R2_*` values, no code change). `region: 'auto'`,
  `forcePathStyle: true`, no ACL (R2 ignores them; bucket-level public access). `generateFileURL`
  builds public URLs from `R2_PUBLIC_URL` + `disablePayloadAccessControl` (the S3 endpoint is
  private; files serve from the separate r2.dev domain). Dev local-disk fallback when keys absent.
  `next.config.mjs`: `**.r2.dev` added to `images.remotePatterns` + CSP `img-src`/`connect-src`,
  custom domain auto-derived from `R2_PUBLIC_URL`. `.env.example`: stale `DO_SPACES_*` block replaced
  with blank `R2_*` placeholders. imageSizes unchanged (all variants persist). No schema change.
  tsc clean, build green, dev clean, `/`+`/admin`+`/guides` 200. VERIFIED LIVE: bucket
  `injectors-world-media` + Public Development URL + Object R/W token created; a real PNG uploaded via
  the Payload local API got a `pub-...r2.dev` URL that returns 200 image/png from the public internet
  (persist + serve), and delete also removed the R2 object. See DECISIONS 2026-06-10.
- **Follow-up (2026-06-11): provider + clinic self-service photo upload.** `Providers.profilePhoto` +
  `Clinics.photos` (upload -> media) fields; `beforeChange` denormalization hook (`lib/photo.ts`) mirrors
  the uploaded URL into the legacy `profilePhotoUrl`/`clinicPhotoUrls` so the render layer is unchanged
  (NOT afterChange — that deadlocked the row); `/api/dashboard/upload` (POST/DELETE, owner-verified, 8MB,
  rate-limited); provider dashboard headshot upload + clinic-owner gallery; Media writes locked to
  admin/editor. Verified live. NOT on Railway yet (founder: git later). See DECISIONS 2026-06-11.

### Phase 8 — Patient accounts + profile — DONE (2026-06-11)
- **Goal:** patients save providers.
- **Scope:** patient login, `/profile`, saved providers/favorites. Fix the `/forgot-password`
  stub into a real reset flow. **From audit:** wire `Header.tsx` to show the logged-in state
  (currently hard-stubbed to `user={null}`) via a client-side `/api/users/me` fetch so it does
  not force pages out of static generation.
- **Depends on:** Phase 1.
- **Optional early-launch checkpoint:** after this phase the core directory is launch-capable.
  Founder may choose to go live with 4 states here instead of waiting for Phases 9-11.

### Phase 9 — Pricing tiers + entitlements — DONE (2026-06-12)
- **Goal:** Free + 3 paid tiers, feature-gated.
- **Scope:** `lib/entitlements.ts` (tier -> feature flags, like `lib/merit.ts`). `/pricing` page.
  Dashboard upgrade flow. Gate photos/social/before-after/analytics/featured by tier. Manual
  billing v1 (admin sets tier); Stripe self-serve later. Verification + organic ranking stay
  free and unbuyable.
- **Shipped:** `lib/entitlements.ts` (pure config, `can()`/`limits()`/`analyticsLevel()`/`atLeast()`
  helpers). `/pricing` page (4-tier comparison table, FAQ, always-dark CTA). `profileViewCount`
  field on Providers (bot-filtered via `/api/providers/view`, IP+slug 10-min dedup).
  `ProfileViewTracker` client component fires on profile mount. Dashboard `TierBanner` shows
  current plan, analytics (Pro: views+leads; Elite: +referrer placeholder), and upgrade CTA.
  `DashboardForm` social links gated (LockedField for Free). Photo upload gated both client
  (ClinicPhotosUpload count check) and server (upload API 403). Provider profile page gates
  before/after gallery, social links, and website button by tier. Downgrade = hide not delete.
- **Depends on:** Phases 1, 8.

### Phase 10 — Newsletter
- **Goal:** build the email list.
- **Scope:** `Subscribers` collection, double opt-in, Resend send, CAN-SPAM (unsubscribe +
  physical address), consent log. No PHI. **From audit:** the coming-soon `WaitlistSignup` is a
  visual-only stub today — its real email capture lands here (wire it to `Subscribers`).
- **Depends on:** Phase 0.

### Phase 11 — News page + RSS — DONE (2026-06-13)
- **Goal:** broadcast (new treatment, treatment updates).
- **Scope:** `News` collection (separate from Guides). `/news` + `/news/[slug]`. `NewsArticle`
  schema, `/news/rss.xml` feed. Homepage "Latest News" strip. Feeds the newsletter.
- **Depends on:** Phase 0.
- **Shipped:** New `collections/News.ts` (7 categories: treatment-update/industry/company/announcement/
  product-launch/research/regulation; medical reviewer optional; status draft|published; featured flag;
  auditAfterChange + ISR revalidation hooks). Schema applied via direct SQL migration
  `scripts/migrate-news-phase11.sql` (same pattern as Phase 10 to avoid drizzle interactive prompt).
  `lib/news-queries.ts` (NewsCard, NewsDetail, NewsRssItem types; all queries filter published only).
  `components/news/NewsGrid.tsx` (client, category filter tabs, card grid). `components/news/LatestNews.tsx`
  (server, 3-card homepage strip, null-safe). `/news` (CollectionPage JSON-LD, RSS alternate link, ISR
  revalidate=300). `/news/[slug]` (generateStaticParams, full OG/Twitter, NewsArticle + BreadcrumbList
  JSON-LD, author + optional medical-reviewer bylines, newsletter signup). `/news/rss.xml` (RSS 2.0 route
  handler, excerpt+link only, atom:link self-ref, static force-static). `components/admin/
  DashboardNewsSendPanel.tsx` + `/api/admin/newsletter/send-news` (slug+audience+dryRun, 100/batch
  paginated broadcast, auto-composes subject from title+excerpt). `app/sitemap.ts` extended with /news
  pages. `lib/home-queries.ts` extended with 3 latest news (parallel fetch). `payload.config.ts`:
  seoPlugin extended to `['guides','news']`, NEWS_CATS Set for URL routing. 3 real-copy articles seeded.
  tsc clean, build 1057 pages green. See DECISIONS 2026-06-13.

### Phase 12 — Deploy lock + hardening + GO LIVE
- **Goal:** 4 states public.
- **Scope:** lock deployment target (Railway vs DO), standalone build, CSP test (admin + Leaflet
  + fonts), Sentry, performance, final SEO pass, sitemap = live markets only. Swap fake data for
  real data (db:backup first). Go live. **From audit:** move rate-limiting from the in-memory `Map`
  (resets per deploy, not shared across instances) to DO Managed Redis before scaling to >1 instance.
- **Depends on:** everything above.

---

## Post-launch phases (planned 2026-06-17)

The site went live on DigitalOcean on 2026-06-17. The phases below are the next feature set the
founder asked for, planned and locked in `docs/DECISIONS.md` (2026-06-17). One chat per phase.
`db:backup` before the two schema phases (14, 15). SQL migration over `db:push` (drizzle hang).
Nothing ships to the live site without founder approval.

### Phase 13 — Search omnibox (type anything)
- **Goal:** one search box that accepts anything — a treatment, a city/state/neighborhood, a ZIP, a
  provider name, a clinic name, a brand, or a free phrase — not just treatment + location.
- **Scope:** server-side intent parsing (match tokens to the treatment alias map, then to locations +
  ZIPs, leftover tokens become the full-text query). Expand the provider + clinic `tsvector` to also
  cover treatments offered, specialties, languages, and clinic address — edit `lib/search-sql.ts` AND
  `scripts/setup-search-indexes.ts` TOGETHER (they must match) then re-run `npm run setup:search`.
  Add `ts_rank` relevance into `lib/ranking.ts`. New `/api/search/suggest` autocomplete endpoint.
  Optionally surface guides / news / treatment pages / brands as a "Top results" block on `/search`.
  Rewire the Hero (`components/hero/HeroSearch.tsx`) + `HeaderSearchBar` to call the API (debounced)
  instead of client-side filtering of a preloaded list.
- **Risk:** read-only, no schema change, no data ever changed/deleted.
- **Depends on:** Phase 5.

### Phase 14 — ZIP codes + paid ZIP featuring — DONE (2026-06-17)
- **Goal:** users search by ZIP (and nearby ZIPs); a provider can PAY to be featured on a ZIP + a
  radius of nearby ZIPs; admin controls the inventory.
- **Shipped:** `ZipCodes` Payload collection. GeoNames US dataset seeded (41,490 ZIPs, `npm run
  seed:zips`). `lib/zip-lookup.ts` (offline centroid lookup + prefix suggest). `lib/zip-promotion-
  queries.ts` (geo-aware `getZipFeaturedProviders` via PostGIS ST_DWithin). Promotions extended
  with `zip`/`treatment+zip` scopeType + `zipScope` + `zipRadiusMiles` fields + slot-guard.
  DataAlerts extended with `zip_feature_request` type. Provider dashboard `ZipFeatureRequest`
  request form + `/api/dashboard/zip-feature-request` (DataAlert flow). ZIP autocomplete in
  `/api/search/suggest` (real DB lookups, prefix + full-5-digit). Hero IP prefill ZIP-first format.
  SQL migration `scripts/migrate-zips-phase14.sql`. tsc clean, build green, all pages 200.
- **Deferred:** `/zip/[code]` SEO landing pages (Phase 14 scope decision).
- **Depends on:** Phase 13.

### Phase 15 — Content bulk upload + review + gradual indexing — DONE (2026-06-18)
- **Goal:** upload AI-generated JSON of guides / articles / news; review; publish noindex+nofollow by
  default; index gradually so a mass publish does not get penalised.
- **Shipped:**
  - **SQL migration** `scripts/migrate-content-phase15.sql` — adds `review_status`, `index_state`,
    `nofollow`, `import_batch`, `approved_at`, `approved_by_id`, `answer_snippet`, `at_a_glance`,
    `faq`, `sources` to both `news` and `guides` tables. Critical backfill: existing published news
    AND all 13 existing guides are set to `approved+indexed+nofollow=false` so they do not drop from
    Google when the noindex-by-default gate activates. 6 new `content_*` DataAlert types added.
  - **Collections** `News.ts` + `Guides.ts` updated with all new fields plus sidebar visibility
    controls (reviewStatus, indexState, nofollow, importBatch, approvedAt, approvedBy — all
    appropriately readOnly for auto-set fields).
  - **lib/import/content-import.ts** (JSON importer): validates + resolves relations (author,
    reviewer, treatment), builds Lexical body from `introParagraphs` + `sections`, maps structured
    fields, upserts by slug (preserves approval state on re-import), raises DataAlerts for missing
    reviewers/authors/cover/word count/source count.
  - **API routes:** `/api/admin/content-import` (POST, multipart+JSON, dry-run default, 20MB cap),
    `/api/admin/content-approve` (POST: bulk approve N items; GET: pending counts), `/api/admin/
    drip-index` (POST: flip oldest N approved+noindex to indexed+nofollow=false).
  - **scripts/drip-index.ts** (`npm run drip:index -- guides --count=5`): CLI equivalent of drip API.
  - **lib/news-queries.ts** + **lib/guide-queries.ts** rewritten: APPROVED gate replaces PUBLISHED
    (unapproved = 404); `getAllNewsSlugs`/`getAllGuideSlugs` (sitemap) = approved+indexed only;
    new `getAllApprovedNewsSlugs`/`getAllApprovedGuideSlugs` (generateStaticParams) = approved any
    indexState; both Detail types extended with indexState, nofollow + structured fields.
  - **Detail pages** `app/(frontend)/news/[slug]/page.tsx` + `guides/[slug]/page.tsx`: generateStaticParams
    uses approved slugs; generateMetadata emits noindex/nofollow robots meta when `indexState=noindex`
    or `nofollow=true`; render answerSnippet (quick-answer box), atAGlance (bullet list), inline faq[]
    accordion with FAQPage JSON-LD (merged with existing relationship faqs on guides), sources citations
    block (linked, numbered, publisher+date). Guides page: inline faq[] shown before relationship faqs.
  - **DashboardWidget** extended with 3 new panels: Content import (JSON file + dry-run/commit + batch
    label), Content review (pending counts + approve by collection+count), Drip indexer (collection +
    count + go button).
  - **scripts/run-migrations.ts**: `migrate-content-phase15.sql` added to MIGRATIONS array.
  - **package.json**: `"drip:index"` npm script added.
  - tsc clean, generate:types done, db:push done.
- **Decisions:** structured fields on BOTH News + Guides; single approved gate; drip = admin button +
  npm script; missing reviewer = DataAlert + leave unlinked (not stub-create); type:json for
  atAGlance/faq/sources (single jsonb column, simpler than type:array Drizzle tables).
- **Depends on:** Phase 11 (News) + Guides.

### Phase 16 — Mapbox GL migration [DONE 2026-06-18]
- **Goal:** replace Leaflet + CARTO with Mapbox GL across all three maps.
- **Scope:** rewrite `DirectoryMap`, `ListingMapInner`, `HeroMap` with `react-map-gl` v8 + `mapbox-gl` v3;
  native GL clustering replaces `ClusterLayer` (deleted; leaflet/react-leaflet/leaflet.markercluster removed);
  `NEXT_PUBLIC_MAPBOX_TOKEN` added to `.env.example`; CSP updated in `next.config.mjs`
  (`api.mapbox.com`, `events.mapbox.com`, `worker-src blob:`); Leaflet CSS replaced with Mapbox GL
  overrides in `globals.css`; dark map style wired to `next-themes` via `mapbox://styles/mapbox/dark-v11`
  (no CSS filter hack); `GEOCODER=mapbox` is now the default in `.env.example`.
- **Risk:** display only. No DB/schema/Payload change. No db:push needed.
- **Locked:** react-map-gl v8 imports from `react-map-gl/mapbox` (not root); Map renamed to `MapGL`
  in DirectoryMap + ListingMapInner to avoid native JS Map constructor collision; `@types/geojson` added
  as devDependency; `geojson` added as dependency (both required for mapbox-gl v3 type resolution).
- **tsc:** clean. **build:** green (1062 static pages).

### Phase 17 — Google AdSense (fallback fill + admin control)
- **Goal:** run AdSense post-launch without cannibalising our own paid inventory; full admin control.
- **Scope:** `lib/adsense.ts` resolver — per page/scope, AdSense fills ONLY when the scope has no
  active own paid inventory (banner + sponsored-card from `Promotions`). Admin override beats the
  default: per-page `adsenseMode` (`auto | force-on | force-off`) + a sitewide-defaults Payload global.
  Conditional `<AdSlot>` component (decision computed server-side, no flicker). Approval prerequisites:
  privacy-policy update (AdSense + third-party/DART cookies + opt-out), `ads.txt` at root, CSP
  relaxation for googlesyndication / doubleclick / google / gstatic / googleadservices, and a
  cookie-consent banner (CCPA — California is live).
- **Honest:** Google approval + revenue are outside our control; we build to maximise the chance only.
- **Locked:** fallback fill (not content-pages-only).
- **Depends on:** Phase 15 (content helps approval) + Phase 3 (scope vocabulary).

### Phase 18 — Admin UI/UX polish
- **Goal:** make the cockpit easy for a non-technical operator across the new features.
- **Scope:** clear admin surfaces + labels for ZIP featuring, content review + drip indexing, and
  AdSense control; consolidate where the operator manages each new revenue + content workflow.
  Presentational, no data risk.
- **Depends on:** Phases 13-17.

### Phase 19 — Final testing + fixes + redeploy
- **Goal:** verify everything together and ship.
- **Scope:** `docs/DONE.md` gate (tsc clean, build pass, all pages 200), regression pass on
  search / maps / import / ads, `db:backup`, redeploy to DigitalOcean. Nothing live without founder
  approval.
- **Depends on:** everything above.

---

---

## Phase 20 — 3-Path Architecture (CURRENT WORK, 2026-06-28)

**Goal:** Replace the fragmented URL structure with exactly 3 clean user-entry paths. Every path ends at the same clinic listing layout. Old treatment URLs stay dead (404).

**Depends on:** All previous phases.

**Sub-tasks (in order):**

### 20A — Shared clinic listing component
Build one reusable `ClinicDirectoryListing` server component that accepts:
- `clinics[]` (pre-fetched, pre-filtered)
- `totalCount: number`
- `page: number`
- `sidebarFilter: 'both' | 'brands-only' | 'services-only'`
- `heading: string`
- `breadcrumbs: BreadcrumbItem[]`

This component renders: heading, breadcrumb, sidebar filter, clinic card grid, pagination. Used by all 3 paths.

### 20B — Find path pages
- `/states` — US map (DONE). Entry point.
- `/[state]` (`state-hub`) — Rewrite to full clinic directory. Pagination. City dropdown with clinic counts. Left sidebar: Brand + Service filter.
- `/[state]/[city]` (`city-hub`) — Same. City scoped.

### 20C — Services path pages (currently 404)
- `/services` (`services-index`) — Services index page (list all services with clinic counts).
- `/services/[svc]` (`service-pillar`) — All clinics for this service. State+city selector. Left filter: Brands offered.
- `/services/[svc]/[state]` (`service-state`) — State-scoped. City dropdown. Left filter: Brands offered.
- `/services/[svc]/[state]/[city]` (`service-city-directory`) — Paginated. Left filter: Brands offered.

### 20D — Brand path pages (rewrite existing, add drill-down)
- `/brands` — Already works. Keep as-is.
- `/brands/[brand]` — Rewrite to match `/[state]` layout: clinic cards grid, state+city selector, left filter: Services offered. Remove current text-list layout.
- `/brands/[brand]/[state]` — New page. City dropdown. Left filter: Services offered.
- `/brands/[brand]/[state]/[city]` — New page. Paginated. Left filter: Services offered.

### 20E — Header update
Update `HeaderConfig` + `CardNavClient` to reflect 3-path nav:
- FIND section → links to `/states` + top states
- SERVICES section → links to `/services` + all service slugs
- BRANDS section → links to `/brands` + all brand slugs
- Remove any old treatment (`/botox`) links from nav

### 20F — Dead code cleanup
Delete or gut these files/components (confirm each before deleting):
- `CityListingTabs.tsx` — old treatment-tab component
- `DirectoryClinicsView.tsx` — old tab body
- `DirectoryClinicCard.tsx` — replace with new shared card
- Any component referencing `/botox/...` style URLs in nav/links
- Route-resolver: remove old `treatment-*` route types if still present
- Old `TreatmentPillarPage`, `TreatmentStatePage`, `CityDirectoryPage` if they reference dead treatment paths

**Done when:** tsc clean, build green, all 6 new/rewritten pages return 200, clinic listings show with correct pre-filter on all 3 paths, sidebar shows correct filter per path.

---

## Status

| Phase | Status |
|---|---|
| 0. Foundation & docs | DONE (docs, .env.example, settings.json, db:backup/restore, deploy-check, quick fixes) |
| 1. Data model lock | DONE (Brands collection, clinic->brand, provider additionalClinics, Locations isLive/noindex, subscription fields, user saved lists, SSL localhost fix) |
| 2. Clinics in directory | DONE (Providers/Clinics tab on city pages, DirectoryClinicsView + DirectoryClinicCard, treatment-relevant clinics, clinic ItemList schema; no schema change) |
| 3. Markets control | DONE (lib/markets.ts SSOT, admin sidebar toggles, Browse-by-State coming-soon, ComingSoonMarket + WaitlistSignup stub, noindex meta, live-only sitemap, set:live script — CA/TX/NY/FL live) |
| Hardening pass | DONE 2026-06-09 (revalidation hooks, cookie-auth fix, relationship-ID fix, security lock-down, truthful copy, providerCount recompute, SearchAction removal — see DECISIONS) |
| 4. Combined CSV import | DONE 2026-06-10 (photos/qa importers, combined record_type CSV + dry-run, importBatch field, auto-create missing metros [fixes "9 invisible clinics"], new detectors: invalid zip/coords/phone + duplicate NPI + possible_branch, scoped wipe tools [CLI + admin] with typed-confirm + auto-backup, backup/re-scan admin buttons, db-push.ts ESM no-op fix). See DECISIONS 2026-06-10. |
| 5. Search & maps (production-grade) | DONE 2026-06-10 (raw-SQL tsvector GIN + PostGIS GIST indexes [setup:search], SQL server search + /api/search, Nominatim geocoding, unified merit+distance ranking [clinic-merit + ranking], Hero clinics toggle, leaflet.markercluster). See DECISIONS 2026-06-10. |
| 6. Branches / brand | DONE 2026-06-10 (brand hubs `/brands` + `/brands/[slug]`, clinic↔brand links, provider multi-clinic, admin branch-confirm tool, owner locations dashboard, seed-brands; no schema change). See DECISIONS 2026-06-10. |
| 7. Media on object storage | DONE 2026-06-10 (Cloudflare R2 via @payloadcms/storage-s3, lib/storage.ts, r2.dev public URL, dev local-disk fallback, next.config R2 host + CSP; DO Spaces swap = env-only; no schema change. VERIFIED LIVE: real upload -> pub-...r2.dev URL serves 200 from public internet). See DECISIONS 2026-06-10. |
| 8. Patient accounts + profile | DONE 2026-06-12 (patient login, /profile, saved providers/clinics, forgot-password real reset, Header client-side me-fetch for static-generation compat, lite Subscribers collection, SEO gate noindex for patients). See DECISIONS 2026-06-12. |
| 9. Pricing tiers + entitlements | DONE 2026-06-12 (lib/entitlements.ts, /pricing page, profileViewCount + /api/providers/view + ProfileViewTracker, TierBanner in dashboard, DashboardForm social links gated, photo upload gated, provider profile before-after/social/website gated by tier). See DECISIONS 2026-06-12. |
| 10. Newsletter | DONE 2026-06-12 (Subscribers collection extended with full double opt-in schema; lib/newsletter-email.ts; /api/newsletter/subscribe + confirm + unsubscribe; /api/admin/newsletter/broadcast; /newsletter/confirmed + /newsletter/unsubscribed pages; NewsletterSignup component; WaitlistSignup wired to real API; Footer + guide pages wired; DashboardNewsletterPanel in admin; scripts/notify-go-live.ts; CAN-SPAM: unsubscribe link + physical address in every email + consent log; notify:golive npm script). See DECISIONS 2026-06-12. |
| 11. News + RSS | DONE 2026-06-13 (News Payload collection, /news index + /news/[slug] detail, /news/rss.xml RSS 2.0 feed, homepage LatestNews strip, admin DashboardNewsSendPanel + /api/admin/newsletter/send-news, NewsArticle + BreadcrumbList JSON-LD, sitemap updated, 3 sample articles seeded; direct SQL migration scripts/migrate-news-phase11.sql; tsc clean, build 1057 pages green, all routes 200). See DECISIONS 2026-06-13. |
| Phase 12 pre-launch hardening | DONE 2026-06-13 (15 fixes: shared RateLimiter + memory-leak fix, CSRF origin checks on write routes, /api/search limit cap, Reviews verified default→false, backupDatabase async + R2 upload, Mapbox geocoding adapter, Infinity→999 in entitlements, responseRate warning, SearchAction JSON-LD restored, hero direct clinic query, OnboardingChecklist in dashboard, scratch/ cleaned, .env.example updated with MAPBOX_TOKEN+REDIS_URL+SENTRY_DSN, @aws-sdk/client-s3 direct dep. tsc clean). See DECISIONS 2026-06-13. |
| 12. Deploy + go live | DONE — LIVE on DigitalOcean (deployed 2026-06-17). See `docs/DEPLOYMENT-DIGITALOCEAN.md` for live notes + temporary hacks to remove. |
| 13. Search omnibox (type anything) | DONE 2026-06-17. Server intent parser (treatment/location/ZIP/name), weighted tsvectors + clinic address, isolated `search.provider_doc` for treatments/specialties/languages (no public-schema column, kept fresh by hook + setup:search), ts_rank in ranking, ZIP + place-name geocode, /api/search/suggest autocomplete, Top results (guides/news/treatments/brands) on /search. Hero REVISED to TWO fields (what + where) + IP-geo prefill via NEW /api/geo/ip; HeaderSearchBar + mobile overlay call the API. No schema change; tsc + build green; pages 200. See DECISIONS 2026-06-17 (incl. the two-field revision). |
| 14. ZIP codes + paid ZIP featuring | Planned 2026-06-17. ZipCodes centroid dataset, ZIP search via ST_DWithin, Promotions zip/treatment+zip scope + radius, geo-aware promo resolution, admin Featured ZIPs. Schema change (db:backup first). See DECISIONS 2026-06-17. |
| 15. Content bulk upload + gradual indexing | Planned 2026-06-17. News/Guides indexState+nofollow+reviewStatus, hybrid body (Lexical + faq/sources/atAGlance), JSON importer + review + drip indexing, sitemap/robots gated. Schema change (db:backup first). Migrate existing published → indexed. See DECISIONS 2026-06-17. |
| 16. Mapbox GL migration | Planned 2026-06-17. react-map-gl + mapbox-gl, native clustering, dark style, CSP + token, GEOCODER=mapbox. Display only, no data risk. See DECISIONS 2026-06-17. |
| 17. Google AdSense (fallback fill) | Planned 2026-06-17. lib/adsense.ts resolver (fills only where no own paid inventory), per-page adsenseMode + global override, ads.txt + privacy update + CSP + consent banner. See DECISIONS 2026-06-17. |
| 18. Admin UI/UX polish | Planned 2026-06-17. Operator surfaces for ZIP featuring, content review/drip, AdSense control. Presentational. See DECISIONS 2026-06-17. |
| 19. Final testing + fixes + redeploy | Planned 2026-06-17. DONE gate + regression pass + db:backup + redeploy to DO. See DECISIONS 2026-06-17. |
| Admin: BulkReviewPanel v2 | DONE 2026-06-23. 7 features added to `components/admin/BulkReviewPanel.tsx`. DashboardWidget Review Moderation section removed (duplicate). No schema change, no API change, no new files. tsc clean. Browser-tested. See below. |
| Revamp Phase A: URL foundation | DONE 2026-06-23. 3-level URL hierarchy live: `/[treatment]/[state]/[city]`, `/[state]/[city]`, `/injectors/[state]/[city]/[slug]`. City slugs migrated (state suffix stripped). Route-resolver updated. tsc clean, build passes. Old city-suffix URLs 404 as expected. See `docs/revamp.md` Parts 1–3. |
| Revamp Phase 2: Page redesigns | DONE 2026-06-24. 12 files. CityHubPage full rewrite (navy hero, treatment chip nav, load-more, top clinics, neighborhood chips). StateHubPage treatment filter + useMemo + city link fix. NeighborhoodHubPage tabs + treatment filter. DirectoryClinicCard redesign. IpStateHint (new). TopClinics on homepage. CostEstimator removed from CityDirectoryPage. Treatment-state + neighborhood/sidebar link fixes. Header/Footer lifted to page.tsx wrapper for 3 route types (server/client boundary fix). No schema change. tsc clean. See DECISIONS 2026-06-24. |
| finalfixes Batch 0: Audit verify | DONE 2026-06-25. Read-only investigation. Local DB confirmed: 3,695 clinics (all draft/review, 0 published), 0 providers, 48,113 reviews, 677 locations, 41,488 zip_codes, 76 news, 31 guides. Bad data found: 843 ALL CAPS cities, 54 street-address names, 4 ZIP-only fake metros (isLive=true), 587 old city slug suffixes, 33 double-city slugs. Seed providers already gone. /illinois = 200 locally (coming-soon), 504 on prod = connection pool cold-start. Prod DB creds: DO App Platform secrets only (not in any local file). See DECISIONS 2026-06-25. |
| finalfixes Batch 1: Data fix scripts | DONE 2026-06-25. 6 scripts written + applied locally. No schema change. Results: ALL CAPS cities 843→1 (military APO edge case), ALL CAPS clinic names 536→6, street-address clinics all now status=review (54 total, 15 newly hidden), ZIP fake locations 4→0 (deleted), city slug suffixes 587→17 (14 same-name collisions kept, 2 neighborhood collisions, 1 washington-dc intentional). `npm run fix:*` shortcuts added to package.json. See DECISIONS 2026-06-25. |
| 3-Path Architecture decision | DONE 2026-06-28. Locked 3 entry paths: FIND (/[state]/[city]), SERVICES (/services/[svc]/[state]/[city]), BRAND (/brands/[brand]/[state]/[city]). Old /botox/* URLs dead 404. Sidebar filter rule: only the complementary filter shown (not the one already in URL). All paths use same clinic card grid layout. See DECISIONS 2026-06-28. |
| Schema cleanup: Phase 1 (DashboardWidget) | DONE 2026-06-28. DashboardWidget pruned from 1924→733 lines. Removed: Data Import panel, Content Review panel, AdminDataFixPanel, BulkReviewPanel from beforeDashboard. 7 API route dirs deleted (bulk-review, content-approve, content-import, data-fix, drip-index, import, review-moderate). |
| Schema cleanup: Phase 2 (Reviews removed) | DONE 2026-06-29. Reviews collection removed from payload.config.ts. 8 files cleaned: clinic-queries.ts, ClinicReviews.tsx (deleted), clinics/[slug]/page.tsx, TrustBar.tsx, worth-it.ts, provider-queries.ts, HowWeVerify.tsx, import-data.ts, seed.ts. ISR crash bug fixed (providers query removed from getClinicBySlug). Pre-push SQL guard added. |
| Schema cleanup: Phase 3 (Media group) | NOT STARTED. Collections to remove: Media, Photos, BeforeAfterCases, VideoTestimonials, SocialPosts. See project-schema-cleanup-plan.md for file dependency map. |
| Schema cleanup: Phase 4 (MedicalReviewers) | NOT STARTED. Remove MedicalReviewers collection + field from Guides/News + frontend bylines. |
| Schema cleanup: Phase 6 (googleBusinessProfileId) | NOT STARTED. Add googleBusinessProfileId text field to Clinics collection. |
| Schema cleanup: Phase 7 (Authors default) | NOT STARTED. Guide/news pages fall back to "injector.world Editorial Team" when author is null. |
| Phase 20: 3-Path Architecture (20A-20F) | PLANNED. Sub-tasks: 20A shared ClinicDirectoryListing component, 20B Find path rewrites, 20C Services path pages (all 404 now), 20D Brand drill-down pages, 20E Header nav update, 20F dead code cleanup. |

---

### Revamp Phase A — URL foundation — DONE (2026-06-23)

Full spec in `docs/revamp.md` Parts 1–3. No schema change.

- 3-level URL hierarchy wired in route-resolver: `/[treatment]/[state]/[city]`, `/[state]/[city]`,
  `/[state]/[city]/[neighborhood]`, `/injectors/[state]/[city]/[slug]`, `/clinics/[state]/[city]/[slug]`.
- City slug migration: state suffix stripped from all city slugs (`houston-tx` → `houston`,
  `new-york-ny` → `new-york-city`, etc.). Migration script idempotent and safe to re-run.
- Old URLs (with suffix) now 404 as expected.
- tsc clean, build passes.

---

### Revamp Phase 2 — Page redesigns — DONE (2026-06-24)

Full spec in `docs/revamp.md` Parts 4–6. No schema change. No db:push. tsc clean, build passes.
12 files changed. See DECISIONS 2026-06-24 for architecture note + full per-file breakdown.

**New component:**
- `components/shared/IpStateHint.tsx` — detects user's state via `/api/geo/ip`, shows a hint bar
  on treatment pillar pages linking them to their local state hub. Safe for SSR (returns null until
  useEffect fires; no hydration mismatch).

**Page rewrites:**
- `CityHubPage.tsx` — full rewrite. Navy hero + breadcrumb, treatment chip navigation (3-level links),
  injector list with load-more (12 + 6), top clinics (up to 6), neighborhood chips.
- `StateHubPage.tsx` — treatment filter with `useMemo`. Filtering providers, clinics, and sponsored
  all in-place from prop data (no re-fetch). City links fixed to `/${state.slug}/${city.slug}`.
- `NeighborhoodHubPage.tsx` — Injectors/Clinics tab + treatment filter. Both panels SSR-rendered
  (hidden class toggle) so anchor links appear in HTML.
- `DirectoryClinicCard.tsx` — redesigned. Cleaner body, 160px photo, treatment chips with overflow
  count, footer row with provider count + starting price + view link.

**Fixes:**
- `TreatmentPillarPage.tsx` — IpStateHint added above the state/city picker.
- `TreatmentStatePage.tsx` — city links now 3-level: `/${treatment.slug}/${state.slug}/${city.slug}`.
- `CityDirectoryPage.tsx` — CostEstimator removed. Neighborhood/sidebar/fallback links all fixed
  to 3-level format.
- `lib/location-queries.ts` — `treatments` added to `NeighborhoodHubData`.
- `lib/home-queries.ts` — `topClinics` added (6 published clinics by rating count).
- `app/(frontend)/page.tsx` — "Top Aesthetic Clinics" section added to homepage.
- `app/(frontend)/[...path]/page.tsx` — Header/Footer/PromoBanner and coming-soon checks lifted
  here for state-hub, city-hub, and neighborhood-hub (server/client import boundary fix).

---

### Admin: BulkReviewPanel v2 — DONE (2026-06-23)

**Files changed:** `components/admin/BulkReviewPanel.tsx`, `components/admin/DashboardWidget.tsx`
**No schema change. No API change. No new files. tsc clean.**

**7 features shipped:**

1. **Sticky first 2 columns** — Checkbox (`left:0`) and Status (`left:36px`) columns are `position:sticky` so they stay visible on horizontal scroll. Both get `zIndex:1`; header row gets `zIndex:3`.

2. **Column show/hide toggle** — "Columns" button in filter bar opens a dropdown listing every column with a checkbox. Unchecking a column hides it from the table. State persisted to `localStorage` under key `brp_hidden_cols_{type}` so settings survive entity-tab switches.

3. **Quick-filter chips** — Row of 4 chips below the filter bar (Clinics + Providers only, not Reviews): "Review queue" (status=review), "Missing bio", "Missing treatments", "Missing Instagram". Active chip = mint `#3FA68A` background. Clicking a chip sets the corresponding filter state and re-fetches.

4. **Completeness bar** — Missing column now shows the count badge AND a 4px green progress bar below it. Bar fill = `(totalFields - missing) / totalFields * 100%`. Field totals: clinics=16, providers=13, reviews=7. Hover on badge or bar = tooltip with missing field names.

5. **Row expand drawer** — `›` icon at the start of each row opens a 420px fixed drawer from the right (`zIndex:100`). Drawer shows all editable fields as a form; fields missing from the record have amber (`#FFFBEB`) background + "missing" label. "Save all changes" PATCHes only changed fields one by one via existing `/api/admin/bulk-review/update`. Clicking the overlay or `×` closes the drawer.

6. **Bulk field edit** — When rows are selected (bulk bar visible), an "Edit field on all selected" button appears. Clicking opens an inline dark form: field selector + value input + "Apply to X records" button. Sends PATCH requests in batches of 5 concurrent (`Promise.all`) and shows live progress "Updating 3/10…".

7. **Card-by-card review mode** — "Review Mode" button in the header (disabled when no records). Switches the table to a full-width card showing one record at a time: all fields in a grid, missing fields amber-highlighted, status select at the top. Navigation: "← Prev" / "Next →" buttons + "X of Y" counter. Keyboard: `ArrowLeft`/`ArrowRight` = navigate, `P` = publish/approve, `R` = reject/draft, `Esc` = exit. Keyboard listener registered only when review mode is active.

**DashboardWidget cleanup:**
- Removed `pendingReviews` state + `loadPendingReviews()` function + its `useEffect` call.
- Removed "X imported reviews need moderation" from the "Needs you now" priority list.
- Removed the entire "Review Moderation" collapsible Section (was a duplicate of the Reviews tab inside BulkReviewPanel).
- `allClear` condition simplified (no longer checks `pendingReviews`).

**Browser-verified (2026-06-23):**
- Sticky columns confirmed (`left:0px`, `left:36px`, both `position:sticky`).
- Columns dropdown opens (111 checkboxes = 100 table + 11 menu). Instagram column hide/show works.
- All 4 quick-filter chips present.
- 99 completeness bars rendered (1 per row).
- 99 expand icons. Drawer opens with correct record name + missing fields labeled.
- Review Mode: table gone, "1 of 99" counter, Prev disabled at index 0, Next enabled, keyboard hint visible.
- "Review Moderation" section absent from DashboardWidget.


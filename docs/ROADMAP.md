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

### Phase 14 — ZIP codes + paid ZIP featuring
- **Goal:** users search by ZIP (and nearby ZIPs); a provider can PAY to be featured on a ZIP + a
  radius of nearby ZIPs; admin controls the inventory.
- **Scope:** new `ZipCodes` collection seeded from a free Census / GeoNames centroid CSV
  (`seed:zips` + SQL migration). ZIP search = centroid lookup → reuse the existing PostGIS
  `ST_DWithin` radius path. `Promotions` gains a `zip` (and `treatment+zip`) `scopeType` plus
  `zipScope` + `zipRadiusMiles`. Geo-aware promo resolution in `searchDirectory` (a sibling of
  `getOrganicPins` that matches active ZIP promos whose centre is within radius of the searched
  point). Extend the per-placement slot-guard for radius overlap. Admin "Featured ZIPs" management
  panel. Provider dashboard request flow (v1: provider requests ZIP(s) + radius, admin creates the
  Promotion manually — matches the "manual billing v1" tier decision; Stripe later). Pricing per ZIP
  is a founder decision (open).
- **Locked:** bundled centroid dataset (not on-the-fly geocoding). `db:backup` first.
- **Depends on:** Phase 13.

### Phase 15 — Content bulk upload + review + gradual indexing
- **Goal:** upload AI-generated JSON of guides / articles / news; review; publish noindex+nofollow by
  default; index gradually so a mass publish does not get penalised.
- **Scope:** add to News + Guides: `indexState` (`noindex` default → `indexed`), `nofollow` (default
  true), `reviewStatus` (`imported` → `in-review` → `approved`), `importBatch`, `approvedAt`/`approvedBy`.
  Hybrid body: keep the Lexical `body` for intro + sections, add structured `answerSnippet`,
  `atAGlance[]`, `faq[]`, `sources[]` (matches `injector_world_news_bulk_upload_template.json`). New
  JSON importer `lib/import/content-import.ts` + `/api/admin/content-import` (admin/editor, dry-run,
  validates against the template `validationRules`, resolves relations, upserts by slug, defaults to
  draft + noindex, raises DataAlerts for issues). Admin review list (drafts / in-review) with a bulk
  "Approve selected" (approve = published + still noindex). Sitemap + `getAll*Slugs` return ONLY
  `indexState=indexed`; news/guides `generateMetadata` emit noindex,nofollow until indexed (mirror
  `lib/markets.ts` `NOINDEX_ROBOTS`). Drip control (admin button / script: index next N approved/day).
- **CRITICAL guard:** migrate existing already-published news/guides to `indexState=indexed` so the
  noindex-by-default switch does NOT drop currently-indexed pages out of Google.
- **Locked:** hybrid body. `db:backup` first.
- **Depends on:** Phase 11 (News) + Guides.

### Phase 16 — Mapbox GL migration
- **Goal:** replace Leaflet + CARTO with Mapbox GL across all three maps.
- **Scope:** rewrite `DirectoryMap`, `ListingMapInner`, `HeroMap` with `react-map-gl` + `mapbox-gl`;
  native GL clustering replaces `ClusterLayer` (drop `leaflet.markercluster`); `NEXT_PUBLIC_MAPBOX_TOKEN`;
  CSP additions in `next.config.mjs` (`api.mapbox.com`, `events.mapbox.com`, `worker-src blob:`);
  swap leaflet CSS for mapbox-gl CSS in `globals.css`; wire a dark map style to `next-themes` (CARTO
  voyager is light-only today, so this is an upgrade); flip `GEOCODER=mapbox` so map + geocoding share
  one provider.
- **Risk:** display only, no data risk. Note: Mapbox bills per map load (watch the free tier).
- **Locked:** Mapbox GL (not MapLibre, not Leaflet+Mapbox-tiles).
- **Depends on:** nothing hard; best after 13/14 so the map reflects the new search.

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

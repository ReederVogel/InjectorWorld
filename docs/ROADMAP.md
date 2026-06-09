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

### Phase 6 — Branches / brand experience
- **Goal:** the "dhamakedar" multi-location layer.
- **Scope:** brand hub pages (all locations + all providers under a brand). Auto-suggest likely
  branches via DataAlerts (same name/phone/website) with human confirm, never silent merge.
  Claim-based branch linking ("select your other locations from the list"). Brand-owner dashboard
  to manage multiple locations.
- **Depends on:** Phases 1, 4.

### Phase 7 — Media on DO Spaces
- **Goal:** uploads persist (currently URL-only).
- **Scope:** `@payloadcms/storage-s3` pointed at DO Spaces + CDN. Real photos.
- **Depends on:** Phase 4 (records exist to attach media to).

### Phase 8 — Patient accounts + profile
- **Goal:** patients save providers.
- **Scope:** patient login, `/profile`, saved providers/favorites. Fix the `/forgot-password`
  stub into a real reset flow. **From audit:** wire `Header.tsx` to show the logged-in state
  (currently hard-stubbed to `user={null}`) via a client-side `/api/users/me` fetch so it does
  not force pages out of static generation.
- **Depends on:** Phase 1.
- **Optional early-launch checkpoint:** after this phase the core directory is launch-capable.
  Founder may choose to go live with 4 states here instead of waiting for Phases 9-11.

### Phase 9 — Pricing tiers + entitlements
- **Goal:** Free + 3 paid tiers, feature-gated.
- **Scope:** `lib/entitlements.ts` (tier -> feature flags, like `lib/merit.ts`). `/pricing` page.
  Dashboard upgrade flow. Gate photos/social/before-after/analytics/featured by tier. Manual
  billing v1 (admin sets tier); Stripe self-serve later. Verification + organic ranking stay
  free and unbuyable.
- **Depends on:** Phases 1, 8.

### Phase 10 — Newsletter
- **Goal:** build the email list.
- **Scope:** `Subscribers` collection, double opt-in, Resend send, CAN-SPAM (unsubscribe +
  physical address), consent log. No PHI. **From audit:** the coming-soon `WaitlistSignup` is a
  visual-only stub today — its real email capture lands here (wire it to `Subscribers`).
- **Depends on:** Phase 0.

### Phase 11 — News page + RSS
- **Goal:** broadcast (new treatment, treatment updates).
- **Scope:** `News` collection (separate from Guides). `/news` + `/news/[slug]`. `NewsArticle`
  schema, `/news/rss.xml` feed. Homepage "Latest News" strip. Feeds the newsletter.
- **Depends on:** Phase 0.

### Phase 12 — Deploy lock + hardening + GO LIVE
- **Goal:** 4 states public.
- **Scope:** lock deployment target (Railway vs DO), standalone build, CSP test (admin + Leaflet
  + fonts), Sentry, performance, final SEO pass, sitemap = live markets only. Swap fake data for
  real data (db:backup first). Go live. **From audit:** move rate-limiting from the in-memory `Map`
  (resets per deploy, not shared across instances) to DO Managed Redis before scaling to >1 instance.
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
| 4. Combined CSV import | Not started. Fake faulty 4-state data imported locally (99 clinics / 218 providers / 2800 reviews). TODO: photos.csv + qa.csv importers, missing metros, single combined CSV, dry-run |
| 5. Search & maps (production-grade) | Not started (NEW — server search API, PostGIS radius, geocoding, unified provider+clinic ranking, marker clustering, Hero search clinics) |
| 6. Branches / brand | Not started |
| 7. Media on DO Spaces | Not started |
| 8. Patient profile | Not started |
| 9. Pricing tiers | Not started |
| 10. Newsletter | Not started |
| 11. News + RSS | Not started |
| 12. Deploy + go live | Not started |

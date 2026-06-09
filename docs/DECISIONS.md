# injector.world — Decision Log (append-only)

Every locked decision lives here with a date and a reason. Read this before building
anything. Never silently contradict an entry. To change a decision, add a NEW dated entry
that supersedes the old one (do not delete history).

---

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

# injector.world — Final Fixes Plan (LOCKED)

**Created:** 2026-06-24
**Owner:** rkumar0101
**Live audit URL:** https://starfish-app-btujd.ondigitalocean.app/
**Method:** Read every `docs/*.md`, browsed 15+ live pages, extracted every homepage link, code review of routes/schemas/queries/middleware/sitemap, verified all founder decisions.

> This is the canonical pre-launch fix list. Every problem here is verified against the live site or codebase. Every decision is locked in this session via founder Q&A. Execution happens in numbered batches; each batch = one focused chat.

---

## SECTION 0 — LOCKED DECISIONS (from this session)

### URL Architecture

**Services Path (SEO, indexed):**
```
/services                                              All services flat alphabetical list
/services/[service]                                    Service pillar (e.g. /services/botox)
/services/[service]/[state]                            Service × State (e.g. /services/botox/texas)
/services/[service]/[state]/[city]                     Money page (e.g. /services/botox/texas/houston)
```

**Find Path (UX, indexed for live markets):**
```
/[state]                                               State hub
/[state]/[city]                                        City hub
```

**Neighborhoods:** No standalone neighborhood URLs/pages. Neighborhood is a filter on city listing pages only. New clinic/provider neighborhood data links automatically through state + city data after admin review.

**Profiles:**
```
/injectors/[state]/[city]/[slug]                       Provider profile
/clinics/[state]/[city]/[slug]                         Clinic profile
```

**Body Area Pages (educational, kept):**
```
/treatments/[area]                                     forehead, lips, jawline, etc.
```

**County:** Not in URL. Shown as info on clinic page ("Located in Harris County").

**Country:** Not in URL. `country='US'` is default field on clinic.

**Old URLs (`/botox`, `/botox/texas`, `/[treatment]/[state]/[city]`):** DELETE entirely. No redirects. Site isn't live to real users yet. Clean break. Codebase clean.

### Navigation

- "Treatments" label → renamed to **"Services"** in header, footer, all UI copy
- Services dropdown = **flat alphabetical list** (no Toxins/Fillers/Body-Area sub-grouping)
- `/services` page = same alphabetical list, full grid
- Auto IP-state detection on `/services/[service]` → prompts user to confirm/switch state → drilldown

### Data Strategy

- **All data fixes happen in code/scripts** — not by client manually re-uploading CSV
- ZIP-based auto-backfill from `zip_codes` table (41,490 rows already seeded)
- Bad clinic names (street-address) marked `status='review'`, hidden from public
- Seed providers (Dr. Lena Park etc.) **completely deleted** — DB + `scripts/seed.ts`
- Old city slugs migrated on production DB

### Filters on Every Listing Page

- Distance radius (5 / 10 / 25 / 50 mi) — PostGIS ST_DWithin
- Rating filter (4+ stars only)
- Virtual consult available toggle
- Price range slider (min-max)
- Languages spoken (multi-select)
- Service type (medspa / dermatology / plastic-surgery / dental-aesthetics)
- Loyalty programs (Allē / Aspire / Xperience)
- Neighborhood filter on city pages only, derived from clinic/provider data
- Mobile: collapsible bottom-sheet
- Map: Mapbox GL with clustering (already exists), lazy-mount

### Booking Flow

- Patient on provider/clinic page → "Book consult" → small modal form
- Fields: Name, Email, Phone (optional), Treatment, Preferred date, Message
- Submit → POST `/api/bookings` → saves to Bookings collection → 2 emails:
  - Clinic email (from `clinics.email`, fallback to provider's email)
  - Admin email (`ADMIN_EMAIL` env)
- **NO external redirect** even if `clinic.bookingUrl` set
- Turnstile + honeypot for spam protection

### Forms

- `/contact` — proper form (name, email, subject dropdown, message) + Turnstile + routes by subject
- `/list-your-practice` — proper form (clinic name, practitioner name, email, phone, NPI, state license, message) + Turnstile + DataAlert + admin email
- `/pricing` "Request Pro/Elite" — replaced with "Request demo" form (name, email, clinic name, tier interest)

### Deploy Strategy

Batch ALL fixes locally → test thoroughly → ONE big deploy. No piecemeal partial state on production.

---

## SECTION 1 — LIVE SITE PROBLEMS (verified 2026-06-24)

### 🔴 CRITICAL — Production has broken nav links

Production header + footer have OLD city slug format. P1-2 fix is local-only, not deployed.

| Link Text | Current Wrong URL | Should Be |
|---|---|---|
| Header → Houston | `/botox/texas/houston-tx` | `/services/botox/texas/houston` |
| Header → Dallas | `/botox/texas/dallas-tx` | `/services/botox/texas/dallas` |
| Header → Los Angeles | `/botox/california/los-angeles-ca` | `/services/botox/california/los-angeles` |
| Header → New York City | `/botox/new-york/new-york-ny` | `/services/botox/new-york/new-york-city` |
| Footer → all 6 cities | same broken pattern | same fix |
| Pre-footer CTA | `/botox/new-york-ny` (2-segment, 404!) | `/services/botox/new-york/new-york-city` |

### 🔴 CRITICAL — Production data garbage

| Problem | Evidence | Fix Source |
|---|---|---|
| Seed providers on homepage | Dr. Lena Park, Dr. Daniel Cho, Dr. Marcus Hill in Top Picks | Batch 1 + 13 |
| Street-address clinic names | "3103 Clearview Cir", "4531 Sundance Cir", "3411 Yoakum Blvd #3007", "10 Westville Ave", "215 S La Cienega Blvd" | Batch 1 + 13 |
| ALL CAPS cities | HOUSTON, CALDWELL, HOFFMAN ESTATES, BEVERLY HILLS, BROOKLYN, COOPER CITY | Batch 1 + 13 |
| Old city slugs in DB | URLs like `houston-tx`, `dallas-tx`, `hoboken-nj` in clinic + provider profiles | Batch 13 |
| ZIP-only "metro" Locations | "CA 90004", "CA 90005", "CA 90006", "CA 90010" in Locations panel | Batch 1 (SQL delete) |
| TrustBar "0+" placeholders | "0+ Markets Covered", "0+ Treatment Guides", "0 Medical Reviewers", "0 yrs Years Independent" | Batch 10 |
| Footer brandmark x3 | "INJECTORS.WORLD" repeated three times | Batch 10 |

### 🔴 CRITICAL — Broken pages

| URL | Problem | Fix |
|---|---|---|
| `/illinois` | HTTP 504 Gateway Timeout | Investigate query in Batch 0 |
| `/news` | Empty — "No articles in this category yet" | Import JSON files in Batch 12 |
| `/contact` | No form, just 5 email addresses | Build form in Batch 7 |
| `/list-your-practice` | No signup form, just `[email protected]` | Build form in Batch 7 |
| `/pricing` | Broken mailto buttons `[email protected]` | Replace with form in Batch 7 |
| Clinic profile page | Almost empty — only name + address | Rebuild in Batch 5 |
| `/texas/houston`, `/botox/texas/houston` | 404 on production (during initial audit) | Likely state slug mismatch — verify in Batch 0 |

### 🟠 HIGH — Slug bugs

| Bug | Evidence | Root Cause | Fix |
|---|---|---|---|
| Double city in slug | `vertical-health-dallas-dallas` | `lib/import/import-data.ts:448` — kebab(clinicName) + city already in slug | Batch 2 — strip duplicate suffix |
| State suffix on city slug | `houston-tx`, `dallas-tx`, `hoboken-nj` | Revamp Phase A migration not run on production | Batch 13 — re-run migration |
| Sitemap mixed patterns | `/new-jersey/hoboken-nj/` + `/nj/` | Migration partial | Batch 2 — regenerate sitemap |

### 🟠 HIGH — Missing dashboard controls

User explicitly requested these from admin dashboard (currently missing):
- Markets toggle: isLive / noindex per state/city inline (not in Locations panel)
- ZIP-based data fix button: one-click backfill from zip_codes
- Bulk delete by criteria: delete all clinics where status=draft AND name starts with digit
- Clinic/provider status inline edit (Payload native works but needs prominence)

### 🟠 HIGH — Forms missing/broken (booking flow)

Founder spec: every booking comes to OUR backend first, NOT redirected to clinic.
- Current: provider profile booking form exists but logic may redirect to clinic website if bookingUrl set
- Current: clinic profile has NO booking form at all
- Fix: Batch 6 — unified booking modal, no external redirect, 2 emails (clinic + admin)

### 🟡 MEDIUM — Page polish

- DirectoryClinicCard renders empty for clinics without photos/rating/treatments — need graceful fallbacks
- TrustBar uses orange/mint/blue/purple — violates brand rule (mint only)
- BodyAreas loads light+dark images both (18 images, half hidden)
- Mapbox eagerly mounts on every page (200KB + telemetry per pageview)
- Homepage 19,482px, all sections hydrate immediately
- Header search icon overlaps wordmark at 375px
- Touch targets 34-36px (must be 44px+)
- `framer-motion` and `gsap` — one component each (~100KB overhead)

### 🟡 MEDIUM — News + Guides

- Guides: 13 published, working ✅
- News: 0 articles on production, local data exists in `data/news-january-2026.json` + Feb-June files + 4 guide batches
- Fix: Batch 12 — run import on production

### 🔒 SECURITY — Tracked

From `docs/AUDIT-FIX.md` + `docs/FULL-AUDIT-2026-06-19.md`:

| ID | Issue | Severity | Batch |
|---|---|---|---|
| SEC1 | License badge shows "Verified" on expired licenses | HIGH | 9 |
| SEC2 | Signup form: no CSRF, no CAPTCHA, fakeable IP | MEDIUM | 9 |
| SEC3 | 8 write endpoints missing CSRF (account/profile, auth/signup, providers/view, admin/scan, admin/branches, admin/backup, admin/newsletter/send-news, dashboard/zip-feature-request) | MEDIUM | 9 |
| SEC4 | Public API leaks pending/rejected reviews | MEDIUM | 9 |
| SEC5 | `/setup-account` link broken from claim flow | MEDIUM | 9 |
| SEC6 | IDOR on `/api/dashboard/save`, `/upload`, `/locations` (Provider A can sabotage Provider B) | CRITICAL | 9 |
| SEC7 | Email header injection in bookings — sanitize all string fields, not just firstName | MEDIUM | 6 |
| SEC8 | `ADMIN_EMAIL` env fallback leaks PII | HIGH | 9 |
| SEC9 | Mapbox token unrestricted | MEDIUM | 15 |
| SEC10 | Turnstile not on all 6 forms | MEDIUM | 6 + 7 |
| SEC11 | Honeypot fields on all forms | LOW | 6 + 7 |
| SEC12 | lat/lng SQL needs Number.isFinite assertion | LOW | 9 |
| SEC13 | Newsletter token expires never | LOW | 9 |
| SEC14 | Newsletter confirm token in URL (Referer leak) | LOW | 9 |
| SEC15 | Claims enumeration (404 vs 200) | LOW | 9 |
| SEC16 | CSV row limit (50k cap) | LOW | 9 |
| SEC17 | `overrideAccess: true` audit + document | LOW | 9 |
| SEC18 | Backup pre-signed URL leaks in response | LOW | 9 |
| SEC19 | Newsletter broadcast hard cap (500 recipients) | LOW | 9 |

---

## SECTION 2 — UNUSED CODE TO DELETE

| File / Symbol | Why | Batch |
|---|---|---|
| `scratch/` directory | junk files (hello.js, test-render.ts, view-alerts.ts) | 11 |
| `lib/city-slug.ts` | revamp.md 1.6 marked DELETE | 11 |
| `lib/promotion-queries.ts` (old) | revamp.md 2.2 — replaced by `lib/promotions.ts` | 11 |
| `components/shared/SponsoredProviderCard.tsx` | revamp.md 2.2 DELETE | 11 |
| `components/shared/AdBanner.tsx` | revamp.md 2.2 DELETE | 11 |
| `scripts/seed.ts` seed-provider blocks | Poisons production homepage with Dr. Lena Park etc. | 1 |
| `mockups/`, `design/figma-build-spec.md` | Historical, never read | 11 |
| `framer-motion` package | One component (PreFooterCta) — replace with CSS | 10 |
| `gsap` package | One component (CardNavClient) — replace with CSS | 10 |
| Any `/[treatment]/...` route file | Replaced by `/services/[treatment]/...` | 2 |
| `CostEstimator` component | Removed in revamp Phase 2; may still exist as unused file | 11 |
| Stale CLAUDE.md "Build Status" / "Execution sequence" sections | Superseded by docs/ROADMAP + this doc | 11 |

---

## SECTION 3 — EXECUTION BATCHES (run in order, one chat each)

> **Rule for every batch:** After changes — `npx tsc --noEmit` clean + `npm run build` passes + spot-check pages. No git commits until founder approves.

### BATCH 0 — Audit verify (local-only investigation)

**Goal:** Verify findings against local dev DB before touching anything.

1. Spin up local dev server. Verify:
   - `/illinois` works locally (vs 504 on prod) — does it timeout or render?
   - Local DB has same seed providers as production?
   - Local DB has same bad clinic names as production?
   - Check whether `texas` slug exists in production Locations (or is it `tx`)?
2. Document any new findings.
3. Confirm production DB connection string + admin access.

**Deliverable:** Short report (in chat) confirming what's in local vs prod DB. No code changes.

---

### BATCH 1 — Data fix scripts (write, don't run yet)

**Goal:** Build all SQL scripts needed for production cleanup.

**Files to create:**

1. `scripts/fix-clinic-locations-from-zip.mjs`
   ```sql
   -- Dry-run mode supported. Reports rows that would change.
   UPDATE clinics c
   SET 
     city = z.city,
     state = z.state,
     latitude = COALESCE(NULLIF(c.latitude, 0), z.lat),
     longitude = COALESCE(NULLIF(c.longitude, 0), z.lng)
   FROM zip_codes z
   WHERE c.zip = z.zip 
     AND (
       c.city IS NULL OR c.city = '' 
       OR c.state IS NULL OR LENGTH(c.state) != 2
       OR c.city ~ '^\d+'                  -- city is numeric (e.g. "90004")
       OR c.city = UPPER(c.city)            -- ALL CAPS detected
     );
   ```

2. `scripts/cleanup-bad-clinic-names.mjs`
   ```sql
   -- Mark clinics with street-address names as 'review' (hidden from public)
   UPDATE clinics 
   SET status = 'review'
   WHERE status = 'published'
     AND clinic_name ~ '^\d+\s+[A-Z]';     -- starts with number + space + capital
   ```

3. `scripts/delete-seed-providers.mjs`
   ```sql
   -- Delete ALL seed providers (Dr. Lena Park, etc.) — verified seed list
   DELETE FROM providers WHERE slug IN (
     'lena-park-md-nyc', 'daniel-cho-md-nyc', 'marcus-hill-md-la',
     'rachel-goldman-md-nyc', 'aisha-bello-md-mia', 'james-whitaker-do-chi',
     'priya-shah-md-sf', 'mia-petrova-np-chi', 'sofia-reyes-np-nyc',
     'omar-haddad-md-nyc', 'elena-mosconi-md-nyc', 'hailey-brennan-rn-la',
     'lucas-almeida-pa-mia', 'jenna-wu-pa-nyc', 'maya-singh-np-nyc'
   );
   ```

4. `scripts/cleanup-zip-locations.mjs`
   ```sql
   -- Delete fake "metro" locations created from ZIP-only data
   DELETE FROM locations
   WHERE kind IN ('metro', 'city')
     AND (
       name ~ '^[A-Z]{2}\s+\d{4,5}$'        -- "CA 90004"
       OR name ~ '^\d{5}$'                  -- "90004"
     );
   ```

5. `scripts/migrate-city-slugs-production.mjs`
   - Re-run city slug migration on production DB
   - `houston-tx` → `houston`, `hoboken-nj` → `hoboken`, etc.
   - Update both `locations.slug` AND any `clinics.slug` / `providers.slug` that has city suffix

6. `scripts/audit-data-pre-deploy.mjs` (read-only)
   - Report counts: how many bad-name clinics, how many bad-city clinics, how many ZIP locations, how many seed providers
   - Run before AND after fix scripts to verify

**Deliverable:** All 6 scripts in `scripts/`, no execution yet.

---

### BATCH 2 — URL restructure to `/services/*`

**Goal:** Migrate all routes, internal links, sitemap, breadcrumbs, JSON-LD.

**Files to change:**

- `lib/route-resolver.ts` — accept `services` as first segment, route `services + treatment` to treatment-pillar, etc.
- `app/(frontend)/[...path]/page.tsx` — match new route types
- `app/sitemap.ts` — generate `/services/...` URLs only (no old paths)
- `lib/site-nav.ts` — header + footer + navCards rebuilt with new URLs
- Every page component that links to old `/[treatment]/...` paths:
  - `CityHubPage.tsx`, `StateHubPage.tsx`, `NeighborhoodHubPage.tsx`
  - `TreatmentPillarPage.tsx`, `TreatmentStatePage.tsx`, `CityDirectoryPage.tsx`
  - `Footer.tsx`, `CardNavClient.tsx`, `Hero.tsx`, `BrowseTreatments.tsx`
  - `BrowseState.tsx`, `BodyAreas.tsx`, `PreFooterCta.tsx`
  - `DirectoryProviderCard.tsx`, `DirectoryClinicCard.tsx`
- All breadcrumb JSON-LD in catch-all page
- All canonical URLs

**Validation:** `tsc` clean + build green + spot-check 15 paths including `/services`, `/services/botox`, `/services/botox/texas`, `/services/botox/texas/houston`, `/services/botox/texas/houston/montrose`.

---

### BATCH 3 — Header/Footer rebuild (Services flat list)

**Goal:** Header nav redesigned per Services-flat structure.

**Files to change:**

- `lib/site-nav.ts`:
  - Rename `megaMenus.treatments` → `megaMenus.services`
  - Replace 3-section structure (Toxins / Fillers / Body Areas) with **flat alphabetical list**: Botox, Cheek Filler, Daxxify, Dysport, Jeuveau, Jawline Filler, Kybella, Lip Filler, Masseter Botox, Microneedling, PRP, Sculptra, Tear Trough, Thread Lift, Xeomin
  - `navCards.Services` same flat structure
  - All hrefs use `/services/[slug]` format
- `components/header/CardNavClient.tsx` — render flat list
- `Footer.tsx` — `footerLinks.treatments` → `footerLinks.services`, update hrefs
- All UI text "Treatment" → "Service" where appropriate
- CLAUDE.md updated to reflect new nav structure

**Status 2026-06-25:** DONE locally.
- `lib/site-nav.ts` now uses `services` key, flat alphabetical service list, and Botox-anchored city links.
- Footer uses `footerLinks.services`.
- Header/search/footer/service copy sweep completed where "Treatment(s)" meant nav/catalog.
- `npx tsc --noEmit` clean. Build green after Batch 4 final build.

**Validation:** Click every nav link on local — all resolve to correct `/services/*` URLs.

---

### BATCH 4 — Listing page filters + Map

**Goal:** Filter sidebar/sheet on every listing page. Scalable design.

**New component:** `components/shared/ListingFilters.tsx`
- Distance radius dropdown (5 / 10 / 25 / 50 mi)
- Rating filter (All / 4.5+ / 4+ / 3.5+)
- Virtual consult toggle
- Price range slider (USD, min-max)
- Languages multi-select (from data)
- Service type multi-select (medspa / dermatology / plastic-surgery / dental-aesthetics)
- Loyalty programs multi-select (Allē / Aspire / Xperience)
- Clear all + Apply buttons

**Mobile:** Bottom-sheet pattern (sticky "Filters (3)" button → slides up sheet).

**Wire into:**
- `StateHubPage.tsx`
- `CityHubPage.tsx`
- `TreatmentDirectory.tsx` / `TreatmentPillarPage.tsx`
- `TreatmentStatePage.tsx`
- `CityDirectoryPage.tsx`
- `app/(frontend)/injectors/page.tsx`
- `app/(frontend)/clinics/page.tsx`

**Filter state:** URL query params (e.g. `?radius=10&rating=4&virtual=1`) so filters are shareable + back-button works.

**Map:** Mapbox with clustering (already exists), apply filter results to map pins, lazy-mount via IntersectionObserver.

**Status 2026-06-25:** DONE locally with founder neighborhood change.
- Created `ListingFilters.tsx`, `applyListingFilters.ts`, `LazyMapMount.tsx`, `TreatmentStateProviders.tsx`.
- Wired filters into state hub, city hub, service pillar, service-state, service-city money page, `/injectors`, and `/clinics`.
- Removed standalone neighborhood routes/pages. `NeighborhoodHubPage.tsx` deleted. City pages use neighborhood filter only.
- Mapbox mounts are lazy-wrapped in hero/search/provider/clinic map surfaces. Brand maps untouched.
- `npx tsc --noEmit` clean. `npm run build` green, 148/148 static pages generated.
- Local `/texas/houston` has 0 seeded listings, so screenshot validation shows empty state plus working desktop sidebar/mobile sheet.

---

### BATCH 5 — Clinic profile rebuild

**Goal:** Replace empty clinic page with rich profile.

**Files to change:**
- `app/(frontend)/clinics/[state]/[city]/[slug]/page.tsx` — full rewrite
- `lib/clinic-queries.ts` — extend `getClinicBySlug` to fetch all needed data

**Sections (top to bottom):**
1. Breadcrumb: Home / Clinics / [State] / [City] / [Clinic Name]
2. Hero: photo gallery (5 photos, carousel) + name + clinic type chip + rating + address with map preview
3. Quick info bar: Phone | Email | Website | Hours today
4. Overview: description, year established, services
5. **Services offered** (chips with merit-ordered list)
6. **Providers practicing here** (cards with photo + name + credentials + treatments)
7. **Reviews** (ReviewBreakdown + top 5 + load more)
8. Hours of operation (table from `hoursJson`)
9. Map (Mapbox, large, zoomed to clinic)
10. **Book consult** button → opens modal form (Batch 6)
11. FAQs (clinic-scoped if any)
12. Claim CTA (if not yet claimed)
13. Related: "Other clinics in [city]" (3 cards)
14. JSON-LD: MedicalBusiness + AggregateRating + Review + BreadcrumbList

**Empty states:** Hide section if no data (don't show "No reviews yet" placeholder).

---

### BATCH 6 — Booking flow (unified, no external redirect)

**Goal:** Every booking comes to us first, then forwards to clinic.

**Files to change:**
- `components/booking/BookingForm.tsx` — keep as modal trigger
- `components/booking/BookingModal.tsx` (NEW) — modal with form
- `app/api/bookings/route.ts` — 2-email send logic + sanitize all fields

**Form fields:**
- Name (required)
- Email (required)
- Phone (optional)
- Treatment of interest (dropdown of clinic's services or "Not sure")
- Preferred date range (Next 7 days / Next 2 weeks / Next month / Flexible)
- Message (textarea, optional)
- Turnstile + honeypot

**API logic:**
1. Validate + sanitize all fields (strip \r\n\t)
2. Save to Bookings collection
3. Resolve target email:
   - Provider booking: `provider.contactEmail` → fallback `clinic.email` → fallback `ADMIN_EMAIL`
   - Clinic booking: `clinic.email` → fallback `ADMIN_EMAIL`
4. Send 2 emails via Resend:
   - To clinic/provider: "New booking request from [Name]" with details
   - To admin: copy
5. Return success → modal shows confirmation

**Remove:** Any logic that redirects to `clinic.bookingUrl` externally. Even if clinic has bookingUrl in DB, we DON'T use it for outbound.

---

### BATCH 7 — Forms (contact, list-your-practice, pricing demo)

**Goal:** Replace email-only links with real forms.

**New files:**
- `components/forms/ContactForm.tsx`
- `components/forms/ListPracticeForm.tsx`
- `components/forms/RequestDemoForm.tsx`
- `app/api/contact/route.ts`
- `app/api/list-practice/route.ts`
- `app/api/request-demo/route.ts`

**Each form:**
- Turnstile + honeypot + rate limit (3/hour/IP)
- Server-side validation (Zod)
- Sanitize all fields before email
- Send to appropriate dept email (`ADMIN_EMAIL` fallback)
- Save to a NEW `FormSubmissions` collection (or extend existing Bookings) for admin to track

**Replace on:**
- `app/(frontend)/contact/page.tsx` — embed ContactForm
- `app/(frontend)/list-your-practice/page.tsx` — embed ListPracticeForm
- `app/(frontend)/pricing/page.tsx` — replace mailto with RequestDemoForm modal

---

### BATCH 8 — Dashboard controls

**Goal:** All admin controls accessible from one DashboardWidget.

**Add to `components/admin/DashboardWidget.tsx`:**

1. **Markets Control panel:**
   - Table of all states + cities with `isLive` + `noindex` toggles inline
   - Save button per row → PATCH `/api/admin/locations/quick-toggle`
   - Quick filter: "Live only" / "Coming soon only"

2. **ZIP Data Fix panel:**
   - Button: "Audit clinic locations" (dry-run report)
   - Button: "Fix from ZIP" (runs `fix-clinic-locations-from-zip.mjs` logic via API)
   - Shows count of rows fixed

3. **Bulk Cleanup panel:**
   - Button: "Mark bad-name clinics as review"
   - Button: "Delete ZIP-only locations"
   - Button: "Delete seed providers" (with typed confirm)
   - Each runs the corresponding script via API

4. **Status grid:**
   - Counts: total clinics, total providers, total reviews, pending claims, open alerts, new bookings, draft content
   - Click → filtered admin list

**New API routes:**
- `/api/admin/locations/quick-toggle` (PATCH)
- `/api/admin/data-fix/zip-backfill` (POST, dry-run flag)
- `/api/admin/data-fix/clean-bad-names` (POST, dry-run)
- `/api/admin/data-fix/delete-zip-locations` (POST, dry-run)
- `/api/admin/data-fix/delete-seed-providers` (POST, requires typed confirm)

All admin-role only, audit-logged.

---

### BATCH 9 — Security pass

**Goal:** Close all open security findings before launch.

Implement per `docs/AUDIT-FIX.md`:

**Phase 1 (CRITICAL):**
- SEC6 — IDOR fixes on `/api/dashboard/save`, `/upload`, `/locations` (assert linkedProvider/linkedClinic = requested ID)
- CSRF null-Origin bypass tightened

**Phase 2 (Auth):**
- SEC8 — `ADMIN_EMAIL` fail-fast in production
- SEC5 — `/setup-account` page built OR password-reset flow substituted
- SEC13 + SEC14 — newsletter token expiry + Referrer-Policy

**Phase 3 (Cleanup):**
- SEC1 — License badge respects Active status
- SEC2 — Signup form: Turnstile + CSRF + IP fix
- SEC3 — CSRF guards on 8 routes
- SEC4 — Reviews public read filters by moderationStatus
- SEC7 — Email header sanitize on all fields
- SEC12 — lat/lng Number.isFinite assertion
- SEC15 — Claims enumeration (200 always)
- SEC16 — CSV 50k row cap
- SEC17 — Document `overrideAccess: true` usage
- SEC18 — Backup URL stripped from response
- SEC19 — Newsletter broadcast 500-recipient cap

---

### BATCH 10 — Mobile + perf polish

**Goal:** Address all UI-UX-PERF audit findings.

1. **Header overlap** — adjust grid spacing at 375px, bump search+theme toggles to 44px
2. **Mapbox lazy-mount** — IntersectionObserver wrapper around every map component
3. **Drop framer-motion + gsap** — replace with CSS keyframes
4. **BodyAreas single-theme** — `useTheme` to pick light or dark image, not both
5. **TrustBar palette** — recolor to navy + mint + neutral only
6. **TrustBar real numbers** — fetch from DB (provider count, review count, treatment count)
7. **`optimizePackageImports`** in `next.config.mjs` for `@phosphor-icons/react`
8. **Dynamic-import below-fold sections** — patient stories, video testimonials, before-after sliders
9. **Footer brandmark** — fix duplicate render
10. **Sticky CTA overflow** — `pb-20 sm:pb-0` on page wrappers
11. **Provider profile header alignment** — avatar centered vs text left disconnect
12. **Skip-to-content link** — add for a11y
13. **Favicon** — add real one (currently TODO)
14. **Date locale** — remove hardcoded 'en-US'
15. **Form input font-size 16px+** — prevent iOS auto-zoom

---

### BATCH 11 — Cleanup pass

**Delete:**
- `scratch/` directory
- `lib/city-slug.ts`
- `lib/promotion-queries.ts` (old)
- `components/shared/SponsoredProviderCard.tsx`
- `components/shared/AdBanner.tsx`
- Seed-provider blocks in `scripts/seed.ts`
- `mockups/`, `design/figma-build-spec.md`
- `framer-motion`, `gsap` from package.json (after Batch 10)
- All old `/[treatment]/...` route files (after Batch 2)
- `CostEstimator` component if exists
- Stale CLAUDE.md sections

**Verify:** `tsc` clean, build green, all pages still 200.

---

### BATCH 12 — News + Guides content import (production)

**Goal:** Populate production news + guides from local JSON files.

1. SSH/connect to production OR use admin import API
2. Upload `data/news-january-2026.json` via admin content-import panel
3. Upload Feb-June news batches
4. Upload 4 guide batches
5. Set `reviewStatus=approved` + `indexState=indexed` for verified content
6. Verify `/news` shows articles + RSS feed works
7. Verify sitemap includes new entries

---

### BATCH 13 — Production data fix run

**Goal:** Execute all data scripts from Batch 1 against production.

1. **`npm run db:backup`** (full backup before any change)
2. Run `scripts/audit-data-pre-deploy.mjs` — capture baseline counts
3. Run `scripts/delete-seed-providers.mjs` (dry-run first, then real)
4. Run `scripts/cleanup-zip-locations.mjs` (dry-run first, then real)
5. Run `scripts/fix-clinic-locations-from-zip.mjs` (dry-run first, then real)
6. Run `scripts/cleanup-bad-clinic-names.mjs` (dry-run first, then real)
7. Run `scripts/migrate-city-slugs-production.mjs` (dry-run first, then real)
8. Run `scripts/audit-data-pre-deploy.mjs` again — verify counts match expectations
9. `npm run scan:alerts` — resolve any new alerts
10. Spot check 20+ URLs on production

---

### BATCH 14 — Production deploy

**Goal:** One big deploy of all code changes.

1. Verify all batches 0-12 complete locally
2. `npx tsc --noEmit` clean
3. `npm run build` green
4. All env vars set in DO:
   - `NEXT_PUBLIC_SITE_URL=https://injector.world` (or current production URL)
   - `RESEND_API_KEY=re_...`
   - `RESEND_FROM=bookings@injector.world`
   - `ADMIN_EMAIL=admin@injector.world`
   - `FOUNDER_EMAIL=rishavkumarkarn3@gmail.com`
   - `NEWSLETTER_ADDRESS=[real physical address — required for CAN-SPAM]`
   - `MAPBOX_TOKEN=...` (restricted to production domain)
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
   - All R2 env vars confirmed
5. Git commit + push
6. DO redeploys automatically
7. Smoke test: visit 30+ URLs on production
8. Check Resend dashboard: domain verified, no email failures

---

### BATCH 15 — Launch gate

**Goal:** Full QA pass before going live to public.

Run every checklist item from `docs/revamp.md` Part 12 plus:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` green
- [ ] All 4 live states load (CA / TX / NY / FL)
- [ ] `/services/botox/texas/houston` loads, shows clinics + providers
- [ ] `/texas/houston` city hub: filters work, map loads
- [ ] `/texas/houston/montrose` neighborhood hub loads
- [ ] `/injectors/texas/houston/[slug]` profile + booking form works
- [ ] Booking submit: form validates, 2 emails arrive (clinic + admin)
- [ ] Register → verify email → login → correct dashboard → logout
- [ ] Password reset flow works end-to-end
- [ ] Claim form: Turnstile + submit → admin email arrives
- [ ] Contact form, list-practice form, request-demo form all submit
- [ ] At least 1 promotion shows on a live money page
- [ ] Old URLs (`/botox/houston-tx` etc.) return 404
- [ ] Sitemap has only `/services/...` paths, no old format
- [ ] robots.txt: `Disallow: /api/` with `Allow: /api/search/suggest`
- [ ] Dark mode: no broken colors on any page
- [ ] Mobile 390px: no overflow, header doesn't overlap, touch targets 44px+
- [ ] No em dashes in any copy
- [ ] No `console.error` in browser
- [ ] DO DB firewall locked to app only
- [ ] Mapbox token restricted to production domain
- [ ] Turnstile site key points to production domain
- [ ] NEWSLETTER_ADDRESS set (CAN-SPAM)
- [ ] Resend domain verified
- [ ] Google Search Console: sitemap submitted (only after launch)
- [ ] License badge respects Active status
- [ ] Reviews public API only returns approved
- [ ] All 8 CSRF-missing routes now have CSRF guard
- [ ] IDOR fixes verified (Provider A cannot edit Provider B)
- [ ] News + guides content live on production
- [ ] ZIP-based data fix run, all clinics have valid city/state
- [ ] No seed providers in production DB
- [ ] No bad-name clinics on public pages
- [ ] No ZIP-named locations in admin

---

## SECTION 4 — POST-LAUNCH (deferred)

Items NOT blocking launch but planned:

- AdSense fallback fill (revamp Phase 17)
- `/zip/[code]` SEO landing pages (Phase 14 deferred)
- Stripe self-serve billing (currently manual)
- Multi-instance Redis rate limiter
- Sentry error tracking
- Advanced provider analytics dashboard

---

## SECTION 5 — WHAT THIS DOC REPLACES

When execution starts:
- `docs/AUDIT-FINDINGS.md` (closed, findings folded here)
- `docs/FULL-AUDIT-2026-06-19.md` (closed)
- `docs/UI-UX-PERF-AUDIT-2026-06-19.md` (folded into Batch 10)
- `docs/AUDIT-FIX.md` (folded into Batch 9)
- `docs/revamp.md` (Batches 2-4 are the rebuild — revamp doc stays as historical context only)

`docs/ROADMAP.md` continues as high-level phase tracker. This doc = tactical execution.

---

## SECTION 6 — KEY TECHNICAL NOTES

### ZIP backfill query (the magic that fixes most data issues)

```sql
-- ~80% of clinic data quality problems get fixed by this single query
UPDATE clinics c
SET 
  city = z.city,
  state = z.state,
  latitude = COALESCE(NULLIF(c.latitude, 0), z.lat),
  longitude = COALESCE(NULLIF(c.longitude, 0), z.lng)
FROM zip_codes z
WHERE c.zip = z.zip 
  AND (
    c.city IS NULL OR c.city = '' 
    OR c.state IS NULL OR LENGTH(c.state) != 2
    OR c.city ~ '^\d+'
    OR c.city = UPPER(c.city)
  );
```

`zip_codes` table has 41,490 US ZIPs (GeoNames public domain). Already seeded in production.

### Booking flow (the spec)

```
Patient on /clinics/texas/houston/[slug]
  → clicks "Book consult"
  → modal opens with form (name, email, phone, treatment, date, message)
  → submit → POST /api/bookings (with Turnstile token)
  → server: validate + sanitize + save to Bookings collection
  → server: resolve target email
       provider booking → provider.contactEmail OR clinic.email OR ADMIN_EMAIL
       clinic booking → clinic.email OR ADMIN_EMAIL
  → server: send 2 emails via Resend
       to target email: "New booking from [Name] for [Treatment]"
       to ADMIN_EMAIL: copy
  → response: { success: true }
  → modal shows "Thank you, we'll be in touch" → auto-close after 5s
```

### Filter design (URL params for shareability)

```
/services/botox/texas/houston?radius=10&rating=4&virtual=1&priceMin=200&priceMax=600
                              ^               ^         ^         ^         ^
                              distance        rating    virtual   price range

State persisted in URL → back button works → shareable links → SSR-friendly
```

### Header nav (simplified Services structure)

```
SERVICES (dropdown)
├─ Botox
├─ Cheek Filler
├─ Daxxify
├─ Dysport
├─ Jawline Filler
├─ Jeuveau
├─ Kybella
├─ Lip Filler
├─ Masseter Botox
├─ Microneedling
├─ PRP
├─ Sculptra
├─ Tear Trough
├─ Thread Lift
└─ Xeomin
   (alphabetical, no sub-groups, no "by area" section)

FIND (dropdown)
├─ All states
├─ California
├─ Florida
├─ New York
├─ Texas
└─ Browse all

LEARN (dropdown)
├─ Guides
├─ News
├─ Quiz
├─ Patient Stories
└─ How we verify
```

---

*End of finalfixes.md. Execute in order. One batch per chat. Founder approval before each.*

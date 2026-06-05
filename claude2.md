# injector.world — Build Roadmap (DEPRECATED)

> **DEPRECATED as of 2026-06-05.** This roadmap has been folded into `CLAUDE.md` under
> "Build Status" → "Roadmap". CLAUDE.md is now the single source of truth for both
> locked decisions AND the build plan. Do not update this file. Read CLAUDE.md instead.
> The content below is kept only for historical reference.

---

This was the **working build plan**. CLAUDE.md is the locked source of truth for stack, design tokens, URL structure, schema, and brand voice. This file said **what to build next, in what order, and how to know it is done.**

Do not re-derive locked decisions. If it is in CLAUDE.md, it is final. This file only sequences the work.

---

## How to use this file

- Each phase is a self-contained chunk of work suited to one focused chat.
- Every page task lists: **route, data source, what to build, schema/SEO, done-when.**
- A page is never "done" until all five layers exist: data, query, render, JSON-LD, sitemap entry.
- Follow the hard rules in CLAUDE.md: no em dashes, mobile-first, one mint accent per viewport, real copy (never lorem), design tokens only.

---

## Current state snapshot (last updated 2026-06-03)

**Stack:** Next.js 15.4 + Payload CMS 3 + PostgreSQL 18 + PostGIS. Hosted locally, targeting Vercel + Neon for deploy.

**What is built and working (all 200):**

| Page / Feature | Route | Notes |
|---|---|---|
| Homepage | `/` | All 13 sections. Organization + WebSite JSON-LD added. |
| Provider listing | `/injectors` | All seeded providers |
| Provider profile | `/injectors/[slug]` | JSON-LD: Physician + AggregateRating + Review |
| Clinic listing | `/clinics` | |
| Clinic profile | `/clinics/[slug]` | JSON-LD: MedicalBusiness |
| Guide detail | `/guides/[slug]` | Lexical renderer, FAQ accordion, JSON-LD, ISR |
| Treatment pillar | `/[treatment]` | City grid, risks section, FAQ, guide CTA |
| State hub | `/[state]` | Treatment grid + city grid (entry from Browse by State) |
| Treatment + state | `/[treatment]/[state]` | City grid, top providers |
| City directory (money page) | `/[treatment]/[city-state]` | Map, filters, sponsored slots, neighborhoods, FAQ |
| City hub | `/[city-state]` | Treatment grid linking to money pages |
| Neighborhood | `/[treatment]/[city-state]/[neighborhood]` | Slim city directory |
| Body area education | `/treatments/[area]` | 10 areas, treatment options from DB, risks |
| How we verify | `/how-we-verify` | 4-step explainer |
| Editorial standards | `/editorial-standards` | With corrections log anchor |
| Medical advisory | `/medical-advisory` | Queries MedicalReviewers collection, ISR |
| About | `/about` | |
| List your practice | `/list-your-practice` | Provider acquisition |
| Contact | `/contact` | 5 email contacts |
| Privacy / Terms / HIPAA | `/privacy`, `/terms`, `/hipaa` | |
| Sitemap | `/sitemap.xml` | Programmatic, all content types |
| Robots | `/robots.txt` | GPTBot/ClaudeBot allowed |
| LLMs.txt | `/llms.txt` | AI crawler index |

**Routing:** Single required catch-all `app/(frontend)/[...path]/page.tsx`. Resolver in `lib/route-resolver.ts` with module-level cache.

**Slug normalization (done):** States = `new-york`, cities = `new-york-ny`, neighborhoods = `upper-east-side`. Migration script: `scripts/fix-location-slugs.ts`.

**Collections (15):** Users, Media, Treatments, Locations, Clinics, Providers, Reviews, Photos, QA, Authors, MedicalReviewers, Guides, FAQs, BeforeAfterCases, Bookings, Promotions.

**Seeded data:** 15 providers, 8 clinics, 5 metros (NYC, LA, Miami, Chicago, SF), 12 treatments, 50 states, 20 metros, 12 NYC neighborhoods, 6 guides, 20 FAQs, 5 promotions.

---

## What is still broken RIGHT NOW

These must be fixed before the site is considered launchable.

### 🔴 Dead links in navigation (15+ links → 404)

**Guides menu + footer — missing guides in DB:**
```
/guides/lip-filler          nav: By treatment
/guides/first-time-botox    nav: By concern + footer
/guides/botox-vs-filler     nav: By concern
/guides/red-flags           nav: By concern
/guides/is-botox-safe       nav: Cost & safety + footer
/guides/botox-side-effects  nav: Cost & safety
/guides/md-vs-np-vs-rn      nav: Cost & safety + footer
```
Fix: Either seed these guides in DB, or remove them from `lib/site-nav.ts`.
Recommended: Seed all 7 missing guides as stubs (title + lede + author). Admin can fill body later.

**Treatments menu — treatments not in DB:**
```
/xeomin    nav: Neurotoxins
/jeuveau   nav: Neurotoxins
/daxxify   nav: Neurotoxins
```
Fix: Add to `scripts/seed-data.ts` treatments array and re-seed, OR remove from nav.

**Footer company links — missing pages:**
```
/press    footer: Company
/careers  footer: Company
```
Fix: Add two simple static placeholder pages.

### 🔴 Missing listing page
```
/guides    (footer links here, no index page built)
```
Fix: Build a listing page that queries all guides from DB, shows category filter tabs.

### 🟡 Empty city directories (UX problem, not a 404)
`/botox/phoenix-az`, `/botox/dallas-tx`, etc. — page renders (200) but shows 0 providers. The empty state copy is generic. Users will bounce.

Fix: Better empty state — "No verified providers listed yet in [city]. Browse [nearby city] or [all state] providers." With CTAs to nearby cities.

### 🟡 Booking flow is completely missing (Phase 4, critical for MVP)
All "Book consult" CTAs exist but lead to `#book` anchor on the profile page. The BookingForm component does not exist. The Bookings collection exists in Payload but nothing writes to it.

A patient cannot contact a provider through the site right now. This is the most critical missing piece for the product to have any value.

---

## End-to-end user journey (what should work vs what does)

```
Patient lands on homepage
  → Search "Botox" + "New York, NY" → /botox/new-york-ny  ✅ works
  → Browse by Treatment "Find a provider" → /botox          ✅ works (city grid)
  → Browse by State "New York" → /new-york                  ✅ works
  → Body area "Jawline" → /treatments/jawline               ✅ works

On money page /botox/new-york-ny
  → Filters (credential, rating) → same page                ✅ works
  → Click provider card → /injectors/[slug]                 ✅ works

On provider profile
  → Click "Book consult" → #book anchor → form             ❌ NO FORM EXISTS
  → Click guide link → /guides/botox                        ✅ works

Guide page
  → Read guide → FAQ accordion                              ✅ works
  → "Find a provider" CTA → /botox                          ✅ works (treatment pillar)
```

**The missing link:** Patient → Provider contact. Without this, the directory has no conversion action.

---

## Phase priority order (what to build next)

### Priority 0 — Immediate dead link cleanup (1 chat, ~2 hrs)

These are embarrassing and easy to fix.

**0.1 Seed missing guides as stubs**
Add to `scripts/seed-data.ts` guides array:
- `lip-filler`, `first-time-botox`, `botox-vs-filler`, `red-flags`, `is-botox-safe`, `botox-side-effects`, `md-vs-np-vs-rn`
- Each needs: title, slug, lede, category, authorSlug, reviewerSlug
- Body can be empty (placeholder text shows until content team fills it)
- Re-run `npm run seed` will skip existing, won't add these (seeds are skip-if-exists). Need to add them directly via Payload API or admin, OR add a `seedGuides()` function that inserts any missing guide by slug.

**0.2 Seed missing treatments**
Add xeomin, jeuveau, daxxify to treatments seed. These are neurotoxins, same fields as Botox/Dysport.

**0.3 Build /guides index page**
`app/(frontend)/guides/page.tsx` — query all guides, show filter tabs (All / Treatment Guides / Articles / Expert Q&A / Cost Reports), card grid. Similar to the BlogsGuides homepage component but as a full page with ISR.

**0.4 Add /press and /careers**
Simple static placeholder pages. Same pattern as /about.

**0.5 Empty state on city directories**
In `components/pages/CityDirectoryPage.tsx` when `providers.length === 0`, show:
- "No verified providers listed in [city] yet."
- Link to state hub: "Browse all injectors in [state]"
- Link to nearest seeded city (hardcoded fallback: NYC for East, LA for West, Miami for South, Chicago for Midwest)

**Done when:** Every link in the header mega-menu and footer resolves to a page. Zero 404s from navigation.

---

### Priority 1 — Booking flow (1-2 chats, Phase 4 start)

This is the most critical missing piece. Without it, the site collects no leads and no revenue.

**How it works:**
1. Patient fills form on provider profile → POST to `/api/bookings` → **saved in Payload Bookings collection** (visible in admin panel at `/admin`)
2. On save → **Resend sends email notifications:**
   - Patient gets a confirmation email ("Your consultation request was received")
   - Admin gets a notification email with the full lead details
   - Provider gets a notification email (once claim flow exists; for now goes to admin only)

**1.1 BookingForm component**
- `components/booking/BookingForm.tsx` — `'use client'`, Zod-validated
- Fields: firstName, lastName, email, phone (optional), treatmentInterest (select, pre-filled from provider's treatments), message (optional), preferredDate (optional)
- POST to `/api/bookings` (custom Next.js API route, not Payload REST — gives us full control)
- On success: inline "Request received" confirmation, form hides. No redirect.
- Error handling: field-level errors inline, generic error fallback

**1.2 API route** `app/api/bookings/route.ts`
- Zod validate the body server-side
- Create record via `payload.create({ collection: 'bookings', data: {...} })`
- Trigger Resend emails (patient confirmation + admin notification)
- Return `{ success: true }` or `{ error: '...' }`
- Rate limit: max 5 requests per IP per hour (in-memory Map, adequate for MVP)

**1.3 Resend setup**
- `npm install resend`
- `RESEND_API_KEY` in `.env.local` and Vercel env vars
- `from:` domain must be verified in Resend dashboard (use `bookings@injector.world`)
- Two email templates (plain text is fine for MVP):
  - Patient: "We received your consultation request for [provider name]. They will be in touch within 24 hours."
  - Admin/provider: Full lead details — name, email, phone, treatment, message, preferred date, provider name, clinic.

**1.4 Wire CTAs**
- Provider profile `#book` section: replace static external link buttons with `<BookingForm />` as fallback when no `websiteUrl` exists. If provider has `websiteUrl`, keep that as primary CTA + add the form below as secondary.
- City directory provider cards: "Book consult" → `/injectors/[slug]#book` (scroll to form on profile)
- Guide sidebar: stays as `/${relatedTreatment.slug}` (no specific provider to book)

**1.5 Bookings collection fields** (already exists, verify these fields are present):
- provider (relationship), patientFirstName, patientLastName, patientEmail, patientPhone, treatmentInterest, message, preferredDate, status (new/contacted/booked/cancelled), createdAt

**Done when:** Patient fills form → lead appears in Payload admin (`/admin` → Bookings) → patient receives confirmation email → admin receives notification email with full lead info.

---

### Priority 2 — Data strategy (parallel with Priority 1)

The site needs real provider data to be useful outside NYC/LA/Miami/Chicago/SF.

**Option A: CSV bulk import (recommended)**
Build `scripts/import-providers.ts` that reads CSVs matching `data/scraper-brief.md` schemas:
- Clinics CSV → create/update Clinics
- Providers CSV → create/update Providers
- Reviews CSV → create/update Reviews
- Upsert by unique ID (clinicId, providerId) — safe to re-run

This is the right path. One script, real data slots in without any DB refactor (field names already match scraper-brief.md).

**Option B: Admin manual entry**
Works today. Go to `/admin`, create a Clinic, then create a Provider linked to that clinic.
Adequate for 10-20 providers but not scalable.

**Priority cities to add data for (in order):**
NYC (extend from 8 to 20+ providers), LA, Miami, Chicago, SF, then Phoenix, Dallas, Houston, Atlanta, Seattle.

---

### Priority 3 — Provider claim flow (Phase 4, larger effort)

**3.1 Claim request**
- Provider sees their unclaimed profile
- Clicks "Claim this profile" → form (email, license number, NPI)
- Creates a claim record in Payload (new Claims collection)
- Admin reviews and approves

**3.2 Provider auth + dashboard**
- Payload built-in auth (role: 'provider')
- After claim approved: provider can log in
- Dashboard: edit bio, tagline, treatments offered, pricing, photos, booking URL, social links
- Cannot edit: license number, verified badge, reviews

**Done when:** A real provider can claim their profile and update their own information without admin intervention.

---

### Priority 4 — Pre-launch infra (Phase 5)

- **Media storage:** `@payloadcms/storage-vercel-blob` for Vercel, or S3 adapter for DO Spaces. Currently all media is URL-only (external URLs, no uploads work in prod).
- **Replace db-push with Payload migrations** for production (build-time push is additive-only, silent on destructive changes).
- **Sentry** error monitoring.
- **Replace `i.pravatar.cc` placeholder photos** with real provider headshots.
- **Real before/after photos** with documented consent.

---

## Data model: how everything connects

```
Treatments ←→ Guides (one-to-one, guide.relatedTreatment)
Treatments ←→ Providers (many-to-many, providers.treatmentsOffered)
Treatments ←→ Locations (via URL resolver: /[treatment]/[city])

Locations (kind=state) ←→ Locations (kind=metro, parent=state location)
Locations (kind=metro) ←→ Locations (kind=neighborhood, parent=metro)
Locations ←→ Clinics (clinic has city string, matched by state code + name)
Clinics ←→ Providers (provider.clinic → clinic)

Providers ←→ Reviews (review.provider → provider)
Providers ←→ BeforeAfterCases (case.provider → provider)
Providers ←→ Bookings (booking.provider → provider)
Providers ←→ Promotions (promotion.provider → provider, scoped by treatment+location)

Authors ←→ Guides (guide.author → author)
MedicalReviewers ←→ Guides (guide.medicalReviewer → reviewer)
FAQs ←→ Guides (guide.faqs → [faq])
FAQs (standalone) → queried by scope + treatmentTag + cityTag

Promotions → scopeType + treatmentScope (→ Treatment) + locationScope (→ Location)
```

**Key gap:** Providers are matched to cities via `clinic.city` string + `clinic.state` code. This means provider data must be consistent with how Location records name the city. NYC: clinic.city = "New York", Location.name = "New York City". The `clinicCityName()` helper strips "City" suffix for matching. This is fragile — when importing real data, ensure clinic.city strings match exactly.

---

## Admin workflow for adding providers manually

1. `/admin` → Clinics → Create new
   - Required: clinicName, clinicId (unique string like `clinic-nyc-00009`), slug, addressLine1, city, state, zip, country, latitude, longitude
   - Latitude/longitude: get from Google Maps (right-click a location)

2. `/admin` → Providers → Create new
   - Required: fullName, slug, credentials (MD/NP/RN/PA/DO), title, licenseNumber, licenseState, licenseStatus
   - Select clinic from dropdown
   - Select treatmentsOffered (multiselect from Treatments collection)
   - Set aggregateRating, aggregateRatingCount if known

3. ISR: provider will appear on the site within 5 minutes on Vercel (revalidate=300)

**Slug convention:** `firstname-lastname-credentials-city` e.g. `lena-park-md-nyc`

---

## Vercel deployment checklist (before pushing)

1. Run `npm run build` locally — fix any TypeScript errors
2. Add env vars on Vercel: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SITE_URL=https://injector.world`
3. Neon DB must have same schema as local (run `npm run db:push` against Neon before build, or use proper Payload migrations)
4. The `build` script currently runs `tsx scripts/db-push.ts && next build` — this is fine for Neon (additive only) but risky if schema conflicts exist. Watch the build log.
5. `RESEND_API_KEY` (when booking flow is built)
6. No media storage adapter yet — uploaded files will not persist on Vercel. All media URLs in seed data are external (picsum, pravatar) so they work. New uploads via admin will not work until storage adapter is added (Priority 4).

---

## Open decisions (from CLAUDE.md, still unresolved)

- Booking flow: modal vs full page (recommend: inline form on provider profile page, no redirect)
- Provider dashboard layout
- Pricing model for premium listings (Promotions collection is built, pricing/billing logic is not)
- Email provider: pick Resend (already recommended in scraper-brief and claude2.md)
- Media storage: recommend Vercel Blob (`@payloadcms/storage-vercel-blob`) since hosting is Vercel
- Logo design (wordmark only today)
- Launch date

---

## Suggested next chat scope

**Start with Priority 0 (dead link cleanup) — it is fast and makes the site feel coherent.**

Specifically:
1. Seed 7 missing guide stubs (add to seed-data.ts with `seedMissingGuides()` helper that does upsert-by-slug)
2. Seed 3 missing treatments (xeomin, jeuveau, daxxify)
3. Build `/guides` index page (ISR, filter tabs, card grid)
4. Add `/press` and `/careers` placeholder pages
5. Better empty state on city directory when 0 providers

Then: **Priority 1 (booking flow)** — this is what makes the site actually useful.

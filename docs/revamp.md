# injector.world — Launch Revamp Master Plan

**Status:** In progress — 2026-06-23  
**Goal:** Final modifications before real-data import + public launch on DigitalOcean.  
**Owner:** Founder (rkumar0101)

This document is the single tracker for everything needed before go-live. Work top-to-bottom.
Each section has a status. Do not move to "Deploy" until every item above it is checked.

---

## 1. What this revamp covers

The fake-data MVP is built and deployed. The revamp does three things:

1. **URL restructure** — provider and clinic detail pages move from flat slugs to city-scoped URLs for better SEO and geographic targeting.
2. **Treatment pillar overhaul** — `/botox`, `/dysport`, etc. become real paginated directories, not just editorial landing pages.
3. **Final audit + polish** — every page gets a final pass before real data goes in.

Then: real data import (Houston, NYC, LA first) and redeploy to DigitalOcean.

---

## 2. Shipped: URL migration (this session)

**Old URLs (still work via redirect):**
- `/injectors/[slug]`
- `/clinics/[slug]`

**New canonical URLs:**
- `/injectors/[city-state]/[slug]` — e.g. `/injectors/houston-tx/dr-lena-park-md`
- `/clinics/[city-state]/[slug]` — e.g. `/clinics/new-york-ny/park-avenue-derm`

**Files changed (31 total):**
- `app/(frontend)/injectors/[city]/[slug]/page.tsx` — new provider profile route
- `app/(frontend)/clinics/[city]/[slug]/page.tsx` — new clinic profile route
- `app/(frontend)/injectors/[slug]/page.tsx` — now a redirect to new URL
- `app/(frontend)/clinics/[slug]/page.tsx` — now a redirect to new URL
- `lib/city-slug.ts` — pure `toCitySlug(city, state)` utility
- `lib/location-queries.ts`, `lib/search-queries.ts`, `lib/hero-queries.ts`, `lib/home-queries.ts`, `lib/promotion-queries.ts`, `lib/provider-queries.ts`, `lib/clinic-queries.ts` — `citySlug` added everywhere
- All card components, map popups, search results, sitemap — links updated
- `app/sitemap.ts` — uses `getAllProviderParams()` + `getAllClinicParams()` for city-scoped URLs

**TypeScript:** clean (zero errors). Backward-compatible: old URLs redirect via DB lookup, never 404.

---

## 3. Shipped: Treatment pillar overhaul (this session)

**Before:** `/botox` showed 6 "editor's pick" providers with no treatment filter.

**After:** `/botox`, `/dysport`, `/xeomin`, etc. now show:
- State/city picker (unchanged — links to `/botox/new-york-ny`)
- **"Injectors | Clinics" tabs** — both independently filtered by `treatmentsOffered` on their own collection (clinics are NOT derived from providers; a clinic with Botox + Jeuveau appears on both `/botox` and `/jeuveau`)
- **Load More** — 12 per page, client-side, no API needed at current data scale
- Empty state per tab
- Cost estimator, FAQs, risks, guide CTA — unchanged below

**New file:** `components/pages/TreatmentDirectory.tsx`  
**Modified:** `lib/location-queries.ts` (`getTreatmentPillar` + `TreatmentPillarData` type), `components/pages/TreatmentPillarPage.tsx`

---

## 4. Remaining work — pre-data tasks

Work these in order. Each item = one focused chat.

### 4.1 Page-level polish pass

Go through every page and check: copy, dark mode, mobile, empty states, dead links.

| Page | Status | Notes |
|---|---|---|
| `/` Homepage | [ ] | Check hero, LatestNews strip, Browse-by-State, featured sections |
| `/botox` (treatment pillar) | [x] DONE | Injectors + Clinics tabs, Load More |
| `/botox/new-york-ny` (city directory) | [ ] | Providers + Clinics tabs — verify both tabs work with real-shaped data |
| `/injectors` (all injectors) | [ ] | ProvidersGrid, filters, map |
| `/clinics` (all clinics) | [ ] | ClinicsGrid, filters, map |
| `/injectors/[city]/[slug]` | [ ] | Profile page — booking form, before/after, reviews |
| `/clinics/[city]/[slug]` | [ ] | Clinic page — map, providers list, booking |
| `/guides/[slug]` | [ ] | Structured fields (answerSnippet, atAGlance, faq, sources) rendering |
| `/news/[slug]` | [ ] | Same structured fields |
| `/brands/[slug]` | [ ] | Multi-location hub |
| `/search` | [ ] | Omnibox results page |
| `/pricing` | [ ] | 4-tier table, FAQ, CTA |
| `/quiz` | [ ] | Candidate quiz |
| `/questions` + `/questions/[slug]` | [ ] | Q&A board |
| `/login`, `/dashboard`, `/profile` | [ ] | Auth flows end-to-end |
| Static pages | [ ] | /about, /contact, /privacy, /terms, /hipaa, /how-we-verify, /editorial-standards, /medical-advisory, /press, /careers |
| Patient stories, social, videos | [ ] | These have pending changes from previous session — review and finalize |

### 4.2 Header + navigation

- [ ] `CardNavClient.tsx` — verify the 3+5 editorial lead strip works (pending changes from previous session)
- [ ] `lib/site-nav.ts` — confirm all nav links resolve correctly with new URL structure
- [ ] Mobile hamburger menu — all links correct
- [ ] Header search overlay — works with new city-scoped provider/clinic links

### 4.3 SEO + structured data

- [ ] Canonical URLs on provider + clinic detail pages use new city-scoped format
- [ ] `app/sitemap.ts` generates city-scoped URLs for providers + clinics
- [ ] `robots.txt` correct (non-live markets noindex)
- [ ] OG images + Twitter cards on new profile pages
- [ ] JSON-LD on new `/injectors/[city]/[slug]` and `/clinics/[city]/[slug]` pages
- [ ] Breadcrumb schema includes city level

### 4.4 Search + maps

- [ ] Search suggest (`/api/search/suggest`) returns city-scoped hrefs — done in this session, verify
- [ ] Hero search results link to correct new URLs
- [ ] Map popups link to correct new URLs
- [ ] `/search` page results link to correct new URLs
- [ ] Mapbox token restricted to `injector.world/*` (currently unrestricted — do this when domain is final on DO)

### 4.5 Auth + dashboard

- [ ] Provider dashboard — "View public profile" link uses new city-scoped URL (done this session, verify)
- [ ] Claim flow — `/claim/provider/[slug]` and `/claim/clinic/[slug]` — verify these resolve correctly post-redirect
- [ ] Patient `/profile` — saved providers/clinics links point to new URLs (currently uses redirect fallback — acceptable)

### 4.6 Final audit fixes (known issues)

These are bugs or gaps identified in the site audit. Fix before data import.

- [ ] `docs/clinics.md` has pending edits from previous session — review and finalize or discard
- [ ] `app/(frontend)/patient-stories/page.tsx` — pending changes, review
- [ ] `app/(frontend)/social/page.tsx` — pending changes, review
- [ ] `app/(frontend)/videos/page.tsx` — pending changes, review
- [ ] Rate limiting: in-memory `Map` resets per deploy — migrate to DO Managed Redis before multi-instance scale (noted in ROADMAP Phase 12, not blocking single-instance launch)
- [ ] Mapbox token: restrict to production domain before launch (currently open)
- [ ] `NEWSLETTER_ADDRESS` — real physical address required for CAN-SPAM before any live email send
- [ ] `NEWSLETTER_FROM` domain — must be verified on Resend before sending
- [ ] DO DB firewall — currently open (noted in `docs/DEPLOYMENT-DIGITALOCEAN.md`) — lock to App Platform IP before launch
- [ ] `db:push` fragility on DO — use SQL migration scripts, not interactive push

---

## 5. Real data import plan

**Strategy:** wipe fake data, import real data for launch markets, redeploy.

### Launch markets (4 states, live + indexable)
- California (LA, San Francisco, San Diego, San Jose)
- Texas (Houston, Dallas, Austin, San Antonio)
- New York (NYC, Brooklyn, Upper East Side, etc.)
- Florida (Miami, Tampa, Orlando)

Everything else stays "coming soon" + noindex. Script: `npm run set:live` (already wired, CA/TX/NY/FL).

### Data format
Single combined CSV per `data/scraper-brief.md`. Columns: `record_type`, then all fields.
Importer: `npm run import` reads `data/samples/` or admin upload.

### Import checklist

- [ ] Real providers data CSV ready (Houston, NYC, LA first batch)
- [ ] Real clinics data CSV ready — `treatmentsOffered` column populated (this is the field that drives treatment pillar pages now — must be accurate)
- [ ] Real reviews CSV ready
- [ ] Photos: URLs in CSV pointing to final hosted images (or R2 upload via admin)
- [ ] `npm run db:backup` taken before wipe
- [ ] Wipe fake data: admin panel "Wipe" with scope=all + typed confirm
- [ ] `npm run import` with `--dry-run` first — check DataAlerts
- [ ] Fix any DataAlerts (missing coords, duplicate NPI, invalid phone)
- [ ] `npm run import` for real
- [ ] `npm run scan:alerts` clean
- [ ] `npm run set:live` to re-apply market flags
- [ ] `npm run seed:brands` if any brand groups identified in data
- [ ] Verify treatment pillar pages show correct providers + clinics (spot check `/botox`, `/lip-filler`)
- [ ] Verify city directory pages show correct data (spot check `/botox/houston-tx`, `/botox/new-york-ny`)

### Critical: `treatmentsOffered` on Clinics collection

The treatment pillar pages (and city directory clinics tab) now filter by `clinics.treatmentsOffered`. If this field is empty on imported clinics, those clinics will NOT appear on treatment pages. The CSV importer must populate `treatmentsOffered` with treatment IDs (or names that resolve to treatment records).

Verify: after import, go to `/botox` — Clinics tab must show clinics from Houston/NYC/LA.

---

## 6. Deploy plan

Site is already live on DigitalOcean App Platform. This is a relaunch with new code + real data.

### Before deploying

- [ ] All items in sections 4 and 5 complete
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` passes locally
- [ ] `npm run dev` boots with no errors
- [ ] All changed pages return 200 (spot check 10 pages)
- [ ] Light + dark mode verified
- [ ] Mobile 390px verified

### Environment variables (DO App Platform)

Confirm these are set in DO dashboard:

| Variable | Notes |
|---|---|
| `DATABASE_URI` | DO Managed PostgreSQL connection string |
| `PAYLOAD_SECRET` | Strong random string, never change after first deploy |
| `NEXT_PUBLIC_SERVER_URL` | `https://injector.world` |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 credentials |
| `R2_SECRET_ACCESS_KEY` | |
| `R2_BUCKET` | `injectors-world-media` |
| `R2_ENDPOINT` | R2 S3 endpoint |
| `R2_PUBLIC_URL` | `https://pub-....r2.dev` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Client-side map token — restrict to `injector.world/*` |
| `MAPBOX_TOKEN` | Server-side geocoding token |
| `RESEND_API_KEY` | Email — set when domain verified |
| `NEWSLETTER_ADDRESS` | Physical address for CAN-SPAM |
| `NEWSLETTER_FROM` | Verified Resend sender |
| `REDIS_URL` | DO Managed Redis (for rate limiting at multi-instance scale — optional at launch) |

### Deploy steps

1. `npm run db:backup` on DO database (via admin panel backup button)
2. Push code to GitHub (founder approves this, not Claude)
3. DO App Platform auto-deploys on push (build chain: `run-migrations.ts` → `db:push` → `setup:search` → `next build`)
4. After deploy: spot check 10 pages live
5. Restrict Mapbox token to `injector.world/*` in Mapbox dashboard
6. Lock DO DB firewall to App Platform IP only
7. Submit sitemap to Google Search Console
8. Announce

---

## 7. Launch gate (must pass before going live)

Run `docs/DONE.md` checklist plus these launch-specific items:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` green
- [ ] All 4 live states have at least 5 providers + 2 clinics in the DB
- [ ] `/botox` Injectors tab: shows providers from Houston/NYC/LA
- [ ] `/botox` Clinics tab: shows clinics with Botox in `treatmentsOffered`
- [ ] `/botox/houston-tx` city directory: shows Houston providers + clinics
- [ ] `/injectors/houston-tx/[slug]` provider profile: loads, booking form works
- [ ] `/clinics/houston-tx/[slug]` clinic page: loads
- [ ] Old URLs (`/injectors/[slug]`, `/clinics/[slug]`) redirect correctly
- [ ] Sitemap includes new city-scoped URLs, excludes non-live markets
- [ ] robots.txt: non-live markets noindex
- [ ] Search: typing "botox houston" returns Houston providers
- [ ] Maps: pins show on city directory pages
- [ ] Dark mode: every changed page looks correct
- [ ] Mobile 390px: no overflow, no broken layouts
- [ ] No em dashes in any copy
- [ ] No `console.error` in browser dev tools on main pages
- [ ] Booking form: submits successfully (test with a real email)
- [ ] DO DB firewall locked
- [ ] Mapbox token domain-restricted
- [ ] Google Search Console: sitemap submitted

---

## 8. Post-launch (next chat, after data is in)

- AdSense: set up after site has 3+ months of real content (Google approval timeline)
- `/zip/[code]` SEO landing pages (Phase 14 deferred scope)
- Multi-instance: migrate rate limiter to DO Managed Redis
- More markets: Phase 2 cities (Chicago, Miami, Dallas, Atlanta...)
- Patient reviews: let patients leave reviews from profile page

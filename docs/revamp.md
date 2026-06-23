# injector.world — Complete Revamp Spec (FINAL)

**Status:** Locked — execute phase by phase on founder instruction only.
**Locked:** 2026-06-23
**Owner:** rkumar0101

Single source of truth. Do not deviate without updating this doc first.

---

## PART 1 — URL ARCHITECTURE

### 1.1 Complete URL map

```
TREATMENT PATH (SEO — indexed)
/treatments                               All treatments grid
/[treatment]                              Treatment pillar       e.g. /botox
/[treatment]/[state]                      Treatment × State      e.g. /botox/texas
/[treatment]/[state]/[city]               Money page             e.g. /botox/texas/houston

FIND PATH (UX — indexed for live markets)
/[state]                                  State hub              e.g. /new-york
/[state]/[city]                           City hub               e.g. /new-york/new-york-city
/[state]/[city]/[neighborhood]            Neighborhood hub       e.g. /new-york/new-york-city/upper-east-side

PROFILES
/injectors/[state]/[city]/[slug]          Provider profile
/clinics/[state]/[city]/[slug]            Clinic profile

BRANDS (unchanged)
/brands/[slug]

STATIC (unchanged)
/treatments, /guides, /news, /search, /quiz, /pricing,
/questions, /login, /register, /logout, /forgot-password,
/reset-password/[token], /verify-email/[token],
/dashboard, /dashboard/provider, /dashboard/clinic, /dashboard/brand,
/claim/[type]/[slug], /admin, and all static pages
```

### 1.2 City slug migration

State suffix completely removed. State is already in the URL path — suffix is redundant.

| Old slug | New slug |
|---|---|
| `new-york-ny` | `new-york-city` |
| `houston-tx` | `houston` |
| `los-angeles-ca` | `los-angeles` |
| `chicago-il` | `chicago` |
| `miami-fl` | `miami` |
| `dallas-tx` | `dallas` |
| `san-francisco-ca` | `san-francisco` |
| `san-diego-ca` | `san-diego` |
| `austin-tx` | `austin` |
| `brooklyn-ny` | `brooklyn` |
| `seattle-wa` | `seattle` |
| `boston-ma` | `boston` |
| `phoenix-az` | `phoenix` |
| `atlanta-ga` | `atlanta` |
| `denver-co` | `denver` |
| `las-vegas-nv` | `las-vegas` |
| `washington-dc` | `washington-dc` (no change) |

Duplicate city names (e.g. Portland OR vs Portland ME): state is in URL path, so city slug is just `portland`. No suffix needed — `/botox/oregon/portland` vs `/botox/maine/portland` is unambiguous.

**Migration script:** `scripts/migrate-city-slugs.ts`
- Updates all Location records where `kind = city/metro`
- Updates `citySlug` field on all Providers + Clinics records
- Updates seed scripts

### 1.3 NO redirects from old URLs

Old URLs return 404. No 301 redirect logic. Fake data is being wiped and real data will be imported fresh — no SEO value to preserve. Codebase stays clean.

### 1.4 Route resolver — new logic

**File:** `lib/route-resolver.ts`

```
Old route types — DELETE:
  city-directory  (was 2-segment treatment+city  e.g. botox+new-york-ny)
  city-hub        (was 1-segment city             e.g. new-york-ny)
  neighborhood    (was 3-segment treatment+city+neighborhood)

New route types:
  1 segment:  treatment                    → treatment-pillar
  1 segment:  state                        → state-hub
  2 segments: treatment + state            → treatment-state
  2 segments: state + city                 → city-hub  (Find path)
  3 segments: treatment + state + city     → city-directory  (money page)
  3 segments: state + city + neighborhood  → neighborhood-hub  (Find path)
```

### 1.5 Profile route folder changes

```
OLD:  app/(frontend)/injectors/[city]/[slug]/page.tsx
NEW:  app/(frontend)/injectors/[state]/[city]/[slug]/page.tsx

OLD:  app/(frontend)/clinics/[city]/[slug]/page.tsx
NEW:  app/(frontend)/clinics/[state]/[city]/[slug]/page.tsx
```

### 1.6 lib/city-slug.ts — DELETE

This file computed `new-york-ny` from city+state strings. With new clean slugs, city slugs come directly from Location records. Delete file. Remove all imports.

### 1.7 Sitemap changes

`app/sitemap.ts`:
- Remove: 2-segment treatment+city paths
- Remove: 1-segment city paths (cities now at 2 segments under state)
- Add: 3-segment treatment+state+city paths
- Add: 2-segment state+city paths (Find hubs)
- Add: 3-segment state+city+neighborhood paths

---

## PART 2 — PROMOTIONS REBUILD

### 2.1 Core decision

**One Promotions collection** covering both Treatment path and Find path. Old Promotions code deleted entirely. New clean implementation.

### 2.2 What gets deleted (old code)

```
collections/Promotions.ts                 DELETE — replace with new
lib/promotion-queries.ts                  DELETE — replace with lib/promotions.ts
components/shared/SponsoredProviderCard.tsx   DELETE
components/shared/AdBanner.tsx            DELETE
```

All imports of the above across all files — remove.

### 2.3 New promotion scopes

```
national            All directory pages sitewide
treatment           /[treatment] + all sub-pages
state               /[state]  (Find path)
city                /[state]/[city]  (Find path)
treatment+state     /[treatment]/[state]
treatment+city      /[treatment]/[state]/[city]  (money page)
```

ZIP scope and body-area scope are NOT included (explained: these were old unused targeting options — ZIP targeting = Phase 14 deferred, body-area targeting = concept abandoned).

### 2.4 Placement types

```
banner          Top-of-page ad banner. Max 1 active per scope. Needs image + link.
sponsored-card  Card in listing grid labeled "Sponsored". Max 3 per scope.
                Can promote a provider (shows in Providers tab) OR a clinic (shows in Clinics tab).
featured-pin    Pinned to position 1-3 of organic list, labeled "Featured".
                Max 3 per scope. Admin-curated.
```

### 2.5 New Promotions collection fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | text | yes | Internal label e.g. "Botox Houston Q3 2026" |
| `status` | select | yes | draft / active / paused / expired |
| `placement` | select | yes | banner / sponsored-card / featured-pin |
| `scope` | select | yes | national / treatment / state / city / treatment+state / treatment+city |
| `treatment` | → Treatments | if scope has treatment | |
| `state` | → Locations (kind=state) | if scope has state | |
| `city` | → Locations (kind=city/metro) | if scope has city | |
| `provider` | → Providers | required for sponsored-card + featured-pin | |
| `clinic` | → Clinics | optional — promote clinic instead of provider | |
| `bannerImage` | → Media | required for banner | |
| `bannerLinkUrl` | text | required for banner | |
| `bannerAltText` | text | for banner | Accessibility |
| `featuredRank` | number 1-3 | for featured-pin | Lower = higher position |
| `startDate` | date | no | |
| `endDate` | date | no | Blank = no expiry. Auto-expires when past. |
| `notes` | textarea | no | Billing/contact notes |

**Validation (beforeChange hook):**
- `sponsored-card` / `featured-pin`: provider OR clinic required (one must be set)
- `banner`: bannerImage + bannerLinkUrl required
- Slot guard: count active promos for this scope+placement combo. Block if exceeds max.
- Scope field validation: state/city fields must match the chosen scope type

### 2.6 New lib/promotions.ts

```typescript
getActiveBanner(scope, treatmentId?, stateId?, cityId?)
  → ActiveBanner | null

getSponsoredProviders(scope, treatmentId?, stateId?, cityId?)
  → SponsoredProvider[]   // max 3, sorted by rank

getSponsoredClinics(scope, treatmentId?, stateId?, cityId?)
  → SponsoredClinic[]     // max 3, sorted by rank

getFeaturedProviderPins(scope, treatmentId?, stateId?, cityId?)
  → Map<providerId, rank>

getFeaturedClinicPins(scope, treatmentId?, stateId?, cityId?)
  → Map<clinicId, rank>

getPromotionCoverage()
  → PromotionCoverageMap  // used by admin dashboard
```

### 2.7 How promotions appear on pages

**Treatment money page** `/botox/texas/houston`:
- Banner (scope=treatment+city) at top
- Sponsored clinics (scope=treatment+city) in Clinics tab — labeled "Sponsored"
- Sponsored providers (scope=treatment+city) in Providers tab — labeled "Sponsored"
- Featured pins hoist specific providers/clinics to top of organic list

**Find city hub** `/texas/houston`:
- Banner (scope=city) at top
- Sponsored clinics (scope=city) in Clinics tab
- Sponsored providers (scope=city) in Providers tab
- Featured pins work same way

**State hub, treatment pillar, treatment×state** — same pattern with respective scope.

---

## PART 3 — ADMIN PANEL REBUILD

### 3.1 Dashboard layout (complete spec)

**Top row — 5 clickable stat cards:**
- Total active providers → `/admin/collections/providers`
- Total active clinics → `/admin/collections/clinics`
- Open DataAlerts (critical N / warning N / info N) → alerts page
- Active promotions running right now → `/admin/collections/promotions`
- Unactioned leads (new bookings) → `/admin/collections/bookings`

**Section: Promotions Coverage Map**

Two tabs: **Treatment Path** | **Find Path**

*Treatment Path tab:*
- Grid: rows = live treatments, columns = live states
- Each cell = how many active promotions for that treatment×state scope
- Color: green (has active promo), yellow (expiring in 7 days), gray (none)
- Click cell → slide-open panel: active promotions for that scope + "Add promotion" button
- Sub-row expandable: shows treatment×city coverage for cities in that state

*Find Path tab:*
- Grid: rows = live states, columns = Placement types (Banner / Sponsored / Featured)
- Each cell = active promo count
- Expandable: shows city-level coverage within each state
- Click any cell → active promotions + "Add promotion" button

**Section: Data Import + Review Moderation (combined)**

Sub-section: Bulk Import
- File picker supports: combined CSV (record_type column) OR separate files
- 5 separate CSV types: Clinics / Providers / Reviews / Photos / Q&A
- Dry-run toggle (ON by default) — always preview before commit
- "Run for real" button enabled only after dry-run passes
- Progress indicator during upload
- Results summary: X inserted, X updated, X skipped, X errors (each expandable)
- DataAlerts created automatically for issues found

Sub-section: Review Queue (post-import)
- Shows all records imported but not yet reviewed
- Tabs: Clinics | Providers | Reviews
- Each record shows: all fields, missing fields highlighted in yellow (warning, not block)
- Admin can review and publish at their own discretion — system does not block
- Bulk approve selected / approve individual
- Filter: all / pending review / approved / rejected

**Section: Content Review + Drip Indexer (existing, keep)**
- Guides review
- News review
- Drip indexer

**Section: Leads + Claims + Newsletter (existing, keep)**
- New bookings
- Pending claims
- Newsletter broadcast

**Section: Data Tools + Danger Zone (existing, keep)**
- Backup
- Re-scan alerts
- Wipe (with typed confirm + auto-backup)

### 3.2 Payload sidebar order

```
DIRECTORY
  Providers
  Clinics
  Brands

CONTENT
  Guides
  News
  FAQs
  Treatments
  Locations

MONETIZATION
  Promotions

USERS & OPS
  Users
  Claims
  Bookings
  Subscribers
  Reviews

MEDIA
  Media
  Photos
  Before/After Cases
  Video Testimonials
  Social Posts

SYSTEM
  DataAlerts
  AuditLogs
  QA (Questions & Answers)
  ZipCodes
```

---

## PART 4 — PAGE REDESIGNS

### 4.1 Treatment pillar — `/botox`

- Hero: treatment name, tagline, trust signals (X providers verified, Y reviews)
- **IP-based state hint (client-side ONLY):** JS detects state via IP → "Showing results near New York. Change: [dropdown]". Server renders fixed default state always. Google always sees same content. No cloaking.
- Top 6 providers for default state (server-rendered, merit order)
- Top 6 clinics for default state
- "Browse by state" grid → links to `/botox/texas`, `/botox/new-york`
- Injectors + Clinics tabs, 12 per page, Load More
- **Cost estimator lives HERE** — not on city pages
- Treatment overview, FAQs, guide CTA
- Promotions: banner (scope=treatment) + sponsored items

### 4.2 Treatment × State — `/botox/texas`

- Hero: "Botox in Texas" + provider count, clinic count
- Breadcrumb: Home / Botox / Texas
- Top 6 providers (merit order)
- Top 6 clinics (merit order)
- Browse by city grid → links to `/botox/texas/houston` (3-level)
- City card: city name + provider count for this treatment
- FAQs (treatment × state)
- Promotions: banner (scope=treatment+state) + sponsored items
- NO cost estimator

### 4.3 Treatment × City — money page — `/botox/texas/houston`

- Hero: "Botox in Houston, TX" + verified count + trust badges (License verified, Real patient reviews)
- Breadcrumb: Home / Botox / Texas / Houston
- Clinics tab (default) + Providers tab — counts on each tab label
- Map toggle: List / Map — map shows pins for both
- Sponsored clinics at top of Clinics tab (labeled "Sponsored")
- Sponsored providers at top of Providers tab (labeled "Sponsored")
- Featured pins hoist to top of organic section
- Organic list: merit order
- Load More (12 per batch)
- Browse by neighborhood → clickable pill links to `/botox/texas/houston/montrose` + Load More if >8
- Right sidebar (desktop only):
  - "Explore more": All Botox (`/botox`), Botox in Texas (`/botox/texas`), All in Houston (`/texas/houston`)
  - NO cost estimator
- FAQs (treatment × city)
- noindex if providers + clinics combined < 5

### 4.4 State hub (Find path) — `/new-york`

- Hero: "Find an injector in New York" + total provider count + total clinic count
- Breadcrumb: Home / New York
- Treatment filter chips: "All | Botox | Dysport | Lip Filler | ..." — client-side, filters list in-place (does NOT navigate)
- Clinics tab (default) + Providers tab
- Sponsored clinics/providers at top (scope=state)
- Organic list: merit order
- Map (both clinics + providers as pins)
- Load More (12 per batch)
- Browse by city grid → `/new-york/new-york-city`, `/new-york/buffalo`
  - City card: city name + total provider count + total clinic count
- Browse by treatment grid → `/botox/new-york`, `/dysport/new-york` (SEO internal linking)
- FAQs

### 4.5 City hub (Find path) — `/new-york/new-york-city` — FULL REWRITE

Currently: "pick a treatment" page with no providers/clinics. Complete rebuild.

- Hero: "Aesthetic injectors in New York City" + total counts + trust badges
- Breadcrumb: Home / New York / New York City
- Treatment filter chips: "All | Botox | Dysport | ..." — client-side filter. When treatment selected → one line appears: "View full Botox directory →" linking to `/botox/new-york/new-york-city`
- Clinics tab (default) + Providers tab — counts on each tab
- Sponsored clinics/providers at top (scope=city)
- Organic: merit order
- Map toggle: List / Map
- Load More (12 per batch)
- Browse by neighborhood → clickable pill links to `/new-york/new-york-city/upper-east-side` + Load More if >8
- Right sidebar: "Explore more" — All in New York (`/new-york`), All injectors (`/injectors`)
- FAQs

### 4.6 Neighborhood hub (Find path) — NEW PAGE

`/new-york/new-york-city/upper-east-side`

- Hero: "Injectors near Upper East Side, New York City"
- Breadcrumb: Home / New York / New York City / Upper East Side
- Treatment filter chips (client-side, same as city hub)
- Clinics + Providers tabs
- Map (zoomed to neighborhood bounds)
- Load More
- Back to New York City link

### 4.7 Provider profile — URL update only

- New: `/injectors/new-york/new-york-city/dr-lena-park-md`
- Route file: `app/(frontend)/injectors/[state]/[city]/[slug]/page.tsx`
- Content: unchanged

### 4.8 Clinic profile — URL update only

- New: `/clinics/new-york/new-york-city/park-avenue-derm`
- Route file: `app/(frontend)/clinics/[state]/[city]/[slug]/page.tsx`
- Content: unchanged

---

## PART 5 — CLINIC CARD REDESIGN

Used everywhere: state hub, city hub, treatment pages, homepage, /clinics.

```
┌─────────────────────────────────────┐
│  [Cover photo 16:9]          [Save] │
│  [MedSpa] chip                      │
├─────────────────────────────────────┤
│  Park Avenue Dermatology            │
│  📍 Upper East Side, New York, NY  │
│  ★★★★½  4.8  (127 reviews)        │
│  Est. 2014   ●  In-Person          │
│  [Botox] [Lip Filler] [Dysport]    │
│  4 providers  ·  From $350         │
│                                     │
│  [        View clinic        ]      │
└─────────────────────────────────────┘
```

Fields required:
- Cover photo (full bleed 16:9, fallback gradient if no photo)
- Bookmark/save icon (top-right of photo)
- Clinic type chip: MedSpa / Dermatology / Plastic Surgery / Dental Aesthetics
- Clinic name (bold, serif)
- City, State (with pin icon)
- Star rating + review count
- Year established ("Est. 2014")
- Service type: In-Person / Virtual / Both
- Top 3 treatments (chips, overflow hidden)
- Provider count
- Starting price (if set)
- "View clinic" CTA (full width bottom)

---

## PART 6 — HOMEPAGE CHANGES

### 6.1 Top Clinics section

- Position: after "Top Providers" section (or replace it — to be decided at build time)
- 3-column grid, 6 cards (new DirectoryClinicCard)
- Data: `getTopClinics()` — top 6 nationally by merit score
- "View all clinics →" → `/clinics`

### 6.2 Browse-by-State links

Update all state links on homepage from `/botox/new-york` format to `/new-york` (state hub).

### 6.3 Hero search results

- Provider result → `/injectors/[state]/[city]/[slug]`
- Clinic result → `/clinics/[state]/[city]/[slug]`
- "View in [City]" quick link → `/[state]/[city]`

---

## PART 7 — AUTH SYSTEM + ALL DASHBOARDS

### 7.1 Auth pages

| Page | URL | Notes |
|---|---|---|
| Login | `/login` | Clean card UI. Email + password. Inline errors. Role-based redirect on success. |
| Register | `/register` | Separate flows: Patient (simple) / Provider (with license info) / Clinic (with business info). Role selection on first screen. |
| Logout | Button in header | Clears session → redirect to `/` |
| Forgot password | `/forgot-password` | Enter email → reset link sent |
| Reset password | `/reset-password/[token]` | Token from email. New password form. |
| Verify email | `/verify-email/[token]` | Auto-verifies on page load. Redirect to dashboard on success. |

**Role-based redirect after login:**
```
patient  → /dashboard
provider → /dashboard/provider
clinic   → /dashboard/clinic
brand    → /dashboard/brand
admin    → /admin
editor   → /admin
```

### 7.2 Patient Dashboard — `/dashboard`

- Saved providers (from localStorage + account sync)
- Saved clinics
- Booking history (past bookings + status)
- Profile settings (name, email, change password)
- Email preferences (newsletter opt in/out)

### 7.3 Provider Dashboard — `/dashboard/provider`

- Welcome + onboarding checklist
- Profile editor (photo, bio, treatments, pricing, languages, credentials)
- "View public profile" → `/injectors/[state]/[city]/[slug]`
- Bookings/leads (list, mark as actioned)
- Analytics: profile views, bookmark count (tier-gated)
- Subscription tier + upgrade CTA
- Social links (tier-gated)
- Before/after photos (tier-gated)
- Claim status (if claimed via claim flow)

### 7.4 Clinic Dashboard — `/dashboard/clinic`

- Clinic profile editor (name, photos, treatments, hours, contact)
- "View public page" → `/clinics/[state]/[city]/[slug]`
- Providers list (who practices here)
- Bookings/leads
- Analytics: page views, bookmark count
- Subscription tier + upgrade CTA

### 7.5 Brand Dashboard — `/dashboard/brand`

- Brand overview (all locations map)
- Each location (clinic): status, provider count, booking count
- Aggregate analytics across all locations
- Brand profile editor (logo, description)
- "View brand page" → `/brands/[slug]`

### 7.6 Claim flow — `/claim/[type]/[slug]`

- type = `provider` or `clinic`
- Slug resolution updated for new URL format
- Step 1: Enter license number + verify ownership
- Step 2: Contact details + notes
- Step 3: Submitted confirmation
- On submit → Claim record in Payload + email to admin/founder (via Resend)

---

## PART 8 — EMAIL SYSTEM (RESEND)

Founder provides `RESEND_API_KEY`. Email wiring is Phase G — after all other phases.

### 8.1 All email triggers

| Trigger | Recipients | Template |
|---|---|---|
| New booking submitted | Patient (confirmation) | `booking-patient` |
| New booking submitted | Provider (new lead) | `booking-provider` |
| New booking submitted | Admin + Founder | `booking-admin` |
| New claim submitted | Admin + Founder | `claim-admin` |
| Claim approved | Provider/Clinic | `claim-approved` |
| New user signup | User | `email-verify` (verification link) |
| Email verified | User | `welcome` |
| Password reset request | User | `password-reset` (reset link) |
| Newsletter signup | Subscriber | `newsletter-confirm` (double opt-in link) |
| Newsletter confirmed | Subscriber | `newsletter-welcome` |
| Critical DataAlert | Admin + Founder | `alert-critical` (optional, toggleable) |

### 8.2 Environment variables needed

```
RESEND_API_KEY=re_xxxxx
RESEND_FROM=bookings@injector.world
ADMIN_EMAIL=admin@injector.world
FOUNDER_EMAIL=rishavkumarkarn3@gmail.com
NEWSLETTER_ADDRESS=[physical address — required for CAN-SPAM before any live send]
```

### 8.3 Email setup checklist

- [ ] Founder sets RESEND_API_KEY in .env.local + DO App Platform env
- [ ] Verify sender domain `bookings@injector.world` on Resend dashboard
- [ ] Set all env vars above
- [ ] Test: new booking → 3 emails arrive (patient, provider, admin)
- [ ] Test: claim submit → admin email arrives
- [ ] Test: register → verify email → welcome email flow
- [ ] Test: forgot password → reset link works
- [ ] Test: newsletter signup → confirm → welcome
- [ ] NEWSLETTER_ADDRESS set before any newsletter send (CAN-SPAM)

---

## PART 9 — ANTI-SCRAPING + BOT PROTECTION

### 9.1 CAPTCHA (Cloudflare Turnstile)

Free. GDPR-friendly. Invisible by default — only shows challenge when traffic looks suspicious.

**Package:** `@marsidev/react-turnstile`

**Env vars:**
```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

**Add CAPTCHA to these forms:**
- Booking form (POST /api/bookings)
- Register form (new patient/provider/clinic signup)
- Login form (brute-force protection)
- Claim form (POST /api/claims)
- Contact form
- Newsletter signup (POST /api/newsletter/subscribe)
- Forgot password form

**Server-side validation:** Every form endpoint verifies the Turnstile token before processing. If token missing or invalid → 400 error.

### 9.2 Honeypot fields

Add hidden `<input name="website" style="display:none" tabIndex={-1} />` to all forms. If this field is filled (bots fill it) → silently reject the submission, return fake 200.

### 9.3 Rate limiting (existing + improve)

Existing in-memory RateLimiter on all write endpoints. Verify these limits are set:

| Endpoint | Limit |
|---|---|
| POST /api/bookings | 3 per hour per IP |
| POST /api/questions | 5 per hour per IP |
| POST /api/newsletter/subscribe | 3 per hour per IP |
| GET /api/search/suggest | 30 per minute per IP |
| POST /api/auth/register | 5 per hour per IP |
| POST /api/auth/forgot-password | 3 per hour per IP |

Note: in-memory RateLimiter resets on deploy. For multi-instance → migrate to DO Managed Redis (post-launch, already noted).

### 9.4 API response limiting

Public API endpoints must not return full data dumps:
- `/api/providers` — max 50 per page, require pagination params
- `/api/clinics` — max 50 per page, require pagination params
- `/api/search` — already has limit cap (Phase 12)
- No endpoint should return 1000+ records in one call

### 9.5 robots.txt update

```
User-agent: *
Disallow: /api/
Disallow: /admin/
Allow: /api/search/suggest    (allow — used by search engines for featured snippets)
```

### 9.6 Next.js middleware bot detection

`middleware.ts` — add basic bot detection:
- Block requests with known scraper User-Agent strings (Scrapy, python-requests, curl by default)
- Log suspicious patterns (many requests for provider data, no referrer, sequential slug patterns)
- Return 403 for blocked UAs

### 9.7 No bulk data export endpoints

Confirm no admin route exposes full DB dump to unauthenticated users. All `/api/admin/*` routes require admin role.

---

## PART 10 — BACKEND CHANGES

### 10.1 lib/merit.ts — simplify

Remove:
- `applyMeritOrder(providers, pins, sponsoredIds)` — delete entirely
- All sponsored exclusion logic

Keep + rename:
- `sortByMerit(providers: DirectoryProvider[]) → DirectoryProvider[]` — pure merit sort
- `computeMeritScore()` — unchanged
- `byMeritDesc()` — unchanged

Add:
- `sortClinicsByMerit(clinics: DirectoryClinic[]) → DirectoryClinic[]` — merit sort for clinics based on rating + review count + completeness

### 10.2 lib/location-queries.ts

Add `stateSlug: string` to `DirectoryProvider` and `DirectoryClinic` types.
Remove `citySlug` computation via `toCitySlug()` — city slug now comes from Location record lookup.
`getCityHub()` — add providers + clinics queries (currently returns nothing useful for listings).
Add `getNeighborhoodHub(stateSlug, citySlug, neighborhoodSlug)` — new query for neighborhood hub page.

### 10.3 Bulk import — city slug resolution

`scripts/import-providers.ts` + admin CSV upload:
- When CSV has `city="Houston"` + `state="TX"` → look up Location record by name + state → get slug `houston`
- Do NOT use `toCitySlug()` (file deleted)
- If Location not found → create DataAlert `missing_location`, skip record

### 10.4 DataAlerts — update

After Promotions rebuild, update scan (`scripts/scan-data-alerts.ts`):
- Remove old zip-promotion and body-area alert types
- Add: `promotion_slot_exceeded` — scope has more active promos than allowed
- Add: `promotion_expiring_soon` — promotion endDate within 7 days

### 10.5 Collections — final list

DELETE: none (all collections stay)
REBUILD: Promotions (new schema, see Part 2)
EVERYTHING ELSE: unchanged

---

## PART 11 — EXECUTION PHASES

Strict order. Each phase is one focused implementation session. Do not skip or reorder.

### Phase A — URL + Slug Foundation
All routing changes. Everything depends on this.

Tasks:
1. Write `scripts/migrate-city-slugs.ts` — update all Location slugs in DB
2. Run migration on local DB
3. Rewrite `lib/route-resolver.ts` — new route types + logic
4. Rewrite `app/(frontend)/[...path]/page.tsx` — new route handlers, remove old ones
5. Rename `app/(frontend)/injectors/[city]/` → `app/(frontend)/injectors/[state]/[city]/[slug]/`
6. Rename `app/(frontend)/clinics/[city]/` → `app/(frontend)/clinics/[state]/[city]/[slug]/`
7. Delete `lib/city-slug.ts` + remove all imports
8. Update `lib/location-queries.ts` — add stateSlug field, update getCityHub, add getNeighborhoodHub
9. Update `app/sitemap.ts` — new paths
10. `npx tsc --noEmit` clean, `npm run build` passes, spot-check 10 pages

### Phase B — Promotions Rebuild
Clean slate on monetization.

Tasks:
1. Delete `collections/Promotions.ts`, `lib/promotion-queries.ts`, `SponsoredProviderCard.tsx`, `AdBanner.tsx`
2. Write new `collections/Promotions.ts` per Part 2 spec
3. Write new `lib/promotions.ts` with new query functions
4. Simplify `lib/merit.ts` per Part 10 spec
5. Remove all old promotion imports from all page components
6. Wire new promotion queries into page components
7. `npm run db:push` + `npm run generate:types`
8. `npx tsc --noEmit` clean

### Phase C — Page Redesigns
All directory pages rebuilt.

Tasks:
1. Rewrite `components/pages/CityHubPage.tsx` — full rebuild (providers+clinics+treatment filter+map+neighborhoods+Load More)
2. Update `components/pages/StateHubPage.tsx` — treatment filter chips, city grid with counts
3. New `components/pages/NeighborhoodHubPage.tsx`
4. Update `components/pages/TreatmentPillarPage.tsx` — IP hint client-side, links update
5. Update `components/pages/TreatmentStatePage.tsx` — city links to 3-level URLs
6. Update `components/pages/CityDirectoryPage.tsx` — remove cost estimator, fix Explore more, neighborhood links+Load More
7. Rewrite `components/shared/DirectoryClinicCard.tsx` — new design per Part 5 spec
8. Update `components/shared/DirectoryProviderCard.tsx` — remove sponsored badge, clean
9. All pages: dark mode check, mobile check

### Phase D — Homepage
Tasks:
1. Add `getTopClinics()` to `lib/home-queries.ts`
2. Add Top Clinics section to `app/(frontend)/page.tsx`
3. Update Browse-by-State links → state hub URLs
4. Update hero search result links → new URL format

### Phase E — Admin Rebuild
Tasks:
1. Rewrite `components/admin/DashboardWidget.tsx`:
   - New stat cards row
   - Promotions coverage map component (Treatment Path tab + Find Path tab)
   - Combined Data Import + Review Queue sections
   - All existing sections aligned to new plan
2. Reorder Payload sidebar groups in `payload.config.ts`
3. Update bulk import city slug resolution (remove toCitySlug dependency)
4. Update DataAlerts scan — new promo alert types
5. Verify bulk import works end-to-end: upload test CSV → dry-run → commit → verify records

### Phase F — Auth + Dashboards
Tasks:
1. Rebuild `/login` page — clean card UI, role-based redirect
2. Build `/register` page — patient / provider / clinic flows
3. Build `/forgot-password` + `/reset-password/[token]` pages
4. Build `/verify-email/[token]` page
5. Add logout to header (clear session + redirect)
6. Build patient dashboard `/dashboard`
7. Update provider dashboard `/dashboard/provider` — fix profile links to new URL format
8. Build clinic dashboard `/dashboard/clinic`
9. Build brand dashboard `/dashboard/brand`
10. Update `/claim/[type]/[slug]` — slug resolver for new URL format
11. Verify entire auth flow end-to-end

### Phase G — Email Wiring
Requires RESEND_API_KEY from founder before starting.

Tasks:
1. Set up Resend sender domain `bookings@injector.world`
2. Set all email env vars
3. Write email templates (booking-patient, booking-provider, booking-admin, claim-admin, claim-approved, email-verify, welcome, password-reset, newsletter-confirm, newsletter-welcome, alert-critical)
4. Wire templates to triggers
5. Test all flows end-to-end

### Phase H — Anti-Scraping + Bot Protection
Tasks:
1. Install `@marsidev/react-turnstile`
2. Add Turnstile to all 6 forms (booking, register, login, claim, contact, newsletter)
3. Server-side Turnstile token validation on all form endpoints
4. Add honeypot fields to all forms
5. Verify rate limits on all write endpoints
6. Update `robots.txt` (Disallow /api/ with Allow exception for suggest)
7. Update `middleware.ts` — bot detection (block known scraper UAs)
8. Verify no unauthenticated bulk data endpoints

### Phase I — Final QA
Tasks:
1. `npx tsc --noEmit` — zero errors
2. `npm run build` — passes
3. Spot-check 15+ pages across all route types
4. Dark mode: every changed page
5. Mobile 390px: no overflow
6. Auth flow: register → verify → login → dashboard → logout
7. Booking form: submit with CAPTCHA → emails arrive
8. Promotions: create test promotion → verify it shows on correct page
9. Bulk import: upload test CSV → dry-run → commit → verify
10. Claim flow: submit → admin email arrives
11. Old URL slugs (e.g. `/injectors/houston-tx/slug`) return 404 (no redirect, clean)
12. No `console.error` in browser on main pages

### Phase J — Real Data Import
After Phase I passes.

1. `npm run db:backup`
2. Admin → Wipe all (typed confirm)
3. Upload Houston clinics + providers + reviews CSV → dry-run → fix DataAlerts → commit
4. Upload NYC batch → commit
5. Upload LA batch → commit
6. `npm run set:live` — CA/TX/NY/FL
7. `npm run scan:alerts` — clean
8. Spot check: `/botox/texas/houston`, `/texas/houston`, `/injectors/texas/houston/[slug]`
9. Verify at least 1 promotion shows on a live page

---

## PART 12 — LAUNCH GATE

Must all pass before DNS cutover to injector.world:

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` green
- [ ] All 4 live states: min 5 providers + 2 clinics
- [ ] `/botox/texas/houston` loads, clinics + providers show correctly
- [ ] `/texas/houston` city hub: treatment filter chips work, clinics + providers show
- [ ] `/texas/houston/montrose` neighborhood hub loads
- [ ] `/injectors/texas/houston/[slug]` provider profile + booking form works
- [ ] Booking form: CAPTCHA visible, submit works, 3 emails arrive (patient + provider + admin)
- [ ] Register → verify email → login → correct dashboard → logout
- [ ] Password reset flow works end-to-end
- [ ] Claim form: CAPTCHA + submit → admin email arrives
- [ ] At least 1 promotion shows on a live money page
- [ ] Old city slug URLs (e.g. `/injectors/houston-tx/slug`) return 404
- [ ] Sitemap has 3-level treatment paths, excludes non-live markets
- [ ] robots.txt correct
- [ ] Dark mode: no broken colors
- [ ] Mobile 390px: no overflow
- [ ] No em dashes in any copy
- [ ] No `console.error` in browser
- [ ] DO DB firewall locked
- [ ] Mapbox token restricted to injector.world/*
- [ ] Turnstile site key points to production domain
- [ ] NEWSLETTER_ADDRESS set (CAN-SPAM)
- [ ] Google Search Console: sitemap submitted

---

## PART 13 — POST-LAUNCH

- Monetization rate card: pricing for sponsored cards + banner placements
- `/zip/[code]` SEO landing pages (Phase 14)
- Patient reviews from profile page
- More markets (Chicago, Miami, Dallas, Atlanta...)
- Multi-instance rate limiter (DO Managed Redis)
- AdSense application (after 3+ months real content)
- Analytics dashboard upgrade (more detailed provider/clinic analytics)

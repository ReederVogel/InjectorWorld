# injector.world — Audit Findings (2026-06-09)

Full audit across code, data, schema (all 20 collections field-by-field), security, SEO/AEO/GEO,
UX, legal, ops, scalability, forms, and page SSR. Three deep passes. This is the base for the
forward plan. Severity: 🔴 launch-blocker · 🟡 important · 🟢 cleanup. ✅ = verified working.

> Note: some live re-verification was unreliable due to the local dev server (cold-compile +
> .next thrashing when multiple servers run). Findings below are from code+data+targeted live tests.

---

## 🔴 Launch-blockers

### Legal / trust (claims we can't back up)
- **[STILL OPEN — founder kept as-is 2026-06-09] Reviews marked "verified" but aren't.**
  `Reviews.verified` defaults `true`, and the importer sets `verified:true` on every row — including
  reviews scraped from Google/Yelp/Healthgrades (`sourcePlatform`). Scraping third-party reviews +
  republishing + labelling "verified" is a ToS + false-advertising risk. Founder chose to leave it
  for now; MUST be revisited before public launch (Phase 12) with real provenance or honest labels.
- **[FIXED 2026-06-09] "License verified" badge without verification.** Now `lib/license.ts#licenseClaim`
  shows "License verified" only when a `licenseVerificationUrl` (state-board record) exists, else the
  neutral "License on file". Board URL linked from the provider profile. Applied to all per-provider
  badges (cards + profile) and the profile meta description.
- **[FIXED 2026-06-09] "No paid rankings" / "Real patient reviews" copy.** Removed the "no paid
  rankings" claim from every user-facing surface (Hero, PreFooter, StateHub, Neighborhood,
  CityDirectory desc + trust chip, catch-all metadata, careers, llms.txt). We sell sponsored cards +
  ad banners, so the blanket claim was FTC exposure. Sponsored labelling disclosure kept.
- **[FIXED 2026-06-09] Before/after + photos without confirmed consent.** Homepage "Real Patient
  Stories" now filters `consentGranted === true` (provider profile was already gated). `Photos`
  collection is not rendered on the frontend yet, so no current display risk (gate when a gallery
  ships).

### Security
- **Rate limiting is in-memory `Map`** — resets every deploy and is per-instance. On multi-instance
  (Railway/DO scale) it does not share → abuse/DoS window. Move to Redis before scaling.
- (Fixed this session: cookie-auth, Bookings PII access, admin-panel access, claim-spam create:false,
  import 20 MB cap. See DECISIONS 2026-06-09.)

### Broken / missing core UX
- **State hub (`/new-york`) lists NO providers** — only treatment + city grids. A visitor landing
  there sees zero actual injectors. Add a "top providers in this state" section.
- **No header search on desktop.** The search icon is `md:hidden` (mobile only); full search lives
  only in the homepage hero. Every inner page on desktop has no way to search.
- **9 clinics are invisible.** Clinics in Orlando, Tampa, Buffalo, Brooklyn, Fort Worth, San Antonio,
  Sacramento, Beverly Hills have no matching metro `Location` → their providers never appear on any
  city page. Add the metros (or a fallback) — see Phase 4.
- **`/injectors` index loads all 218 providers + map with no pagination** → a real scale concern
  (will not scale to thousands). Needs pagination + server search (Phase 5). NOTE: the 000/timeouts
  seen during the sweep were dev-server contention (two test loops hammering a cold-compiling dev
  server), NOT a confirmed runtime break — every page TYPE returned 200 when not contended.

### Ops / production
- **Media uploads are ephemeral.** `Media` stores to local disk (`../media`, gitignored); DO Spaces
  not wired (Phase 7). On Railway the filesystem is ephemeral → any admin-uploaded image disappears
  on the next deploy/restart.

---

## 🟡 Important

### Admin / operator usability + warnings
- **Promotions validation gaps:** `provider` is `required:false` → a sponsored-card/organic-pin can be
  saved with no provider (renders broken). A banner can be saved with no image. Scope fields
  (treatment/location) aren't validated for their scopeType. **Expired promos** (endDate passed,
  active=true) are not auto-deactivated or flagged. DataAlerts has no type for these promotion-health
  cases.
- **Banner image spec mismatch.** Field says "1200 × 160 px" (7.5:1) but `AdBanner` renders 6:1 →
  crop/squish. No format/size enforcement.
- **Admin UX is bare.** Field descriptions are minimal, no guided flow, no "how to" for operators,
  several dead fields (below) clutter the panel.
- **Q&A has no revalidate hook** → answering/publishing a question in admin doesn't refresh
  `/questions` immediately (stale up to ISR window).

### Dead / unwired schema (exists in DB + admin, does nothing)
- **Brands** collection (whole) — no frontend, no brand pages; the importer doesn't even populate it.
- **Providers.additionalClinics** (multi-clinic) — never rendered.
- **subscriptionTier / subscriptionStatus** on providers/clinics/brands — no gating logic (Phase 9).
- **Users.savedProviders / savedClinics** — no save feature (Phase 8).
- These are intentional Phase-1 scaffolding but currently confuse operators and add noise.

### Data integrity (fake-data residue + model)
- 6 providers missing profile photo; 6 reviews with no provider (ghost-row fault data) live in DB.
- **Provider has no own city** — location derives from `clinic`; with multi-clinic the "where is this
  provider" answer is ambiguous and the card shows it only small in a corner.
- Seed's hand-curated providers were replaced by the import (all 218 are import-sourced).
- `aggregateRating` is a free number (no 0–5 clamp).

### Engineering / scale
- **No DB migrations** — schema changes rely on `push` (Drizzle introspection). Risky for prod schema
  changes (data-loss prompts). Need a migration strategy before real data.
- **`getCityDirectory` runs several sequential queries**; no pagination anywhere; route-resolver loads
  all locations into memory (fine now, heavy at scale).
- Hero "search" is client-side filtering of a preloaded list, not real search (Phase 5).
- PostGIS installed but unused; distance is browser haversine (Phase 5).

### SEO / AEO / GEO / AIO
- State/city hub pages are thin (weak ItemList/FAQ/structured content) → weak ranking + AEO.
- `llms.txt` is static (doesn't reflect live markets/data).
- (Fixed this session: live-only sitemap, noindex logic, removed dead SearchAction.)

---

## 🟢 Cleanup / cruft
- `scratch/` — `hello.js`, `hello.ts`, `test-render.ts`, `view-alerts.ts` (junk; gitignore or delete).
- `design/figma-build-spec.md`, `design/homepage-plan-plain-english.md`, `mockups/` — historical.
- Dormant Resend email code (behind `RESEND_API_KEY`) — wire it or drop it.
- Stubs: `/forgot-password` (fake), `WaitlistSignup` (saves nothing), `Header` logged-in state
  (`user={null}` — kept stubbed to preserve static rendering; needs client-side `/api/users/me`).
- `CLAUDE.md` stale "Build Status" / "Execution sequence" sections (superseded by docs/ROADMAP).

---

## ✅ Verified working (baseline)
- Most pages return 200 with real content (home, guides, quiz, questions, all money pages,
  coming-soon, static/legal pages, sitemap/robots/llms).
- All treatments × live cities show providers (Botox/Dysport/Lip Filler/Tear-Trough/Kybella/Sculptra).
- Coming-soon + noindex,follow correct; live-only sitemap.
- Forms validate: booking (422 on missing consent), claim (200 / 400 bad id), question (Zod),
  dashboard-save + admin-import (401 unauth, work with cookie after the auth fix).
- Security writes locked: anonymous + patient cannot write providers/reviews (403).
- No dark-mode regression (`text-white` only on accent/always-dark/overlay surfaces).
- Guides render via `RenderLexical` (React nodes) — XSS-safe; `dangerouslySetInnerHTML` only on
  escaped JSON-LD.
- No TODO/FIXME/@ts-ignore; tsc clean; proper DB indexes on searched fields.
- Revalidation hooks make admin edits reflect immediately (after this session's fixes).

---

## Suggested forward buckets (for the new chat)
1. **Truth & Legal** (launch-blocker): reviews "verified", license "verified", "no paid rankings"
   copy, consent-gated before/after, sponsored labelling + disclaimers.
2. **Core UX**: desktop search, state-hub providers, provider location prominence, pagination.
3. **Admin/Ops overhaul**: promotions validation + warnings + expired handling, banner specs,
   operator lead alerts, admin help/guided UX, remove/clearly-label dead schema.
4. **Data/import (Phase 4)**: missing metros, photos/qa importers, single combined CSV, consent flags.
5. **Scale/hardening (Phase 5/12)**: server search + PostGIS, Redis rate-limit, migrations, Media on
   DO Spaces, Sentry, CSP review.

# injector.world — Build Roadmap (claude2.md)

This is the **working build plan**. CLAUDE.md is the locked source of truth for stack, design tokens, URL structure, schema, and brand voice. This file says **what to build next, in what order, and how to know it is done.** When something here is built and shipped, update the "Status" column and move on.

Do not re-derive locked decisions. If it is in CLAUDE.md, it is final. This file only sequences the work.

---

## How to use this file

- Each phase is a self-contained chunk of work suited to one focused chat.
- Every page task lists: **route, data source, what to build, schema/SEO, done-when.**
- A page is never "done" until all five layers exist: data, query, render, JSON-LD, sitemap entry.
- Follow the hard rules in CLAUDE.md: no em dashes, mobile-first, one mint accent per viewport, real copy (never lorem), design tokens only.

---

## Current state snapshot (as of this writing)

**Live routes:** `/`, `/injectors`, `/injectors/[slug]`, `/clinics`, `/clinics/[slug]`.
**JSON-LD:** only on the two profile pages.
**Admin:** fixed and styled. 15 collections (added Media). SEO plugin on Guides. Direct image upload + excerpt on Guides.
**Deploy:** Vercel + Neon. Build runs `tsx scripts/db-push.ts && next build` to auto-sync Neon schema (additive only).

**Broken today (linked from nav/homepage/footer but 404):**
every `/[treatment]`, `/[treatment]/[city-state]`, `/guides/[slug]`, `/treatments/[area]`, and all trust + legal + company static pages.

| Page type | Route | Status |
|---|---|---|
| Homepage | `/` | Built (no JSON-LD) |
| Provider listing | `/injectors` | Built |
| Provider profile | `/injectors/[slug]` | Built (+JSON-LD) |
| Clinic listing | `/clinics` | Built |
| Clinic profile | `/clinics/[slug]` | Built (+JSON-LD) |
| Guide | `/guides/[slug]` | **Built** (Phase 0 complete) |
| Treatment pillar | `/[treatment]` | **Built** (Phase 1) |
| State hub | `/[state]` + `/[treatment]/[state]` | **Built** (Phase 1) |
| City directory (money page) | `/[treatment]/[city-state]` | **Built** (Phase 1) |
| City hub | `/[city-state]` | **Built** (Phase 1) |
| Neighborhood | `/[treatment]/[city-state]/[neighborhood]` | **Built** (Phase 1) |
| Body-area education | `/treatments/[area]` | **Built** (Phase 3) |
| Trust + legal + company | various | **Built** (Phase 3) |
| sitemap / robots / llms.txt | root | **Built** (Phase 2) |

---

## Mental model (why the order below)

1. **Programmatic SEO.** One template multiplied across treatments x cities = the page count. The city directory is the money page (highest buying intent).
2. **Content pyramid:** pillar (`/botox`) to state hub to city money page to neighborhood. They internally link so authority flows down.
3. **Two engines:** directory (providers/clinics/cities) drives leads; content (guides) drives trust + authority. They feed each other.
4. **YMYL trust:** medical content will not rank without visible reviewer credentials, editorial standards, review dates, corrections log. Trust pages are required before launch, not optional.
5. **Validate then scale:** build one city perfectly (NYC has seed data), confirm design + schema + speed + linking, then `generateStaticParams` to scale.

---

## Phase 0 — Guide pages (quick win, data + SEO fields ready)

**Why first:** Guides collection has 6 seeded rows, plus the new `excerpt`, `coverImage`, and SEO `meta` group. Homepage Blogs section and mega-menus already link here and 404. Lowest effort, immediate value, makes the SEO plugin work visible.

### 0.1 Rich-text renderer
- Build a Lexical to React serializer (`lib/render-lexical.tsx` or use `@payloadcms/richtext-lexical/react` `RichText`) for the Guide `body`.
- Handle headings, lists, links, blockquote, inline images (Media uploads), horizontal rule.
- Question-style H2/H3 support for AEO.

### 0.2 `/guides/[slug]`
- **Data:** `getGuideBySlug(slug)` in `lib/guide-queries.ts` (depth for author, medicalReviewer, relatedTreatment, faqs, coverImage).
- **Build:** hero (overline + serif title + lede + cover image), author byline + medical-reviewer byline with photo + credentials, "Last medically reviewed on [date]," reading time, rendered body, FAQ accordion (from `faqs` relationship), sources count, related treatment CTA ("Find a provider"), prev/next or related guides.
- **SEO:** use the SEO plugin `meta` fields for title/description/OG. Fall back excerpt to lede.
- **Schema:** `MedicalWebPage + Article + FAQPage` JSON-LD (CLAUDE schema table). Include author, reviewer, dateModified.
- **ISR:** `generateStaticParams` from all guide slugs, `revalidate = 300`.
- **Done when:** all 6 seeded guides render at their slug, nav links resolve, JSON-LD validates in Google Rich Results test, Lighthouse SEO 90+.

---

## Phase 1 — The money pages (core SEO engine)

**Routing decision (make first):** the first URL segment can be a treatment (`/botox`), a state (`/new-york`), OR a city (`/new-york-ny`). Next.js cannot pick between these by folder name alone, so use a **single root catch-all** `app/(frontend)/[[...path]]/page.tsx` with a **resolver** that classifies each segment by looking it up against Treatments slugs and Locations slugs (`kind` field: country/state/metro/city/neighborhood). Explicit folders (`injectors`, `clinics`, `guides`, static pages) take priority over the catch-all, so they are unaffected.

**Resolver logic (the heart of the routing):**
- `/[a]` → if `a` is a treatment: **treatment pillar** (1.2). If `a` is a state: **state hub** (1.6). If `a` is a city: **city hub** (1.7). Else 404.
- `/[a]/[b]` → if `a`=treatment and `b`=state: **treatment+state** (1.3). If `a`=treatment and `b`=city: **treatment+city money page** (1.1). Else 404.
- `/[a]/[b]/[c]` → `a`=treatment, `b`=city, `c`=neighborhood: **neighborhood page** (1.4). Else 404.

**Slug rule (fix in Locations data/queries):** state slug = `new-york`, city slug = `new-york-ny` (city ends with state code), neighborhood slug = `upper-east-side`. Current seed uses `state-ny` and `new-york-city-ny`; normalize these so URLs match CLAUDE's locked patterns.

**Global scale note:** the Locations collection is already hierarchical (country/state/metro/city/neighborhood) and providers carry lat/lng. When expanding beyond the US, prepend a country segment (`/[country]/[state]/...`) handled by the same resolver. Do not hard-code US assumptions in the resolver or queries. Keep all place names data-driven from Locations, never hand-typed.

Build NYC + Botox first end to end, then scale.

---

### 1.0 Navigation model: page-vs-filter + click flow (READ FIRST, applies to all Phase 1 pages)

There are exactly **two kinds of clicks**. Getting this line right is what makes the SEO engine work without index bloat.

**A. Navigation click → new page, new crawlable URL. Never hide content client-side.**
These are real search intents. Each one is its own indexable page:
`treatment`, `state`, `city`, `neighborhood`, `body-area`.

**B. Refine click → same page, the provider list just filters. No new page.**
These are not search keywords, so they stay client-side (optionally as `?param=` query strings on the same URL, never their own indexable page):
`price`, `rating`, `credential` (MD/NP/RN), `language`, `accepts-new-patients`, `gender`, `sort`, `distance`.

Tabs (By Treatment / By City) on a hub are navigation: each item links OUT to a real page. A tab must not merely show/hide a `<div>`; it renders links that load dedicated URLs.

**Canonical click journey (NY example, By-City = Option B):**

```
Homepage
  └─ NY click ───────────────► /new-york                 STATE HUB (1.6)
        │                        tabs: By Treatment | By City
        │                        + 3 Sponsored (scope: state)
        ├─ By Treatment ▸ Botox ► /botox/new-york          TREATMENT+STATE (1.3)
        │     │                    NY cities w/ Botox counts + 3 Sponsored (treatment+state)
        │     └─ NYC click ──────► /botox/new-york-ny       MONEY PAGE (1.1)
        │           │              map + providers + REFINE filters + 3 Sponsored (treatment+city)
        │           └─ UES ───────► /botox/new-york-ny/upper-east-side   NEIGHBORHOOD (1.4)
        │                 └─ provider ► /injectors/[slug] ► booking
        │
        └─ By City ▸ NYC ────────► /new-york-ny             CITY HUB (1.7, Option B)
              │                     all treatments offered in NYC + 3 Sponsored (city)
              └─ Botox click ─────► /botox/new-york-ny       MONEY PAGE (1.1)
```

**One-line rule to remember:** treatment / state / city / neighborhood / body-area click = new URL (new page). price / rating / credential / language / sort click = same page, list filters.

**Sponsorship ("3-3 featured" paid slots):** every hub and money page shows up to **3 clearly-labeled "Sponsored" providers** scoped to that page (state, treatment+state, city, treatment+city, body-area). These are paid. They are visually and structurally separate from unpaid editorial **Editor's Pick**. Driven by the Promotions model (see Phase 4). BRAND NOTE: this contradicts the locked homepage stat "zero paid placements" — that stat must be reworded before launch (e.g. "Independent editorial, sponsored listings clearly labeled"). FTC + Google require paid placements to be disclosed.

### 1.1 `/[treatment]/[city-state]` — city directory (THE money page)
- **Data:** `getCityDirectory(treatmentSlug, citySlug)`: providers offering that treatment in that city, sorted (editorsPick, rating, distance). Reuse Providers + Clinics + Locations. PostGIS for distance later.
- **Build (mobile-first):** breadcrumb, H1 ("Botox in New York City"), intro with provider count, up to 3 **Sponsored** cards (scope: treatment+city) at top, map (reuse hero Leaflet setup) + provider cards, **refine filters** (price, credential, rating, accepts new patients, languages, body-area) that filter the list client-side (no new URL), neighborhood quick-links (navigation, real pages), city FAQ block, internal links to pillar + state + neighborhoods + nearby cities.
- **Schema:** `BreadcrumbList + FAQPage + ItemList` JSON-LD. Sponsored cards must not be misrepresented in `ItemList`; label them sponsored.
- **SEO:** editable meta title/description template per CLAUDE, canonical, OG.
- **Done when:** `/botox/new-york-ny` renders with seeded NYC providers, refine filters work client-side (page stays same URL), navigation links open real pages, 3 sponsored slots render labeled, schema validates, mobile excellent.

### 1.2 `/[treatment]` — pillar treatment guide
- **Data:** Treatment record + linked `guide` (relationship) + top cities + top providers for the treatment.
- **Build:** treatment overview (uses guide body if present), price range, body areas, "find a provider in your city" city grid, related treatments, FAQs, risks/side-effects section (CLAUDE requires on every treatment).
- **Schema:** `MedicalWebPage + Article + FAQPage`.
- **Done when:** `/botox` renders, links into city pages, risks section present.

### 1.3 `/[treatment]/[state]` — state hub
- **Data:** cities in the state (Locations kind=metro/city, filtered by state) + provider counts.
- **Build:** H1 ("Botox in New York"), city grid with counts, top providers statewide, state FAQ, links to pillar + cities.
- **Schema:** `BreadcrumbList + ItemList + FAQPage`.

### 1.4 `/[treatment]/[city-state]/[neighborhood]` — long-tail
- **Data:** providers near a neighborhood (Locations kind=neighborhood, lat/lng radius).
- **Build:** slim variant of the city directory scoped to the neighborhood, links back up to city + state + pillar.
- **Schema:** same as city directory.

### 1.6 `/[state]` — state hub (treatment-agnostic, entry point from "Browse by State")
- **This is where a homepage state-card click lands.** Fix `BrowseStateClient.tsx` to link here (currently links to `/botox/{code}` which is wrong: uses code not name, and skips the hub).
- **Data:** `getStateHub(stateSlug)`: the state, its cities (Locations kind=metro/city in that state) with provider counts, treatments available, 3 sponsored providers scoped to the state.
- **Build (mobile-first):** H1 ("Find a verified injector in New York"), two tabs **By Treatment** and **By City** (both render LINKS, not show/hide), body-area chips (link to body-area pages), 3 Sponsored cards, state FAQ.
  - By Treatment tab: treatment cards, each links to `/[treatment]/new-york` (1.3).
  - By City tab: city cards, each links to `/new-york-ny` (city hub, 1.7).
- **Schema:** `BreadcrumbList + ItemList + FAQPage` JSON-LD.
- **SEO:** ranks for "injectors in new york" / "botox new york state" type queries. Canonical, OG, editable meta.
- **Done when:** `/new-york` renders, both tabs link out to real pages (no client-side hide), homepage NY card lands here.

### 1.7 `/[city-state]` — city hub (treatment-agnostic, Option B)
- **Data:** `getCityHub(citySlug)`: the city, all treatments offered there with provider counts, neighborhoods, 3 sponsored providers scoped to the city.
- **Build:** H1 ("Aesthetic injectors in New York City"), treatment grid (each links to `/[treatment]/new-york-ny` money page, 1.1), neighborhood quick-links, body-area chips, 3 Sponsored, city FAQ, links up to state hub.
- **Schema:** `BreadcrumbList + ItemList + FAQPage`.
- **Why Option B (treatment-agnostic city hub) over going straight to Botox:** for global scale, treatment mix varies by city/country. A city hub that lists whatever treatments exist there is data-driven and travels worldwide without code changes. It also catches "injectors in NYC" (treatment-agnostic) search intent as its own page.
- **Done when:** `/new-york-ny` renders, treatment grid links to money pages, links up to `/new-york`.

### 1.5 Scale
- `generateStaticParams` for top combinations (top 20 metros x core treatments first), ISR for the rest. Hubs (`/[state]`, `/[city-state]`) prerender for all seeded locations.
- Programmatic internal linking via Locations parent/child and Treatments relationships (CLAUDE: internal linking via CMS relationships, not hand-typed).
- **Global readiness:** resolver and queries stay country-aware (Locations hierarchy). No hard-coded US strings. Adding a country prepends one segment, no template rewrites.

---

## Phase 2 — SEO / GEO / AEO infrastructure (CLAUDE requires sitewide)

- `app/sitemap.ts` — programmatic, split by content type (guides, treatments, cities, providers, clinics), submitted to Search Console.
- `app/robots.ts` — crawl rules, sitemap reference.
- `llms.txt` at root — structure + key URLs for LLM crawlers (GEO).
- JSON-LD per template still missing: homepage (`Organization + WebSite + SearchAction`), all Phase 1 pages.
- Metadata generators: canonical on every page, OG + Twitter tags, meta title/description templates per page type (editable in CMS where a record exists).
- Breadcrumb schema on every detail page.
- FAQ schema everywhere there are FAQs; HowTo schema for how-to content; short 40 to 60 word answers (AEO).
- Author + medical-reviewer attribution and last-reviewed date on all editorial (GEO).
- Core Web Vitals green, Lighthouse 90+ all categories.

---

## Phase 3 — Trust + static + education pages (required before launch)

- `/how-we-verify` — expands the homepage section (license check, credential review, moderated reviews, editorial standards link).
- `/editorial-standards` — how content is made and reviewed.
- `/medical-advisory` — the board (MedicalReviewers collection), photos, credentials.
- `/about`, public **corrections log**, "no incentivized reviews" disclosure.
- `/treatments/[area]` — body-area education pages (homepage carousel + mega-menu link here). Problems + treatments for the area + CTA to find specialized providers nearby.
- `/list-your-practice` — provider acquisition landing page.
- Legal: `/privacy`, `/terms`, `/hipaa`, `/contact`, plus `/press`, `/careers`.
- **Done when:** no nav/footer link 404s; trust signals from CLAUDE present sitewide.

---

## Phase 4 — Conversion + ops (MVP scope: booking/lead capture, claim profile)

- **Promotions / Sponsored listings (the "3-3 featured paid" model):** add ONE clean `Promotions` collection so the admin manages all paid placements in one place (CLAUDE goal: admin must be easy). Fields:
  - `provider` (relationship), `scopeType` (select: treatment / state / city / treatment+state / treatment+city / body-area), `scopeValue` (relationship or text matching the scope), `rank` (number, 1 to 3), `startDate`, `endDate`, `active` (checkbox).
  - Frontend: hubs and money pages query active Promotions matching their scope, show up to 3, each card labeled **"Sponsored"**. Auto-expire by `endDate`.
  - Keep this SEPARATE from the existing unpaid `editorsPick` / `featuredRank` on Providers (editorial vs paid must not mix).
  - Admin convenience: a default-filtered "Active sponsorships" view; clear field descriptions; sensible defaults (rank 1, active true).
  - BRAND: reword the homepage "zero paid placements" stat before any sponsored slot goes live (FTC + Google disclosure).
- **Booking/lead capture:** `Bookings` collection exists but nothing writes to it. Build a `BookingForm` (Zod validated) that POSTs to `/api/bookings`. Wire: provider `#book` anchor, "Book consult" CTAs, city/guide CTAs, hero. Decide modal vs full page (open item in CLAUDE).
- **Email:** pick Resend (CLAUDE left this open). Send booking confirmation to patient + notification to provider/admin. Currently logs to console.
- **Claim profile flow:** provider auth (Payload built-in, role=provider), claim request, verification, provider dashboard (open item: dashboard layout). Larger effort.
- **Rate limiting + input sanitization** on the booking/write endpoints (CLAUDE security).

---

## Phase 5 — Pre-launch infra and data

- **Media storage adapter:** add `@payloadcms/storage-vercel-blob` (or storage-s3 for DO Spaces) so uploads work on Vercel. Currently deferred; prod uploads do not work until this lands.
- **Real imagery:** replace `i.pravatar.cc` / `picsum.photos` placeholders with uploaded provider photos, clinic photos, body-area imagery, and consented before/after pairs.
- **Migrations:** replace build-time `db-push` with proper Payload migrations + `prodMigrations` before public launch (build-time push only handles additive changes and silently skips destructive ones).
- **Monitoring:** Sentry, uptime, Postgres slow-query log (CLAUDE scalability).
- **Daily DB backups + PII encryption** for booking/account data.

---

## Ideas beyond CLAUDE.md (optional, high leverage)

- **Comparison pages:** "Botox vs Dysport," "MD vs NP vs RN," "filler vs neurotoxin." Cheap, high intent, AEO-friendly.
- **Cost pages + calculator:** "Botox cost in [city]" with tables (featured-snippet bait) and a units-to-dollars estimator.
- **"Near me" geolocation** on the directory using the existing PostGIS lat/lng.
- **Auto-generated FAQs** per city/treatment for answer engines.
- **AI citation optimization:** keep structured data clean and llms.txt rich so ChatGPT/Perplexity cite injector.world as the source.
- **Newsletter capture** for retention.
- **Provider analytics dashboard** as a future paid tier.

---

## Page "definition of done" (apply to every new page)

1. Data query in `lib/` with typed return.
2. Mobile-first render using design tokens (no hard-coded hex outside tokens, one mint accent per viewport).
3. JSON-LD matching the CLAUDE schema table for that template.
4. Metadata: canonical, title/description, OG + Twitter.
5. Sitemap entry (once `sitemap.ts` exists).
6. Internal links in and out via CMS relationships.
7. Real copy, no lorem, no em dashes.
8. Lighthouse 90+ and Core Web Vitals green.

---

## Open decisions (from CLAUDE.md, still unresolved)

- Booking flow: modal vs full page.
- Provider dashboard layout.
- Pricing model for premium listings.
- Email provider final pick (recommend Resend).
- Media storage provider (recommend Vercel Blob now that host is Vercel).
- Logo design (wordmark only today).
- Launch date.

---

## Suggested next chat

Start with **Phase 0 (`/guides/[slug]`)**. It is self-contained, the data and SEO fields are ready, and it fixes broken navigation immediately. Then take **Phase 1.1 (city directory)** as its own chat since it is the SEO core and the largest single build.

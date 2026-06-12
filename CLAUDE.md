# injector.world — Project Lock File

This is the single source of truth for the project. Every decision, every color, every file path. If something is in this file, it is locked. Do not re-derive it from other files.

> **Current execution plan + decisions live in `docs/`** (added 2026-06-08):
> - `docs/ROADMAP.md` — the locked phase-by-phase plan. Read this to know what to build next.
> - `docs/DECISIONS.md` — append-only decision log. Read before building; never silently contradict.
> - `docs/DONE.md` — the ship gate every phase must pass.
> - `docs/onboarding.md` — new-dev setup.
> CLAUDE.md remains the law (design system, locked decisions). The roadmap is the order of work.

---

## Git rules (STRICT, non-negotiable)

**Never do any of the following without explicit written instruction from the founder in that exact conversation:**

- `git push` — do not push to any remote under any circumstance.
- `git pull` / `git fetch` — do not pull or fetch from any remote.
- `git branch` / `git checkout -b` — do not create new branches.
- `git commit` — do not commit anything.
- Any interaction with GitHub (no PRs, no issues, no comments, nothing).

**All work is done locally on the `main` branch, in the working tree only.**

Edit files. Run the dev server. That is all. If a task seems to require a commit or push, stop and ask. Do not proceed.

---

## Project at a glance

| Thing | Value |
|---|---|
| Product | Content-led directory of Botox and aesthetic injectors |
| Domain | injector.world |
| Market | US primary (phase 1: top 20 metros) |
| MVP scope | Directory + content + claim profile + booking/lead capture |
| Positioning | The trusted guide to expert injectors. Find a verified provider near you, and learn what's actually right for your face. |
| Brand voice | Editorial, calm, honest, expert-led. The Strategist meets Healthline. Not influencer-y. Not clinical-cold. |

---

## Tech stack (locked)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 |
| CMS | Payload CMS 3.0 |
| Database | PostgreSQL with PostGIS extension |
| Hosting | DigitalOcean App Platform |
| Database hosting | DigitalOcean Managed PostgreSQL |
| Media storage | DigitalOcean Spaces (S3-compatible) + Spaces CDN |
| Email | Resend or Postmark (decide at build time) |
| Region | nyc3 (or nyc1) |
| Auth | Payload built-in |

---

## Design system (locked)

### Visual direction

Clinical premium. Pure white canvas. Deep navy primary. One soft mint accent. Generous whitespace. Editorial restraint.

### Colors

| Token | Hex | Where it's used |
|---|---|---|
| `color/bg/canvas` | `#FFFFFF` | Page background |
| `color/bg/surface` | `#F7F8FA` | Alternating sections, card backgrounds |
| `color/bg/surface-warm` | `#FAF7F2` | Editorial sections (guides, featured) |
| `color/ink/primary` | `#0B1B34` | Headlines, body text, dark UI |
| `color/ink/secondary` | `#475569` | Subheads, metadata |
| `color/ink/tertiary` | `#94A3B8` | Captions, helper text |
| `color/brand/primary` | `#0B1B34` | Navy primary. Buttons, footer, logos |
| `color/brand/accent` | `#3FA68A` | Mint accent. Verified check, links, success |
| `color/brand/accent-soft` | `#E6F2EE` | Mint background fills, chips |
| `color/border/default` | `#E2E8F0` | Card borders, dividers |
| `color/border/subtle` | `#EEF1F5` | Hairline rules |
| `color/state/star` | `#C2A14E` | Star ratings (muted gold, not yellow) |
| `color/state/error` | `#B91C1C` | Errors, risks callouts |
| `color/state/info` | `#1E40AF` | Info callouts |

**Rule:** Mint accent appears at most twice per viewport. Star gold appears only on rating units.

### Dark mode rules (CRITICAL, learned the hard way)

Theming is token-based. Every color is a CSS variable that flips under `.dark` (defined in `app/globals.css`). `darkMode: 'class'` in Tailwind, toggled via `next-themes`. So use token classes (`bg-surface-canvas`, `text-ink-primary`, `border-border`) and the page works in both modes automatically.

The trap: **`--brand-primary` inverts** (navy `#0B1B34` in light becomes near-white in dark, because it doubles as the logo/ink mark). Therefore:

- **Primary buttons: use `bg-brand-primary text-surface-canvas`, NEVER `bg-brand-primary text-white`.** `text-surface-canvas` flips with the surface (white in light, near-black in dark) so text always contrasts. `text-white` on `bg-brand-primary` = white-on-near-white = invisible in dark mode. This bug hit ~20 files once; do not reintroduce it.
- **Decorative navy bands** (page heros on `/injectors`, `/clinics`, the Footer, Pre-footer, Browse-by-State) use literal `bg-[#0B1B34] text-white` on purpose so they stay navy in both modes. That is the correct pattern for an "always-dark section."
- `text-white` is fine on: colored badges (`bg-brand-accent`, category chips), image overlays (`bg-black/55`), and always-dark sections. It is NOT fine on any surface that flips.
- Avoid flat `bg-white` (does not flip). `bg-white/90` chips over photos are acceptable.

### Typography

| Face | Use | Production license | Free substitute (used in mockups) |
|---|---|---|---|
| Tiempos Headline | Display + H1 + H2 + H3 | Klim Type Foundry | Fraunces (Google Fonts) |
| Tiempos Text | Long-form guide body | Klim Type Foundry | Fraunces (Google Fonts) |
| GT America | All UI + body + microcopy | Grilli Type | Inter (Google Fonts) |

### Type scale (desktop / mobile)

| Token | Face | Desktop | Mobile | Weight |
|---|---|---|---|---|
| display | Tiempos Headline | 64 / 72 | 40 / 48 | 500 |
| h1 | Tiempos Headline | 48 / 56 | 32 / 40 | 500 |
| h2 | Tiempos Headline | 36 / 44 | 28 / 36 | 500 |
| h3 | Tiempos Headline | 24 / 32 | 22 / 30 | 500 |
| h4 | GT America | 18 / 26 | 18 / 26 | 600 |
| lede | Tiempos Text | 22 / 34 | 18 / 28 | 400 |
| body-lg | GT America | 18 / 28 | 17 / 26 | 400 |
| body | GT America | 16 / 24 | 16 / 24 | 400 |
| body-sm | GT America | 14 / 20 | 14 / 20 | 400 |
| caption | GT America | 12 / 16 | 12 / 16 | 500 |
| overline | GT America | 11 / 14, +0.08em, UPPERCASE | same | 600 |
| guide-body | Tiempos Text | 19 / 32 | 17 / 28 | 400 |

Tracking: Tiempos at -0.01em on H1/Display. GT America at 0 default. Overline +0.08em.

### Spacing

4px base. Tokens: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.

Section padding desktop: 96 top/bottom. Mobile: 64 top/bottom.

### Radii

xs: 4 · sm: 8 · md: 12 · lg: 16 · xl: 24 · pill: 999.

Defaults: Buttons pill · Cards lg · Inputs sm · Chips pill · Images md.

### Shadows

- sm: `0 1px 2px rgba(11,27,52,0.06)`
- md: `0 4px 12px rgba(11,27,52,0.08)`
- lg: `0 12px 32px rgba(11,27,52,0.10)`
- hover: `0 8px 24px rgba(11,27,52,0.12)`

### Grid

| Breakpoint | Canvas | Cols | Gutter | Outer |
|---|---|---|---|---|
| Desktop 1440 | 1280 max | 12 | 24 | 80 |
| Tablet 1024 | 960 max | 8 | 20 | 32 |
| Mobile 390 | full | 4 | 16 | 20 |

### Iconography

Phosphor Icons (regular weight) at 20 or 24px. Verified check, license badge, and board cert in mint accent. Others in navy.

---

## File structure (locked)

```
C:\Users\risha\injector.world\
├── CLAUDE.md                                  ← This file. Project lock.
├── design\
│   ├── figma-build-spec.md                    ← Full visual spec for designer
│   └── homepage-plan-plain-english.md         ← Section-by-section homepage explainer
├── mockups\
│   ├── index.html                             ← Homepage mockup (live)
│   ├── city.html                              ← Botox in NYC directory mockup
│   ├── guide.html                             ← Botox treatment guide mockup
│   └── README.md                              ← How to open, share, and deploy mockups
└── data\
    └── scraper-brief.md                       ← Data scraper handover (5 CSV schemas)
```

Plan files live at: `C:\Users\risha\.claude\plans\` (outside the project repo).

---

## Decisions already made (do not re-ask)

| Decision | Locked answer |
|---|---|
| Target market | US primary (top 20 metros) |
| MVP scope | Directory + content + claim profile + booking/lead capture |
| Stack | Next.js + Payload CMS + PostgreSQL + DigitalOcean |
| Visual direction | Clinical premium |
| Typography (production) | Tiempos Headline + GT America |
| Typography (mockups) | Fraunces + Inter |
| Photography | Real provider photos. Unsplash placeholders in mockups. |
| Hosting | DigitalOcean App Platform + Managed Postgres + Spaces. **Vercel = demo only.** |
| Managed Database | Yes |
| Mockup tool | HTML (not Figma). Client demos via Netlify Drop. |
| Media storage | DO Spaces via `@payloadcms/storage-s3`. Not Vercel Blob. |
| Leads (v1) | Admin dashboard only. No email/Resend in v1. |
| Auth | Single `Users` collection, roles admin/editor/provider/patient. Patient = Phase 2. |
| First real-data markets | Houston TX, NYC NY, LA CA. Rest = "Coming soon" + noindex. |
| AI Face/Skin Analyzer | **Skipped** (biometric/medical-advice liability; Texas CUBI, Illinois BIPA). |

See **"## Product plan v2 (locked 2026-06-05)"** for the full feature plan, monetization tiers, claim flow, UI/UX fixes, and execution sequence.

---

## Homepage pattern (locked, final)

### Section order, top to bottom

1. Header
2. Hero (search bar with live dropdown results)
3. Body Areas (image-led modern carousel)
4. Browse by State (dark animated section)
5. Trust Bar (modern card style with watermark backgrounds)
6. Featured Injectors
7. Browse by Treatment
8. Blogs & Guides (categorized with filter tabs)
9. How We Verify
10. Real Patient Stories
11. Videos & Social (embedded short-form video)
12. Pre-footer CTA
13. Footer

### Mobile-first

Majority of traffic will be mobile. Design and build every section mobile-first, then scale up to tablet and desktop. No section ships unless mobile is excellent.

### Theme (light + dark)

Both modes required sitewide. User preference saved to localStorage. Defaults to system preference. Smooth fade transition between modes. Dark mode tokens TBD by builder, must match Clinical premium aesthetic (deep near-black canvas, lighter inks, mint accent stays).

### Header

Order, left to right: **Logo (left), Nav links (middle), Right cluster (right)**.

- **Left:** Logo wordmark `injectors • world`. On mobile: hamburger icon left, logo center.
- **Middle:** Nav links: `Treatments`, `Cities`, `Guides`, `How we verify`. Each can open a mega-menu panel on hover (desktop). On mobile, these go into the hamburger drawer.
- **Right cluster:**
  - **Avatar.** Generic person icon for logged-out users. On click: sign in flow. For logged-in users: real avatar with dropdown (profile, saved, settings, sign out).
  - **CTA button:** `List your practice` (primary style, for providers).
  - **Theme toggle.** Sun/moon icon, toggles light/dark mode.
- Sticky on scroll. Backdrop blur. Border bottom hairline.

### Hero

1. Centered overline + serif headline + lede.
2. **Search bar.** Treatment + Location + Search button. Pill container, white background, soft shadow. Same style as currently built in mockups/index.html.
3. **Live dropdown results.** After search submit (or 2+ characters typed):
   - Panel slides out below the search bar.
   - Map in the center showing geolocated providers.
   - Provider + clinic cards listed beside (desktop) or below (mobile) the map.
   - Each card: name, credentials, distance, rating, "Book consult" CTA.
   - Mobile layout: map on top, cards stacked below.
4. Suggestion chips below: Popular: Botox, Lip Filler, Masseter, Tear Trough.

### Body Areas section

Reference: https://21st.dev/community/components/ravikatiyar/feature-carousel/default

- Image-led cards (large photos) with text overlay. Each card represents one body area.
- Big serif heading + plain-English subtext (one short sentence).
- Areas: Forehead, Brow, Under Eye, Crow's Feet, Cheeks, Lips, Chin, Jawline, Neck, Décolletage.
- Click → routes to "Problems & treatments for [area]" page (educational page with treatments + a CTA to find specialized providers nearby).
- Modern feature carousel, simple to understand. Auto-rotate, manual scroll.
- No em dashes anywhere in card copy.

### Browse by State section

Reference style: dark navy background, grid of state cards with arrow icons, "+ N more states" expand button.

- Title: "Browse by State". Subtitle: "Find verified injectors in your state".
- Top right: "All 50 states ->" link.
- Grid of state cards. Each card: state name + chevron arrow. Hover lifts.
- Show top 12 by default, "+ 38 more states" button expands to all 50.
- Animated entrance on scroll. Stagger cards.
- Click → state hub page (e.g., `/botox/new-york`).

### Trust Bar (modern card style)

Reference style: two large feature cards on top + four smaller stat cards below.

- **Top row (2 cards):**
  - Colored top accent bar (orange and mint).
  - Big bold number with subtle suffix.
  - Subtle background "watermark" version of the same number behind the card.
  - One card has a "LIVE" indicator with pulsing dot.
- **Bottom row (4 smaller cards):**
  - Colored left border accent (blue, purple, orange, red, harmonized with brand).
  - Number with small "+" suffix.
  - Title + one-line description.
- Animated count-up on scroll into view, staggered.

The 6 stats:
1. **Verified Injectors** — 12,400+ — patients who trust us every month (LIVE).
2. **Patient Reviews** — 87,000+ — verified stories published and updated.
3. **Cities Covered** — 200+ — across all 50 US states.
4. **Treatment Guides** — 30+ — medically reviewed.
5. **Medical Reviewers** — 16 — board-certified MDs on advisory board.
6. **Years Independent** — 4 — editorially independent. (Was "zero paid placements"; changed 2026-06-08 because paid tiers + sponsored slots contradict it. Verification and organic ranking stay unbuyable; sponsorships are clearly labeled.)

### Featured Injectors

Horizontal scroll on mobile, 3-column grid on desktop. Each card: clinic photo, "Editor's Pick" ribbon, injector photo + name + credentials, License verified badge with state and number, star rating + count, treatment chips, starting price, neighborhood, two CTAs (Book consult + View profile).

### Browse by Treatment

Grid of treatment tiles. Each tile: small icon, treatment name, two links (Read the guide + Find a provider). 12 treatments visible.

### Blogs & Guides section

- Filter tabs at top: All · Treatment Guides · Articles · Expert Q&A · Cost Reports.
- Tabs trigger client-side filter without page reload.
- Card grid below filter: cover image, category tag, title in serif, lede, medical reviewer byline with avatar, read time + last reviewed date.
- "See all guides ->" link below grid.

### How We Verify

Three-column numbered section (01, 02, 03):
1. License check.
2. Credential review.
3. Patient reviews moderated.
Plus link to editorial standards.

### Real Patient Stories

Horizontal carousel of before/after cards. Each: side-by-side photos, treatment tag, "weeks post" badge, injector name + city link, "Consent granted" disclaimer.

### Videos & Social

Short-form video embeds (Instagram Reels, TikToks, YouTube Shorts) from the medical advisory board and editorial team. Vertical video format. Mobile-optimized player. Horizontal scroll on mobile, 3 or 4 column grid on desktop. Each tile: video thumbnail, platform icon (IG/TikTok/YT), caption, "Watch ->" CTA.

### Pre-footer CTA

Navy section with the search bar repeated. Headline: "Find a verified injector in your city."

### Footer

Multi-column dark navy footer: brand block, treatments, top states, top cities, guides, company, legal. Disclaimer line at bottom: "Information here is editorial and not medical advice."

---

## Non-functional requirements (locked)

Everything below applies to every page on the site, not just the homepage.

### SEO

- Server-rendered with Next.js App Router (SSR/ISR).
- Schema.org structured data per template (see schema markup table earlier).
- XML sitemap generated programmatically, split by content type, submitted to Search Console.
- robots.txt with crawl rules.
- Canonical URLs on every page.
- Meta title and description templates per page type, editable per record in CMS.
- Open Graph + Twitter Card tags on every page.
- Breadcrumb schema on every detail page.
- Internal linking via CMS relationships, not hand-typed.
- Core Web Vitals: target green on all metrics.
- Lighthouse: target 90+ on all four categories.

### GEO (Generative Engine Optimization)

- Clear, factual, attributable content. No AI-generated copy unless edited by a human.
- `llms.txt` file at the site root listing structure and key URLs for LLM crawlers.
- Author + medical reviewer attribution on every editorial piece.
- Last-reviewed date visible on all medical content.
- Source citations in guides (linked footnotes).
- Structured data on every page that an LLM can parse cleanly.

### AEO (Answer Engine Optimization)

- FAQ schema on every page that has FAQs.
- Short, direct answers in FAQ format (40 to 60 words ideal).
- HowTo schema for how-to content.
- Question-style H2s and H3s where appropriate (match People Also Ask queries).
- Featured snippet targeting on cost tables, comparison tables, and definitions.

### Security

- HTTPS everywhere (Let's Encrypt via DigitalOcean App Platform).
- Security headers: HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Auth via Payload built-in (bcrypt, JWT, session rotation).
- Rate limiting on login, signup, and write API endpoints.
- Input sanitization on all forms (Zod schemas).
- SQL injection protection (Payload + Postgres parameterized queries only).
- XSS protection (React escapes by default, DOMPurify for any rich text).
- CSRF tokens on state-changing requests.
- Secrets in environment variables, never in code, never in client bundle.
- Daily database backups with 30-day retention.
- PII encryption at rest for booking and account data.
- Audit log on all admin and provider-dashboard actions.

### Scalability

- Static generation for high-traffic pages (homepage, top-state hubs, top-city directories).
- ISR (Incremental Static Regeneration) for the rest of the directory.
- CDN via DigitalOcean Spaces CDN for media. Edge caching at the App Platform layer.
- Database indexes on every searched field (lat/lng via PostGIS GIST, treatment, rating, city).
- Connection pooling (PgBouncer or DO managed).
- Image optimization via Next.js Image component, WebP/AVIF output.
- Lazy-load below-fold sections.
- Code split per route. Dynamic imports for heavy components (map, video embeds).
- Monitoring: Sentry for errors, uptime monitoring, Postgres slow query log.

---

## Brand voice rules

- Editorial, calm, honest, expert-led.
- Mention named medical reviewers wherever possible.
- Trust signals before delight.
- White space is a feature.
- One mint accent per viewport. Never two.
- No influencer-speak.
- No fear-based marketing. We educate, not scare.
- Disclaimers in the right places, not spammed.

---

## Top 20 metros (phase 1 scope)

NYC, Los Angeles, Miami, Chicago, Houston, Dallas, Atlanta, Phoenix, Seattle, Boston, Washington DC, San Francisco, Denver, Austin, San Diego, Philadelphia, Nashville, Charlotte, Las Vegas, Portland.

---

## URL structure (locked)

| Pattern | Example | Purpose |
|---|---|---|
| `/` | Homepage | Hero + browse |
| `/[treatment]` | `/botox` | Pillar treatment guide |
| `/[treatment]/[state]` | `/botox/new-york` | State hub |
| `/[treatment]/[city-state]` | `/botox/new-york-ny` | City directory (money page) |
| `/[treatment]/[city-state]/[neighborhood]` | `/botox/new-york-ny/upper-east-side` | Long-tail neighborhood |
| `/injectors/[slug]` | `/injectors/lena-park-md-nyc` | Provider profile |
| `/clinics/[slug]` | `/clinics/park-avenue-dermatology` | Clinic page |
| `/brands` + `/brands/[slug]` | `/brands/radiance-aesthetics` | Brand hub (multi-location group). Added Phase 6 (2026-06-10). Indexable only when a branch is in a live market. |
| `/guides/[slug]` | `/guides/botox` | Treatment guide |

Around 40,000 indexable pages at full scale.

---

## Schema markup (locked, per template)

| Template | Schema stack |
|---|---|
| Homepage | Organization + WebSite + SearchAction |
| Provider profile | Physician + AggregateRating + Review |
| Clinic page | MedicalBusiness + LocalBusiness + OpeningHours |
| City directory | BreadcrumbList + FAQPage + ItemList |
| Treatment guide | MedicalWebPage + Article + FAQPage |

---

## Trust signals (must appear on the relevant page)

**Provider page:** License verified badge with state and number · Board certifications · Years of experience · Real photo · Verified reviews · Pricing range · Languages · Accepts new patients.

**Guide page:** Medical reviewer byline with credentials and photo · "Last medically reviewed on [date]" · Author byline · Editorial standards link · Sources count.

**Sitewide:** Medical advisory board page · Editorial standards page · Public corrections log · No incentivized reviews disclosure · Real contact info · Risks and side effects content on every treatment.

---

## User style rules (hard rules, never break)

1. **No em dashes** (—). Use periods, commas, parentheses, or colons.
2. **Plain yet powerful.** No fluff. No filler adverbs.
3. **Hinglish is OK in chat replies**, not in product copy.
4. **No emojis** unless explicitly requested.
5. **Real copy in mockups**, never lorem ipsum.

---

## Where to find the actual content

| Need | File |
|---|---|
| Full Figma-grade spec with every section | `design/figma-build-spec.md` |
| Plain-English homepage walkthrough | `design/homepage-plan-plain-english.md` |
| Working HTML mockups | `mockups/index.html`, `mockups/city.html`, `mockups/guide.html` |
| Client demo + deploy instructions | `mockups/README.md` |
| Data scraper handover | `data/scraper-brief.md` |
| Original strategy plan | `C:\Users\risha\.claude\plans\act-as-a-senior-peppy-giraffe.md` |

---

## Open items (not yet decided)

- Logo design (currently a wordmark only)
- Specific medical advisory board members
- Provider dashboard layout (functionality locked; visual layout TBD at build time)
- Merit-ranking metric weights (formula locked in Product plan v2; exact weights TBD by founder)
- Pricing model / rate card for ad banner + sponsored slots
- Launch date
- Developer/dev agency hire

Resolved this session (now locked in Product plan v2): booking flow (inline form, admin-only leads), auth model (single Users + roles, patient Phase 2), hosting/media (DO + Spaces S3), data strategy (3 markets + coming-soon), AI scope (face analyzer skipped).

Add new locked decisions to the relevant section above. When something moves from "open" to "locked", delete it from this list and add it to the right section.

---

## Build Status (last updated 2026-06-05)

This section is the single source of truth for what is built and what is next. The old `claude2.md` roadmap is folded in here. Do not keep a separate roadmap file.

### Stack corrections (vs. original lock)

| Was locked as | Actually using | Why |
|---|---|---|
| Next.js 14 | **Next.js 15.4.x** | Payload 3.x requires Next 15+ |
| React 18 | **React 19** | Required by Next 15 |
| PostgreSQL (unspecified version) | **PostgreSQL 18.4** with **PostGIS 3.6** | PostGIS installed under its own `postgis` schema so Drizzle (Payload's ORM) ignores it on push. Search path set to `public, postgis`. |
| `"type": "module"` in package.json | Yes (added) | Required for Node 25 ESM compat with Payload's internal env loader |

### Local DB

- Database: `injectors_world_dev`
- Connection: `postgres://postgres:admin@localhost:5432/injectors_world_dev`
- PostGIS extension: installed under `postgis` schema, search_path updated

### What's built (homepage)

All 13 sections live and rendering at `http://localhost:3000`. ISR enabled: `revalidate = 300` (5 min).

| # | Section | Component folder | Notes |
|---|---|---|---|
| 1 | Header | `components/header/` | Sticky, backdrop blur, desktop mega menus (Treatments/Cities/Guides), mobile drawer via CSS transform (no hydration race), theme toggle |
| 2 | Hero | `components/hero/` | Live pulsing trust badge, big serif headline, search bar with treatment + location autocomplete, live dropdown panel with Carto-tiled Leaflet map + custom SVG pins + provider cards in 2-col grid below |
| 3 | Body Areas | `components/body-areas/` | 10 image-led tiles + "See all" terminal tile, auto-rotate every 5s, prev/next arrows on desktop, swipe + dots on mobile |
| 4 | Browse by State | `components/browse-state/` | Always-dark navy with animated mesh-drift + dot-grid bg, 12 featured + "+38 more" expand, stagger fade-up on scroll |
| 5 | Trust Bar | `components/trust-bar/` | 2 large cards (LIVE pulsing dot, watermark numbers, count-up on view) + 4 small cards with colored left borders |
| 6 | Featured Injectors | `components/featured-injectors/` | Clinic cover photo, overlapping avatar, license verified chip, star rating, treatment chips, Book/View CTAs. Mobile carousel with dots, desktop 3-col grid |
| 7 | Browse by Treatment | `components/browse-treatments/` | 12 treatment tiles, surface-warm bg, icon per category, "Read the guide" + "Find a provider" dual links |
| 8 | Blogs & Guides | `components/blogs-guides/` | 5 filter tabs (All / Treatment Guides / Articles / Expert Q&A / Cost Reports) with live counts, stagger fade-up cards |
| 9 | How We Verify | `components/verify/` | **Infographic timeline**: 3 icon badges (shield / award / chat-star) with step numbers, gradient connector line on desktop, big serif titles + smaller body + proof-point chips |
| 10 | Real Patient Stories | `components/patient-stories/` | Before/after drag-slider, consent badge, mobile carousel with dots |
| 11 | Videos & Social | `components/videos-social/` | 9:16 vertical tiles, platform badge (IG/TT/YT gradient), duration badge, centered play button, mobile carousel with dots |
| 12 | Pre-footer CTA | `components/pre-footer/` | **Single primary button** (no search bar), big serif headline, trust stats row below |
| 13 | Footer | `components/footer/` | Always-dark navy, 6 columns (brand + Treatments + Cities + Company + Legal + social), disclaimer line |

### Supporting UI

- **Sticky mobile bottom CTA** (`components/ui/StickyMobileCta.tsx`): pill appears after scrolling past Hero, hides near Footer
- **Carousel dots** (`components/ui/CarouselDots.tsx`): reusable, click-to-jump, active dot stretches to 24px pill
- **Section reveal** (`components/ui/SectionReveal.tsx`): IntersectionObserver-based fade-up wrapper (available, not yet applied site-wide)
- **Theme toggle**: light/dark via `next-themes`, system default
- **Smooth scroll** + `prefers-reduced-motion` honored globally

### Payload collections (18, all in `public` schema)

Users, Media, Treatments, Locations, Clinics, Providers, Reviews, Photos, QA, Authors, MedicalReviewers, Guides, FAQs, BeforeAfterCases, Bookings, Promotions, AuditLogs, DataAlerts.

- **DataAlerts** = operational integrity alerts (duplicates, broken relationships, unknown treatments, unmatched cities, missing trust fields, orphaned/oversold promotions). Self-healing: re-running import/scan auto-resolves alerts whose issue is fixed. Written by `lib/import/import-data.ts` + `scripts/scan-data-alerts.ts`. Surfaced on the admin dashboard via `components/admin/DashboardWidget.tsx` (alert counts + bulk CSV upload).

Field names match `data/scraper-brief.md` exactly so real scraped CSVs slot in without refactor.

- **Promotions** = paid/sponsored slots. Enforces max 3 active slots per scope and unique rank (1/2/3) via a `beforeChange` hook. A 4th slot or duplicate rank is hard-blocked with a clear admin error, so you cannot oversell.
- **AuditLogs** = append-only trail of create/update/delete on Providers, Clinics, Guides, Reviews, Bookings, Promotions. Admin-read-only, no manual edit/delete. Written by `lib/audit-hook.ts`. Public/API writes log as user "system".

### Seeded mock data

- 15 providers across 8 clinics in 5 metros (NYC, LA, Miami, Chicago, SF)
- 12 treatments, 50 states, 20 metros, 12 NYC neighborhoods
- 40 reviews, 6 guides, 20 FAQs, 12 before/after cases, 23 photos, 3 authors, 5 medical reviewers
- 1 admin user (`admin@injector.world` / `changeme`)

### Key file structure

```
app/
  (frontend)/layout.tsx       fonts + theme + sticky mobile CTA
  (frontend)/page.tsx          composes all 13 sections
  (payload)/admin/             Payload admin at /admin
  (payload)/api/               Payload REST API
  globals.css                  design tokens + Leaflet brand + utility classes
collections/                   14 Payload collection configs
components/
  header/  hero/  body-areas/  browse-state/  trust-bar/
  featured-injectors/  browse-treatments/  blogs-guides/  verify/
  patient-stories/  videos-social/  pre-footer/  footer/  ui/
lib/
  payload-server.ts            cached Payload instance for RSC
  hero-queries.ts              Hero data
  home-queries.ts              Sections 4-13 data
  site-nav.ts                  mega menu + footer link defs
  body-areas-data.ts           10 body areas
  videos-data.ts               8 mock video tiles
scripts/
  seed.ts  seed-data.ts        idempotent mock data seed
payload.config.ts              Payload root config
tailwind.config.ts             design tokens (colors, type, spacing, shadows)
```

### Dev commands

```
npm run dev                    Next dev server at localhost:3000
npm run seed                   Re-seed (skips populated collections)
npm run build                  Production build
npm run generate:types         Regenerate payload-types.ts
```

### Admin

URL `http://localhost:3000/admin` · `admin@injector.world` / `changeme` (change after first login)

### Map / tiles

- **Carto Voyager** (no-labels base + labels overlay for layered control) for clean cartographic look
- Custom SVG pins (mint resting, navy active with mint ring)
- Auto-fit-bounds with `maxZoom: 12` + 60px padding
- `invalidateSize()` on mount to prevent first-render tile glitches
- Dark-mode tile inversion via CSS filter
- Map container: 380px height mobile, 520px desktop

### What's built beyond the homepage (all 200, zero dead nav links)

- **Routing:** single required catch-all `app/(frontend)/[...path]/page.tsx`. Resolver `lib/route-resolver.ts` (module-level cache). Slugs: state=`new-york`, city=`new-york-ny`, neighborhood=`upper-east-side`.
- **Page types:** `/[treatment]` pillar, `/[state]` hub, `/[city-state]` hub, `/[treatment]/[state]`, `/[treatment]/[city-state]` (money page, with map + filters + sponsored slots + empty state), `/[treatment]/[city-state]/[neighborhood]`, `/injectors` + `/injectors/[slug]`, `/clinics` + `/clinics/[slug]`, `/guides` (index with filter tabs) + `/guides/[slug]` (Lexical renderer, FAQ accordion), `/treatments/[area]` (10 body areas).
- **Static/trust pages:** `/how-we-verify`, `/editorial-standards`, `/medical-advisory`, `/about`, `/list-your-practice`, `/contact`, `/press`, `/careers`, `/privacy`, `/terms`, `/hipaa`.
- **SEO infra:** `/sitemap.xml`, `/robots.txt` (GPTBot/ClaudeBot allowed), `/llms.txt`, per-template JSON-LD, branded `not-found.tsx` + `error.tsx`.
- **Booking flow:** `BookingForm` on every provider profile → `POST /api/bookings` → saves to Bookings collection → Resend emails (patient + admin). Zod-validated, 5-req/IP/hour rate limit.
- **Treatments in DB (15):** botox, dysport, xeomin, jeuveau, daxxify, masseter-botox, lip-filler, cheek-filler, jawline-filler, tear-trough, sculptra, kybella, prp, microneedling, thread-lift.
- **Guides in DB (13):** botox, botox-vs-dysport, masseter-botox, how-to-choose-injector, tear-trough, botox-cost-2026, lip-filler, first-time-botox, botox-vs-filler, red-flags, is-botox-safe, botox-side-effects, md-vs-np-vs-rn.

### Dev commands

```
npm run dev                Next dev server at localhost:3000
npm run seed               Seed (upsert-by-slug for treatments + guides; safe to re-run)
npm run db:push            Push schema to DB (run after adding/changing a collection)
npm run generate:types     Regenerate payload-types.ts (run after schema changes)
npm run build              Production build
```

### Setup still required (needs your accounts / keys)

- **Leads = admin-only (Resend dropped from v1):** bookings save to the Bookings collection and surface in the admin dashboard. No email in v1. The Resend wiring stays in `/api/bookings` behind the `RESEND_API_KEY` check, dormant until a key is set.
- **Media storage:** `@payloadcms/storage-s3` → DigitalOcean Spaces (prod target is DO, not Vercel). Currently media is URL-only; uploads will not persist until this is wired.
- **Sentry:** error monitoring (the `error.tsx` boundary already has the hook point).
- **Real assets:** provider headshots, body-area imagery, before/after photos with consent (currently pravatar/picsum placeholders).

### Monetization engine (Phase 3 — DONE 2026-06-05)

Three-tier monetization fully wired into all listing pages (city directory, treatment pillar, state hub, treatment+state). Top-to-bottom page order: Ad Banner → Sponsored Cards → Organic list.

**Promotions collection extended:**
- New `placement` field: `sponsored-card` (default, existing behaviour) | `banner` | `organic-pin`.
- `provider` field is now **optional** (banners may advertise a third party).
- Banner-specific fields: `advertiserName`, `bannerImageUrl`, `bannerLinkUrl`, `bannerAltText`.
- `beforeChange` slot-guard updated to filter by placement so tiers never cancel each other:
  - `banner`: max 1 active per scope. Blocked with clear message.
  - `sponsored-card`: max 3, unique rank (existing rule, unchanged).
  - `organic-pin`: max 3, unique rank.
- Access tightened: `create/update/delete` = admin/editor only. `read` = public.

**Merit ranking (`lib/merit.ts`):**
- `MERIT_WEIGHTS` config object (tunable without touching other code).
- `computeMeritScore(provider)` — pure, deterministic. Components: rating (×2.0), reviewCount log-normalised (×1.5), profile completeness — photo/bio/price/treatments/languages (×1.0), recency from updatedAt (×0.5), responseRate placeholder (×0.3), minus penalties for unverified license (−1.5) or no photo (−0.5).
- `applyMeritOrder(providers, pinnedIds, excludeIds)` — pins admin-selected providers at top by rank, then merit-sorts tail, removes sponsored duplicates.

**New queries in `lib/promotion-queries.ts`:**
- `getPromotions` now filters by `placement='sponsored-card'` (was returning all placements before).
- `getActiveBanner(scopeType, treatmentId?, locationId?)` → `ActiveBanner | null`.
- `getOrganicPins(scopeType, treatmentId?, locationId?)` → `Map<providerId, rank>`.
- All three share a single `buildScopeWhere` helper for consistent scope resolution.

**`components/shared/AdBanner.tsx` (new):**
- Server component. Renders nothing when `banner` is null.
- FTC-required "Ad" / "Ad · [Advertiser Name]" label always visible above creative.
- Outbound link: `rel="sponsored noopener noreferrer"`, `target="_blank"`.
- 6:1 aspect ratio image with Next.js Image + text-only fallback.
- Dark-mode safe (design tokens only), mobile-first.

**`DirectoryProvider` extended:** `bio?: string` and `updatedAt?: string` (used in merit completeness + recency scoring). Both `mapProvider` functions updated.

**Catch-all page wired:** city-directory fetches `[sponsored, banner, pins]` in parallel, calls `applyMeritOrder`, passes `{ ...data, providers: orderedProviders }` + `banner` to `CityDirectoryPage`. State hub, treatment pillar, and treatment+state pages receive `banner` prop.

**`scripts/scan-data-alerts.ts`:** orphan scan now skips `placement='banner'` promotions (no provider is expected for third-party banners).

### Phase 4: Mobile UX fixes — DONE (2026-06-05)

All 8 fixes shipped. No DB/schema changes. Pure frontend. tsc clean, all pages 200.

| # | Fix | File(s) | Notes |
|---|---|---|---|
| 1 | Map scroll-trap | `components/shared/ProviderFilters.tsx`, `DirectoryMap.tsx` | List/Map toggle on mobile. Inline map hidden (`hidden md:block`). "Map" opens `fixed inset-0 z-50` overlay, body scroll locked, Escape closes. Desktop unchanged. |
| 2 | Mobile booking access | `app/(frontend)/injectors/[slug]/page.tsx` | Compact `a[href="#book"]` + starting price injected just below the profile hero on mobile only (`md:hidden`). |
| 3 | Sticky CTA context-aware | `components/ui/StickyMobileCta.tsx` | Uses `usePathname()`. On `/injectors/[slug]` renders as `<button>` that `scrollIntoView('#book')`; everywhere else renders as `<Link href="/injectors">`. No more hardcoded NYC Botox link. |
| 4 | Before/After touch jitter | `components/patient-stories/BeforeAfterSlider.tsx` | Added `if ('touches' in e) e.preventDefault()` in the native `touchmove` handler (which was already `{ passive: false }`). |
| 5 | Mobile header search | `components/header/HeaderClient.tsx` | Search icon (md:hidden) in header right cluster. Tap opens `MobileSearchOverlay` (full-screen, body locked, Escape closes) with treatment + location inputs, popular chips, Submit slugifies + routes. |
| 6 | Sponsored cards stacking | `components/pages/CityDirectoryPage.tsx` | On mobile: `flex overflow-x-auto snap-x snap-mandatory` with each card `w-[78vw] max-w-[300px]`. On `sm:` and up: back to grid. Disclosure label preserved. |
| 7 | Featured card widths | `components/featured-injectors/FeaturedInjectors.tsx` | `w-[320px]` → `w-[80vw] max-w-[340px]`. Next card peeks at 375px. |
| 8 | Compare modal sticky labels | `components/ui/CompareModal.tsx` | Row-header `<th>` and all label `<td>` cells get `sticky left-0 z-10 border-r border-border`. |
| B | GuidesGrid dark mode badge | `components/guides/GuidesGrid.tsx` | `text-white/70` → `text-surface-canvas/70` on active tab count. |

### Phase 5: V1 Feature Layer — DONE (2026-06-05)

All 7 features shipped. tsc clean, all pages 200, db:push + generate:types done.

| Feature | What shipped | Key files |
|---|---|---|
| 1. Treatment indices | painIndex / longevityLabel / downtimeLabel fields on Treatments. TreatmentIndices chip row on treatment pillar, body area, and guide pages. Indices-based FAQPage JSON-LD auto-generated. | `collections/Treatments.ts`, `components/shared/TreatmentIndices.tsx` |
| 2. Worth-It % score | `lib/worth-it.ts` — computes % of reviews rating >= 4. WorthItBadge component. Shown on treatment pillar, guide pages, body area pages. | `lib/worth-it.ts`, `components/shared/WorthItBadge.tsx` |
| 3. Cost estimator | CostEstimator client component with units slider for neurotoxins. City-level avg pricing computed from provider DB records (pricingBotoxPerUnit / pricingFillerPerSyringe). On city directory and treatment pillar sidebars. | `components/shared/CostEstimator.tsx`, `lib/location-queries.ts` |
| 4. Loyalty badges | loyaltyPrograms (Allē/Aspire/Xperience/Other) field on Providers. Badges on DirectoryProviderCard, FeaturedInjectors, provider profile. Loyalty filter in ProviderFilters. | `collections/Providers.ts`, `components/shared/DirectoryProviderCard.tsx` |
| 5. Virtual-consult filter | Toggle in ProviderFilters. No schema change (offersVirtualConsult already existed). | `components/shared/ProviderFilters.tsx` |
| 6. Q&A board | QA collection extended with status/slug/submitterEmail fields, answerText/sourceUrl now optional. 8 answered Q&A seeded. /questions index + /questions/[slug] detail pages with QAPage + FAQPage JSON-LD. POST /api/questions (rate-limited 5/hr, Zod-validated, moderation queue). RelatedQAs on treatment pillar. | `collections/QA.ts`, `app/(frontend)/questions/`, `app/api/questions/route.ts`, `components/shared/RelatedQAs.tsx` |
| 7. Candidate quiz | /quiz page: 3-step client quiz (concern + area + goal) → treatment recommendation + CTA. QuizPromoCard on homepage between Browse by Treatment and Blogs & Guides. | `app/(frontend)/quiz/`, `components/shared/QuizPromoCard.tsx` |

**Schema changes in Phase 5:** Treatments (+6 fields), Providers (+loyaltyPrograms), QA (+status, +slug, +submitterEmail, answerText/sourceUrl now optional). All db:push + generate:types done.

**Seed changes:** seedMissingBySlug now does full upsert (create + update); providers also upsert by slug. Treatments and providers updated with new field values.

### Roadmap

Phase A (dark-mode + 404/error) and Phase B (sponsored-slot guard + audit log) are DONE (2026-06-05). Phase 3 (monetization) is DONE (2026-06-05). Phase 4 (mobile UX fixes) is DONE (2026-06-05). Phase 5 (V1 feature layer) is DONE (2026-06-05). The full forward plan now lives in **"## Product plan v2 (locked 2026-06-05)"** below.

### Polishing protocol (decided)

Polish one area at a time in a focused chat. Use this Build Status section to load context fast. Each homepage section is self-contained under `components/{slug}/` for surgical edits. After any collection change, run `npm run db:push` then `npm run generate:types`.

---

## Product plan v2 (locked 2026-06-05)

Confirmed with the founder this session. Supersedes the earlier A–E phase list. This is the forward roadmap.

### Hosting (locked)

- **Production = DigitalOcean** App Platform + Managed Postgres + Spaces (S3) + Spaces CDN. **Vercel is DEMO ONLY.** Write all code for a DO target.
- Media adapter = `@payloadcms/storage-s3` pointed at DO Spaces. **Never Vercel Blob/KV/Edge.**
- Scheduled work (promotion expiry, merit-score recompute, alert scans) = Payload jobs queue or `node-cron` inside the DO service. Not Vercel Cron.
- Rate limiting: in-memory Map is fine on a single instance. If DO scales to multiple instances, move shared limits to **DO Managed Redis**.
- Ensure Next standalone build runs on DO App Platform; `sharp` present for image optimization.

### Leads (locked)

- Booking/lead → save to Bookings collection → **admin dashboard only.** No Resend/email in v1 (wiring stays dormant behind `RESEND_API_KEY`).

### Data strategy (locked)

- **Real data first for 3 markets:** Houston TX, New York City NY, Los Angeles CA.
- **Everywhere else = "Coming soon"** state + waitlist email capture. These pages are **`noindex`** until populated (avoid thin-content penalty). Enhance the existing city empty-state into this.
- **Bulk upload:** admin-side CSV upload view → runs `scripts/import-providers.ts` (reads `data/scraper-brief.md` schemas, upsert by `clinicId`/`providerId`). Import validates relationships + dedupes; any problem becomes a DataAlert.

### Auth model (locked)

- **Single `Users` collection** with `role: admin | editor | provider | patient`. Payload built-in auth (bcrypt, JWT httpOnly cookie).
- `admin`/`editor` → `/admin`. `provider` → frontend `/login` → claim + edit own profile (NOT license/verified badge/reviews). `patient` → `/login` (**Phase 2** — saved, history, Q&A).
- Provider claim links `User` ↔ `Provider`/`Clinic` record, admin-approved.
- **Patient accounts = Phase 2 (deferred this session).**
- Security: login rate-limit, email verification, password reset, optional 2FA later.

### Monetization (locked) — three tiers

1. **Ad banner** at the top of listing pages. Extend Promotions with `placement: 'banner'`. Advertiser image + link. Paid.
2. **Sponsored cards** — existing Promotions (`placement: 'sponsored-card'`), max 3 per scope, overselling hard-blocked (BUILT).
3. **Organic top 3** — admin manual pin override; otherwise **merit algorithm v1** (deterministic, explainable):
   `score = norm(rating) + log(reviewCount) + profileCompleteness + recency + responseRate − penalties(unverified license / no photo)`. Weights tunable; founder will refine metrics later.

### Operations (locked)

- **`DataAlerts` collection** + write-hooks + a periodic scan. Detects: duplicate license/NPI/slug, duplicate clinic (name+address or `googlePlaceId`), provider with no clinic, clinic not matching any Location, sponsored/banner pointing at an inactive/unverified provider, booking referencing a deleted provider, published provider missing verified license/photo. Fields: type, severity, message, relatedDoc, status.
- Surface as a **custom admin dashboard widget** (red/amber counts) plus the collection list.
- Relationship: **AuditLogs (built)** = who/when/what changed. **DataAlerts** = what is currently wrong. Both feed the admin operational view. Everything stays interconnected.

### Claim flow (after data phase)

- **Providers AND clinics** can claim. "Claim this profile" → form (providers: email, license #, NPI; clinics: business details) → **Claims collection** → admin approve → links to a `provider`-role User → **provider dashboard** (edit bio/pricing/photos/hours/booking URL/social; cannot edit license/verified badge/reviews).

### UI/UX fixes (mobile-first, prioritized)

- **Critical:** map scroll-trap → List/Map toggle + full-screen map (`ProviderFilters`/`ListingMapInner`); mobile booking access → sticky CTA scrolls to form + shows starting price (provider profile); sticky-CTA hardcoded `/botox/new-york-ny` link bug → context-aware (`StickyMobileCta`); before/after touch jitter → `preventDefault` on `touchmove` while dragging (`BeforeAfterSlider`).
- **High:** mobile header search overlay (`HeaderClient`); sponsored cards stacking → horizontal row or inline at positions 2 & 5 (`CityDirectoryPage`); featured card widths `w-[320px]` → `vw`-based (`FeaturedInjectors`).
- **Medium:** compare modal sticky first column (`CompareModal`).

### Feature backlog (competitor-inspired)

- **V1:** Worth-It % satisfaction score; **Q&A board** (Q&A schema — big SEO + claim incentive); per-city cost estimator; pain / longevity / downtime structured indices on treatment + guide pages; loyalty-program badges (Allē / Aspire / Xperience) on profiles; virtual-consult filter; "Am I a candidate?" quiz.
- **V2:** certified-provider badges (Daxxify / RHA / Jeuveau); peer endorsements; calendar-widget embeds (Boulevard / Zenoti / Mindbody / Acuity); granular before/after filtering by age / concern / brand (needs tagged data).

### AI layer (server-side LLM, model-agnostic, DO-friendly)

- **Build:** AI review summarizer (mobile + SEO); natural-language search ("tired, dark circles" → tear-trough); AI provider bio generator (helps claim flow). Chatbot intake only — **no medical advice**.
- **SKIPPED (locked decision): AI Face/Skin Analyzer.** Reason: biometric-privacy law (**Texas CUBI — our launch market**; Illinois BIPA) + medical-advice liability. Do not build without legal sign-off and zero biometric storage.

### Cross-cutting standards (every page, non-negotiable)

- **Security:** RBAC, login rate-limit, email verify, PII care for bookings/patients, **NO biometric data**, CSP (must be tested so admin + Leaflet map + Google Fonts don't break), audit log + data alerts.
- **SEO / GEO / AEO / AIO:** existing sitemap / robots / llms.txt / JSON-LD; add Q&A + FAQ schema, cost tables, structured indices, `noindex` on thin "coming soon" pages, CMS-driven internal linking.
- **Design:** dark-mode rules (see Design System), mobile-first, token-only colors.

### Execution sequence (one focused chat each)

1. **Data + bulk upload + DataAlerts** — ENGINE DONE (2026-06-05). `lib/import/` engine + `scripts/import-providers.ts` (CLI: `npm run import`) + `scripts/scan-data-alerts.ts` (`npm run scan:alerts`) + `/api/admin/import` route + admin DashboardWidget (counts + CSV upload). Sample CSVs in `data/samples/`. Upsert by clinicId/providerId/reviewId; snake_case CSV → camelCase fields; treatment alias map; relationship IDs must be raw (not String()). Verified against sample data: 4 clinics, 5 providers (1 dup skipped), 6 reviews, correct alerts. **Still TODO in this phase:** real Houston/NYC/LA data (sample only so far), "coming soon" + noindex for non-priority markets, photos.csv + qa.csv importers.
2. **Auth + claim flow DONE (2026-06-05).** Collections: Claims (new), Users (linkedClinic added, default role=patient), Providers/Clinics (claimed+claimedBy added). DB schema auto-synced. Pages: /login, /forgot-password (stub), /claim/[type]/[slug], /dashboard (provider-only, server-guarded). APIs: /api/claims (rate-limited 3/hr, Zod, creates claim + optional account), /api/dashboard/save (full field allowlist + server-enforced block of license/verified/rating fields — rejects even crafted requests). Header: async server component reads session, passes user to HeaderClient (avatar dropdown for logged-in, sign-in for logged-out, logout button). Provider + clinic profiles show "Claim this profile" link when unclaimed. Claims collection in /admin with afterChange hook that promotes user to provider role on approval.
3. **Monetization DONE (2026-06-05).** Ad banner (max 1/scope, image+link, "Ad" label), sponsored cards (existing, now placement-filtered), organic pins (admin manual top-3, max 3/scope). Merit ranking engine: `lib/merit.ts` with `MERIT_WEIGHTS` config + `computeMeritScore` + `applyMeritOrder`. All listing pages (city directory, treatment pillar, state hub, treatment+state) show: Banner → Sponsored → Organic (pins first, then merit desc). See "Monetization engine (Phase 3)" above for full detail.
4. **Mobile UX fixes — DONE (2026-06-05)** (all 8: map toggle, book bar, sticky CTA, slider jitter, header search, sponsored scroll, card widths, compare modal)
5. **Feature layer** (Worth-It %, Q&A board, cost estimator, indices, loyalty badges, quiz)
6. **AI layer** (review summarizer, NL search, bio generator)
7. **Hardening** (DO Spaces media, Payload migrations, CSP, performance, final SEO pass)

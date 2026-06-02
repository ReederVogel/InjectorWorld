# injector.world — Figma Build Spec

**Direction:** Clinical premium. Tiempos Headline + GT America. Unsplash placeholder photography.
**Frames in scope:** Homepage, Local Directory (Botox in New York City), Treatment Guide (Botox).
**Breakpoints:** Desktop 1440, Tablet 1024, Mobile 390.

---

## Table of Contents

- A. Visual Direction
- B. Design Tokens
- C. Component Library
- D. Frame 1: Homepage
- E. Frame 2: Local Directory (Botox in NYC)
- F. Frame 3: Treatment Guide (Botox)
- G. Mobile Adaptations
- H. Asset Brief (Unsplash search terms)
- I. Annotation Layer (for client review)
- J. Figma File Structure
- K. Build Order

---

## A. Visual Direction

**Mood in one line:** A medical journal that knows beautiful design. Calm authority, white space as a feature, deep navy with one mint accent.

**Three rules the whole system follows:**
1. Trust before delight. Credentials, ratings, and reviewer bylines are denser than competitor pages.
2. White space is doing work. Generous padding, restraint in color, never more than one accent per viewport.
3. Type does the heavy lifting. Tiempos serif headlines carry the editorial voice. GT America keeps UI honest.

---

## B. Design Tokens

### B.1 Color

| Token | Hex | Use |
|---|---|---|
| `color/bg/canvas` | `#FFFFFF` | Page background |
| `color/bg/surface` | `#F7F8FA` | Card backgrounds, alternating sections |
| `color/bg/surface-warm` | `#FAF7F2` | Editorial sections (guides, featured) |
| `color/ink/primary` | `#0B1B34` | Body text, headlines |
| `color/ink/secondary` | `#475569` | Subheads, metadata |
| `color/ink/tertiary` | `#94A3B8` | Captions, helper text |
| `color/brand/primary` | `#0B1B34` | Buttons, links, logos |
| `color/brand/accent` | `#3FA68A` | Verified, mint accent, success |
| `color/brand/accent-soft` | `#E6F2EE` | Accent backgrounds, chips |
| `color/border/default` | `#E2E8F0` | Card borders, dividers |
| `color/border/subtle` | `#EEF1F5` | Hairline rules |
| `color/state/star` | `#C2A14E` | Star rating (muted gold, not yellow) |
| `color/state/error` | `#B91C1C` | Errors, risks callouts |
| `color/state/info` | `#1E40AF` | Info callouts |

**Usage rule:** Mint accent appears at most twice per viewport. Star gold appears only on rating units.

### B.2 Typography

**Faces:** Tiempos Headline (display + H1/H2), Tiempos Text (long-form guide body), GT America (UI + body + microcopy). License through Klim Type Foundry and Grilli Type.

**Type scale (desktop / mobile):**

| Token | Face | Size/Line (desktop) | Size/Line (mobile) | Weight |
|---|---|---|---|---|
| `type/display` | Tiempos Headline | 64 / 72 | 40 / 48 | 500 |
| `type/h1` | Tiempos Headline | 48 / 56 | 32 / 40 | 500 |
| `type/h2` | Tiempos Headline | 36 / 44 | 28 / 36 | 500 |
| `type/h3` | Tiempos Headline | 24 / 32 | 22 / 30 | 500 |
| `type/h4` | GT America | 18 / 26 | 18 / 26 | 600 |
| `type/lede` | Tiempos Text | 22 / 34 | 18 / 28 | 400 |
| `type/body-lg` | GT America | 18 / 28 | 17 / 26 | 400 |
| `type/body` | GT America | 16 / 24 | 16 / 24 | 400 |
| `type/body-sm` | GT America | 14 / 20 | 14 / 20 | 400 |
| `type/caption` | GT America | 12 / 16 | 12 / 16 | 500 |
| `type/overline` | GT America | 11 / 14, +0.08em tracking, uppercase | same | 600 |
| `type/guide-body` | Tiempos Text | 19 / 32 | 17 / 28 | 400 |

**Tracking:** Tiempos at -0.01em for H1/Display. GT America at 0 default. Overline +0.08em.

### B.3 Spacing scale

4px base. Tokens: `space/1` 4, `space/2` 8, `space/3` 12, `space/4` 16, `space/5` 20, `space/6` 24, `space/8` 32, `space/10` 40, `space/12` 48, `space/16` 64, `space/20` 80, `space/24` 96, `space/32` 128.

**Section vertical rhythm:**
- Section padding desktop: `space/24` (96) top + bottom.
- Section padding mobile: `space/16` (64) top + bottom.
- Block gap inside section: `space/12` (48) desktop, `space/8` (32) mobile.

### B.4 Radii

`radius/xs` 4, `radius/sm` 8, `radius/md` 12, `radius/lg` 16, `radius/xl` 24, `radius/pill` 999.

**Defaults:** Buttons `pill`. Cards `lg`. Inputs `sm`. Chips `pill`. Images `md`.

### B.5 Shadows

- `shadow/sm`: 0 1px 2px rgba(11,27,52,0.06)
- `shadow/md`: 0 4px 12px rgba(11,27,52,0.08)
- `shadow/lg`: 0 12px 32px rgba(11,27,52,0.10)
- `shadow/hover`: 0 8px 24px rgba(11,27,52,0.12)

Use shadows sparingly. Default cards use border, not shadow. Shadow appears on hover or on the sticky header.

### B.6 Grid

| Breakpoint | Canvas | Columns | Gutter | Outer margin |
|---|---|---|---|---|
| Desktop 1440 | 1280 max content | 12 | 24 | 80 |
| Tablet 1024 | 960 max | 8 | 20 | 32 |
| Mobile 390 | full | 4 | 16 | 20 |

### B.7 Iconography

- Library: Phosphor Icons (regular weight) at 20px or 24px. Free, large set, consistent stroke.
- Custom icons: verified check, license badge, board cert ribbon. Use accent mint for verified, navy for others.

### B.8 Motion

Spec for annotations only (not interactive in Figma):
- Hover lift on cards: y -2, shadow `shadow/hover`, 180ms ease-out.
- Sticky header: backdrop blur 12, background `rgba(255,255,255,0.85)`, appears after 80px scroll.
- Verified badge: gentle pulse on first paint, then static.

---

## C. Component Library

Build these as Figma components with variants. Everything downstream uses them.

### C.1 Button

| Variant | Background | Text | Border | Use |
|---|---|---|---|---|
| Primary | `color/brand/primary` | white | none | Main CTA |
| Secondary | white | `color/brand/primary` | 1px `color/brand/primary` | Secondary CTA |
| Tertiary | transparent | `color/brand/primary` | none, underline on hover | Inline link CTA |
| Ghost | transparent | `color/ink/primary` | 1px `color/border/default` | Filters, toggles |

**Sizes:** `sm` 36h x 16/16 padding x 14 type. `md` 44h x 20/20 padding x 15 type. `lg` 52h x 24/24 padding x 16 type.

**Radius:** pill for primary/secondary. `sm` for ghost in filter rails.

### C.2 Input

- Height 48 default.
- Border 1px `color/border/default`, focus 2px `color/brand/primary`.
- Radius `sm` for filters, `pill` for hero search.
- Inside the hero search bar, the input is borderless; the wrapping pill is the border.

### C.3 Hero search bar (compound)

- Pill container, height 64 desktop / 56 mobile, white background, 1px `color/border/default`, `shadow/md`.
- Left segment: treatment dropdown with caret. 40% width desktop.
- Divider: 1px hairline.
- Middle segment: location input with location pin icon. 45% width.
- Right segment: primary button "Search" (pill, 48h inside the 64h container).

### C.4 Provider card

Dimensions: 384w x 480h desktop. Padding 24. Radius `lg`. 1px border `color/border/default`. Hover lifts.

**Internal layout, top to bottom:**
1. Cover photo zone 384w x 200h, radius `lg` top corners. Photo of clinic or stylized treatment shot.
2. Avatar + name row, 24 top padding. 56px circular photo of injector. To the right: name (H4) + credentials line ("MD, Board-Certified Dermatologist") in `body-sm` `ink/secondary`.
3. Verified row: mint check icon + "License verified · NY #271832" in `caption`.
4. Rating row: 5 stars in `state/star` + "4.9 (412 reviews)" in `body-sm`.
5. Treatment chips row: 3 chips max (Botox, Lip Filler, Tear Trough). Pill, mint-soft background, navy text.
6. Pricing line: "Botox from $480" in `body`.
7. Distance line: "Upper East Side · 0.8 mi" in `caption` `ink/tertiary`.
8. Two-button row at bottom: Primary "Book consult" + Secondary "View profile". Equal width.

**State variants:** default, hover (lift + shadow), saved (heart icon top right filled), featured (small "Editor's Pick" ribbon top-left in accent mint).

### C.5 Guide card (editorial)

Dimensions: 384w x 440h. Different from provider card to signal "publication, not directory."

**Internal layout:**
1. Image zone 384w x 220h, radius `lg` top corners.
2. Overline: "TREATMENT GUIDE" in mint accent.
3. Title H3 Tiempos, 2-line max.
4. Lede `body-sm` `ink/secondary`, 3-line max.
5. Byline row: reviewer avatar 24px + "Medically reviewed by Dr. Lena Park, MD" in `caption`.
6. Meta row: "12 min read · Updated May 2026" in `caption` `ink/tertiary`.

### C.6 Treatment tile

Dimensions: 240w x 180h. Surface-warm background. Padding 20. Radius `md`.
- Small illustration icon 32px top-left.
- Treatment name H4.
- Two-line link group: "Read the guide ->" and "Find a provider ->" both in `body-sm` mint accent.

### C.7 City tile

Dimensions: 280w x 240h. Photo background with overlay gradient bottom 60%. Radius `md`.
- City photo (skyline or neighborhood texture).
- Bottom overlay: City name H3 in white. "1,240 verified injectors" in `body-sm` white 80%.

### C.8 Trust badge

Pill, 32h. Mint-soft background. Mint check icon + label in `caption` semibold. Examples: "License verified", "Board certified", "10+ years experience".

### C.9 Star rating

Inline. 5 stars at 16px in `state/star`. Trailing label "4.9 (412)" in `body-sm`. Half-star supported via SVG.

### C.10 Filter chip

Pill, 36h, white background, 1px `color/border/default`. Selected state: navy background, white text. Multi-select supported. Caret icon if dropdown.

### C.11 Navigation header

Height 72 desktop / 64 mobile. White background. 1px bottom border `color/border/subtle`.

**Desktop layout:**
- Left: logo (32px height).
- Center: nav links "Treatments", "Cities", "Guides", "How we verify".
- Right: search icon, "List your practice" tertiary button, "Sign in" tertiary button.

**Sticky variant:** appears after 80px scroll, backdrop blur, includes mini search input.

### C.12 Footer

Background `color/ink/primary` (navy). Text white at varying opacity. Padding `space/24` vertical.

Six columns desktop:
1. Logo + 2-line description + social icons.
2. Treatments (10 links).
3. Top cities (10 links).
4. Guides (6 links).
5. Company (About, Editorial standards, Medical advisory, Press, Careers).
6. Legal (Privacy, Terms, HIPAA, Editorial standards, Contact).

Bottom rule: "© 2026 injector.world. Information here is editorial and not medical advice."

### C.13 Breadcrumb

Above H1. `caption` size. Pattern: Home / Botox / New York / NYC Botox Injectors. Mint accent for the current page, ink secondary for the rest, ink tertiary "/" separators.

### C.14 FAQ accordion

Full-width row. 1px bottom border `color/border/subtle`. Padding 24 vertical. Question in H4. Caret right, rotates 90 on open. Answer in `body` `ink/secondary`. Schema-marked.

### C.15 Sticky TOC

Width 240. Sits left of guide body. Sticky from 120px below top. Items in `body-sm`. Active item: mint left border 2px, ink primary, semibold. Inactive: ink secondary.

### C.16 Before/after card

Side-by-side or slider. Aspect 4:3. Caption underneath: treatment, injector name + city link, "Photos shared with patient consent" in `caption` `ink/tertiary`.

### C.17 Pull quote

Used inside guides. 80% column width. Tiempos Headline H3, ink primary. 4px left border in mint accent. Padding-left 24.

### C.18 Callout

Surface-warm or mint-soft background. Radius `md`. Padding 24. Icon top-left (info, warning, tip). Label overline + body content.

### C.19 Map + list toggle

Two-tab pill. Selected tab navy fill. Used on city pages.

### C.20 Booking CTA card

Sticky right rail on provider pages (out of scope for the 3 frames but spec'd for consistency).

---

## D. Frame 1: Homepage

**Frame name in Figma:** `01-Home-Desktop-1440`
**Canvas:** 1440w x as-needed (estimate ~5400h).
**Order from top:**

### D.1 Header

Use `C.11`. Logo wordmark "injector.world" in GT America 18 semibold, navy. Mint dot after the period.

### D.2 Hero section

Padding: `space/24` top, `space/24` bottom. Background `color/bg/canvas`.

**Layout:** Centered, 800px max-width content block.

**Content top to bottom:**

1. **Overline:** "TRUSTED BY 87,000+ PATIENTS" in `overline` mint accent, centered.

2. **Headline (H1 display 64):**
   *Find a verified injector you can actually trust.*

3. **Subhead (lede, 22 Tiempos Text):**
   Every injector on injector.world is license-verified, credential-reviewed, and rated by real patients. No paid rankings.

4. **Search bar** (`C.3`), 720w x 64h centered. Placeholder text: treatment "Botox" / location "New York, NY or ZIP".

5. **Microcopy row** below search:
   - Three short pill chips, ghost style: "Botox", "Lip Filler", "Masseter".
   - Right side, separated: small ink-tertiary text "Or browse all 30 treatments ->".

### D.3 Trust bar

Padding `space/12` top + bottom. Background `color/bg/surface`. Full-bleed.

**Layout:** Two rows, centered.

- **Row 1:** Overline left "MEDICALLY REVIEWED BY". To the right, 4 credential marks at 32h, monochrome ink-secondary: ABMS, AAD, ASPS, ASDS.
- **Row 2:** Three stats divided by hairline vertical rules:
  - "12,400 verified injectors"
  - "87,000 patient reviews"
  - "Available in all 50 states"

### D.4 Browse by treatment

Padding `space/24` top + bottom.

**Header:**
- Overline "BROWSE BY TREATMENT"
- H2: *What are you considering?*
- Lede: A short, expert-edited guide on every treatment, plus verified providers near you.

**Grid:** 4 columns x 3 rows = 12 treatment tiles (`C.6`).

**Tile content (real):**
1. Botox
2. Dysport
3. Lip Filler
4. Cheek Filler
5. Jawline Filler
6. Tear Trough Filler
7. Masseter Botox
8. Kybella
9. Sculptra
10. PRP
11. Microneedling
12. Thread Lift

### D.5 Browse by city

Padding `space/24` top + bottom. Background `color/bg/surface`.

**Header:**
- Overline "BROWSE BY CITY"
- H2: *Verified injectors, mapped to your city.*

**Grid:** 4 columns x 3 rows = 12 city tiles (`C.7`).

**Cities (real US metros):**
1. New York City, NY (1,240 injectors)
2. Los Angeles, CA (1,080)
3. Miami, FL (820)
4. Chicago, IL (640)
5. Houston, TX (590)
6. Dallas, TX (560)
7. Atlanta, GA (510)
8. Phoenix, AZ (460)
9. Seattle, WA (430)
10. Boston, MA (410)
11. Washington, DC (390)
12. San Francisco, CA (380)

Below grid, centered tertiary CTA: "See all 200+ cities ->".

### D.6 Featured injectors

Padding `space/24` top + bottom.

**Header:**
- Overline "EDITOR'S PICKS"
- H2: *Hand-picked injectors, this month.*
- Lede: Our editors review credentials, technique, and patient outcomes. No paid placements here.

**Grid:** 3 provider cards (`C.4`) in a row. On desktop show 6 in a 3x2 grid.

**Card content (real, plausible):**

| Name | Credentials | Location | Rating | Treatments | Starting price |
|---|---|---|---|---|---|
| Dr. Lena Park, MD | Board-Certified Dermatologist | Upper East Side, NYC | 4.9 (412) | Botox, Lip Filler, Tear Trough | Botox from $520 |
| Dr. Marcus Hill, MD | Board-Certified Plastic Surgeon | Beverly Hills, LA | 4.9 (388) | Filler, Sculptra, Kybella | Botox from $600 |
| Sofia Reyes, NP | Aesthetic Nurse Practitioner | Brickell, Miami | 4.8 (510) | Botox, Lip Filler, Masseter | Botox from $420 |
| Dr. Aisha Bello, MD | Board-Certified Facial Plastic Surgeon | Buckhead, Atlanta | 5.0 (294) | Filler, Threads, Botox | Botox from $480 |
| Dr. James Whitaker, DO | Board-Certified Aesthetic Medicine | River North, Chicago | 4.8 (332) | Botox, Dysport, Tear Trough | Botox from $440 |
| Dr. Priya Shah, MD | Board-Certified Dermatologist | Pacific Heights, SF | 4.9 (275) | Botox, Lip Filler, PRP | Botox from $560 |

Below grid, centered tertiary CTA: "See all featured injectors ->".

### D.7 From the guides

Padding `space/24` top + bottom. Background `color/bg/surface-warm`. This is the "publication" frame.

**Header:**
- Overline "EDITORIAL"
- H2: *Read before you book.*
- Lede: Every guide is written by a medical writer and reviewed by a board-certified physician.

**Grid:** 3 guide cards (`C.5`) in a row.

**Card content:**

| Title | Lede | Reviewer | Read time |
|---|---|---|---|
| Botox: The Complete Guide | Everything to know before your first Botox appointment, from cost to risks to choosing an injector. | Dr. Lena Park, MD | 12 min |
| How to Choose an Aesthetic Injector | The seven questions to ask before you sit in the chair, from a dermatologist who has seen the bad outcomes. | Dr. Marcus Hill, MD | 8 min |
| Filler vs Botox: What Each Actually Does | A clear breakdown of what each treatment is, what it isn't, and which one fits your goal. | Dr. Aisha Bello, MD | 10 min |

Below grid, tertiary CTA: "All treatment guides ->".

### D.8 How we verify

Padding `space/24` top + bottom.

**Header:**
- Overline "HOW WE VERIFY"
- H2: *Trust, but verify everyone.*
- Lede: Three checks before any injector lists on injector.world.

**Layout:** 3 columns. Each column has a numbered badge (01, 02, 03 in Tiempos H2 mint accent), title H3, and body paragraph.

| Step | Title | Body |
|---|---|---|
| 01 | License check | We verify every injector against the state medical board where they practice. License numbers are publicly displayed on profile pages. |
| 02 | Credential review | Board certifications, fellowships, and training centers are reviewed by our medical advisory board before a profile is published. |
| 03 | Patient reviews moderated | Every review is checked for authenticity and treatment specificity. We do not allow injectors to delete reviews. |

Below: tertiary CTA "Read our editorial standards ->".

### D.9 Real patient stories

Padding `space/24` top + bottom. Background `color/bg/surface`.

**Header:**
- Overline "RESULTS"
- H2: *Real patients. Real results.*
- Lede: Photos shared with patient consent. Results vary.

**Layout:** Horizontal carousel of 6 before/after cards (`C.16`). Show 3 visible at a time on desktop.

**Captions:**
1. Lip Filler, Sofia Reyes, NP, Miami
2. Tear Trough, Dr. Lena Park, MD, NYC
3. Masseter Botox, Dr. James Whitaker, DO, Chicago
4. Forehead Botox, Dr. Priya Shah, MD, SF
5. Cheek Filler, Dr. Aisha Bello, MD, Atlanta
6. Jawline Filler, Dr. Marcus Hill, MD, LA

### D.10 FAQ

Padding `space/24` top + bottom.

**Header:**
- Overline "FAQ"
- H2: *Common questions, plain answers.*

**Layout:** Two-column on desktop, single-column on mobile. Six FAQ rows (`C.14`).

**Questions:**
1. How does injector.world verify providers?
2. Is Botox safe?
3. How much does Botox cost?
4. What's the difference between an MD, NP, and RN injector?
5. How do I prepare for my first appointment?
6. Are reviews on injector.world real?

Each answer 60 to 100 words, ends with "Read the full guide ->" link.

### D.11 Pre-footer CTA

Padding `space/24` top + bottom. Background `color/brand/primary` (navy). White text.

**Layout:** Centered, 720px max.

- Overline white: "READY WHEN YOU ARE"
- H2 white: *Find a verified injector in your city.*
- Search bar `C.3` (white background pill on navy section).

### D.12 Footer

Use `C.12`.

---

## E. Frame 2: Local Directory (Botox in NYC)

**Frame name:** `02-City-Botox-NYC-Desktop-1440`
**Canvas:** 1440w x ~4600h.
**URL:** `/botox/new-york-ny`

### E.1 Header

Same `C.11`, with sticky variant active by default on this page.

### E.2 Breadcrumb

`C.13`: Home / Botox / New York. Padding `space/8` top + bottom.

### E.3 Local hero

Padding `space/16` top, `space/12` bottom.

**Layout:** Two-column. Left 60%, right 40%.

**Left column:**
- Overline "BOTOX IN NEW YORK CITY"
- H1: *1,240 verified Botox injectors in New York City.*
- Lede: Compare credentials, prices, and reviews. License-verified providers across all five boroughs.
- Stat row: 4 stat blocks inline
  - Average price: "$580"
  - Average rating: "4.7 / 5"
  - Neighborhoods covered: "42"
  - Verified providers: "1,240"
- CTA row: Primary "Book a consult" + Secondary "Read the Botox guide"

**Right column:**
- Image card 480w x 360h, radius `lg`. Neighborhood photo (Manhattan skyline or a clean clinic interior).
- Caption below image: "Average Botox price in NYC ranges $400 to $850 depending on units and neighborhood."

### E.4 Filter rail + results

**Layout:** Two-column. Left rail 240w, right content 1000w.

**Left rail (sticky, starts 120px below top):**

Filter groups, each collapsible:
1. **Neighborhood** — multi-select chips: Upper East Side, Tribeca, SoHo, West Village, Williamsburg, Brooklyn Heights, Park Slope, Astoria, Long Island City, Midtown, Chelsea, Flatiron.
2. **Price range** — range slider $200 to $1,500.
3. **Rating** — checkbox: 4.5+, 4.0+, 3.5+.
4. **Credential** — checkbox: MD, DO, NP, PA, RN.
5. **Specialty** — checkbox: Forehead, Crow's feet, Glabella, Lip flip, Masseter, Underarm, Neck.
6. **Languages** — checkbox: English, Spanish, Mandarin, Korean, Hindi, Russian.
7. **Other** — checkbox: Accepts new patients, Offers virtual consult, Same-day available.

Apply button at bottom of rail.

**Right content:**

**Top bar:**
- Result count left: "1,240 verified injectors in New York City"
- Sort dropdown right: "Sort by: Editor's picks". Other options: Rating, Reviews, Price low to high, Distance.
- Toggle right of sort: Map | List (`C.19`).

**Results grid:** 3 columns of provider cards (`C.4`), 12 visible above the fold, infinite scroll or pagination.

**Real card content (first 6):**

| Name | Credentials | Neighborhood | Rating | Pricing |
|---|---|---|---|---|
| Dr. Lena Park, MD | Board-Certified Dermatologist | Upper East Side | 4.9 (412) | Botox from $520 |
| Dr. Daniel Cho, MD | Board-Certified Facial Plastic Surgeon | Midtown | 4.9 (376) | Botox from $620 |
| Maya Singh, NP | Aesthetic Nurse Practitioner | West Village | 4.8 (498) | Botox from $440 |
| Dr. Rachel Goldman, MD | Board-Certified Dermatologist | Tribeca | 5.0 (267) | Botox from $560 |
| Dr. Omar Haddad, MD | Board-Certified Plastic Surgeon | Upper West Side | 4.8 (321) | Botox from $580 |
| Jenna Wu, PA | Physician Assistant, Aesthetic Medicine | Williamsburg | 4.9 (445) | Botox from $400 |

### E.5 Local editorial block (the SEO weapon)

Padding `space/24` top + bottom. Background `color/bg/surface-warm`. Max content width 800.

**Header:**
- Overline "LOCAL EDIT"
- H2: *Getting Botox in New York City.*
- Byline row: "Reviewed by Dr. Lena Park, MD · Last updated May 2026"

**Body (real, editorial tone, around 500 words):**

> New York City is one of the most experienced markets in the country for neurotoxin treatments. Injectors here see a higher volume of clients than almost anywhere in the US, and they tend to favor a conservative, natural-looking approach. The phrase you hear in NYC clinics is "rested, not frozen."
>
> Prices range widely by neighborhood and provider type. On the Upper East Side and in Tribeca, board-certified dermatologists and plastic surgeons commonly charge $14 to $18 per unit, with most patients receiving 20 to 40 units across the forehead, glabella, and crow's feet. In Brooklyn and Queens, nurse practitioners and PAs working under medical direction often price between $11 and $14 per unit. Both can produce excellent results when the injector is well-trained.
>
> Choose by credentials and experience, not by zip code. Board certification in dermatology, plastic surgery, facial plastic surgery, or oculoplastic surgery is a strong starting filter. For nurse practitioners and PAs, ask about their supervising physician and how long they have been injecting full-time.
>
> A few NYC-specific notes. First, masseter Botox is a popular request here, both for jaw slimming and for TMJ relief. Many of the dentists and oral surgeons who offer it have less aesthetic experience than the dermatologists, so check before-and-after photos carefully. Second, consultations in Manhattan are often paid (typically $50 to $150, applied to your treatment) while in the outer boroughs they are more often free. Third, allergan loyalty (Alle) and Galderma rewards (Aspire) are honored at almost every legitimate clinic here, which can shave $20 to $40 off your visit.
>
> Tipping is not expected for injectables in a medical setting, even though some clinics blur the line. If your injector is also doing facials or other spa services, a tip on those services is appropriate. Tipping on the injectable itself is not.
>
> Finally, ask what brand the clinic carries. Botox (Allergan) is the most common, but Dysport and Xeomin are valid alternatives. Some patients respond better to one than another. A clinic that carries multiple brands and is willing to discuss the difference is a good sign.

### E.6 Popular neighborhoods (internal linking)

Padding `space/16` top + bottom.

**Header:** H3 *Popular neighborhoods*

**Layout:** 4-column grid of neighborhood cards (smaller, 200w x 140h):
- Botox in Upper East Side (180 injectors)
- Botox in Tribeca (94 injectors)
- Botox in Williamsburg (112 injectors)
- Botox in West Village (88 injectors)
- Botox in Midtown (140 injectors)
- Botox in Park Slope (62 injectors)
- Botox in Astoria (54 injectors)
- Botox in Long Island City (38 injectors)

### E.7 Related treatments in NYC

Padding `space/16` top + bottom. Background `color/bg/surface`.

**Header:** H3 *Other popular treatments in NYC*

**Layout:** 4-column row of treatment tiles (`C.6` variant):
- Dysport in NYC
- Lip Filler in NYC
- Tear Trough Filler in NYC
- Masseter Botox in NYC

### E.8 Recent reviews from NYC patients

Padding `space/16` top + bottom.

**Header:** H3 *What NYC patients are saying*

**Layout:** 3-column grid of review cards. Each card:
- 5-star row + treatment chip ("Botox")
- Quote (2 to 3 lines) in Tiempos Text body italic
- Patient first name + age range + neighborhood
- Injector name as link + date
- Verified review badge

### E.9 FAQ — NYC-specific

Padding `space/24` top + bottom.

Six accordion rows (`C.14`):
1. How much does Botox cost in New York City?
2. Do I need an MD, or can a nurse practitioner inject Botox in NY?
3. What's the average tip for an injector in NYC?
4. Which neighborhoods have the best Botox injectors in NYC?
5. How do I find a Botox injector who specializes in natural results?
6. Can I get same-day Botox in NYC?

### E.10 Internal link to treatment guide

Padding `space/16` top + bottom. Background `color/brand/accent-soft`.

**Layout:** Two-column.
- Left: H3 *New to Botox? Start with the guide.* + lede + Primary CTA "Read the Botox guide"
- Right: small thumbnail of the guide page hero.

### E.11 Footer

Use `C.12`.

---

## F. Frame 3: Treatment Guide (Botox)

**Frame name:** `03-Guide-Botox-Desktop-1440`
**Canvas:** 1440w x ~6800h.
**URL:** `/guides/botox`

### F.1 Header

`C.11`. Sticky activates after 120px scroll.

### F.2 Breadcrumb

Home / Guides / Botox.

### F.3 Article header block

Padding `space/16` top, `space/12` bottom. Max content width 800.

**Content top to bottom:**

1. Overline mint accent: "TREATMENT GUIDE · 12 MIN READ"
2. H1 Tiempos 48: *Botox: The Complete Guide*
3. Lede 22 Tiempos Text:
   Everything to know before your first Botox appointment. What it is, what it costs, what the risks are, and how to choose an injector you trust.
4. Byline row (two-column):
   - Left: Author block. 40px avatar + "By Hannah Reyes, Senior Editor" + sub-line "Hannah covers aesthetic medicine and has reported on the injectables industry for 6 years."
   - Right: Medical reviewer block. 40px avatar + "Medically reviewed by Dr. Lena Park, MD" + sub-line "Board-Certified Dermatologist, NYC. 14 years of clinical practice."
5. Meta row: "Last medically reviewed: May 18, 2026 · 12 min read · 8 sources"
6. Hero CTA card: full-width pill bar, mint-soft background. Left text: *Find a verified Botox injector near you.* Right: location input + primary "Search" button.

### F.4 Hero image

Below header. Full content-width image 800w x 480h, radius `lg`. Caption underneath in `caption` ink-tertiary: "Photo: Editorial. Not a real treatment moment."

### F.5 Body layout (two-column with sticky TOC)

**Layout:** Left rail 240w sticky TOC (`C.15`). Right content 720w body.

**TOC items:**
1. What is Botox?
2. How it works
3. Who is a good candidate?
4. What it treats
5. What it costs
6. Risks and side effects
7. How to choose an injector
8. What to expect at your appointment
9. Aftercare
10. FAQs
11. Find a provider

### F.6 Body sections

Each section: H2 Tiempos 36 + 2 to 4 paragraphs in `type/guide-body` Tiempos Text. Pull quotes (`C.17`) every 2 to 3 sections. Mini-CTAs (mint-soft callout cards) every 3 to 4 sections.

**Real copy for the first three sections (give designer enough to lay out the whole article):**

#### F.6.1 What is Botox?

Botox is a brand name for onabotulinumtoxinA, a purified protein derived from Clostridium botulinum. In the doses used for aesthetic treatments, it temporarily relaxes specific muscles in the face. The effect is local and predictable. It does not "freeze" your face when administered by a trained injector who knows the anatomy.

Botox was first approved by the FDA in 1989 for medical use and approved for cosmetic use in 2002. It has been studied in millions of patients since. Dysport, Xeomin, and Jeuveau are similar neurotoxins in the same category and are sometimes used interchangeably.

**Pull quote:** "The single most common reason patients are unhappy with Botox is the injector, not the molecule." — Dr. Lena Park, MD

#### F.6.2 How it works

Botox blocks the chemical signal between a nerve and a muscle. Without that signal, the muscle cannot contract. The skin above the muscle stops folding into a crease when you make an expression, and over weeks, the existing line softens.

It is temporary by design. Most patients see effects begin 3 to 5 days after injection, peak at 10 to 14 days, and last 3 to 4 months. The body metabolizes the protein and the muscle activity returns to baseline.

A trained injector picks the muscles to treat based on which expressions create which lines on your specific face. Two patients with similar foreheads can need very different treatment maps.

**Mini-CTA callout:** *Want to see how injectors approach the forehead vs the eyes? See verified Botox injectors in your city.* [Primary button: Find an injector]

#### F.6.3 Who is a good candidate?

Most healthy adults between 25 and 65 are candidates. There is no universal "right age." Some patients in their late 20s start preventatively when they notice lines forming during expression. Others wait until their 40s or 50s and treat lines that are already settled.

Botox is not recommended for people who are pregnant or breastfeeding, who have certain neuromuscular conditions (myasthenia gravis, Lambert-Eaton syndrome, ALS), or who have an active infection at the injection site. Your injector should ask about your medical history and current medications before treatment.

(Continue similar treatment for sections 4 through 9. Designer can use placeholder text for sections 4 through 9 in the mockup, with H2 headlines visible. Real copy will be commissioned for build.)

### F.7 Cost section (snippet-targeted)

**Layout:** H2 *What Botox costs in 2026* + supporting table.

| Region | Per unit | Forehead lines (20 units) | Crow's feet (12 units) | Full upper face (40 units) |
|---|---|---|---|---|
| National average | $14 | $280 | $168 | $560 |
| Northeast (NYC, Boston) | $16 to $18 | $320 to $360 | $192 to $216 | $640 to $720 |
| West Coast (LA, SF) | $15 to $17 | $300 to $340 | $180 to $204 | $600 to $680 |
| Midwest (Chicago) | $12 to $14 | $240 to $280 | $144 to $168 | $480 to $560 |
| South (Miami, Atlanta) | $13 to $15 | $260 to $300 | $156 to $180 | $520 to $600 |

Below table, callout: "These ranges are based on injector.world's 2025 review data across 12,400 providers. Prices vary by neighborhood, injector credentials, and product brand."

### F.8 How to choose an injector (checklist)

**Layout:** H2 + 10-item list with mint check marks. Each item has 1 to 2 sentences and a link to a directory filter.

1. Choose a licensed medical professional, not a non-medical "spa." (Filter: License verified)
2. Prefer board-certified dermatologists, plastic surgeons, or facial plastic surgeons for first-time treatments. (Filter: Board certified MD)
3. For NP or PA injectors, ask about the supervising physician and how long they have been injecting full-time.
4. Ask to see before-and-after photos of their patients, not stock images. (Filter: Has gallery)
5. A good injector takes a full medical history and asks about your goals before recommending units.
6. Be wary of clinics that quote a flat price without seeing your face.
7. Confirm the brand. Botox (Allergan), Dysport (Galderma), Xeomin, and Jeuveau are all valid.
8. Ask about their complication rate and their plan if something goes wrong.
9. Read at least 10 verified reviews, focused on the treatment you are getting.
10. Trust your gut. If anything feels off in the consult, leave.

### F.9 Before/after gallery

`C.16` grid, 3 cards. Each with consent disclaimer.

### F.10 Risks and side effects

**Layout:** H2 + body + 2-column list (Common vs Rare).

H2: *Risks and side effects*

Body intro: Botox is a well-studied treatment with a low complication rate when administered by a trained, licensed injector. That said, every medical treatment carries risk. Here is what to know.

Two columns:

| Common (resolve in days to weeks) | Rare (consult your injector immediately) |
|---|---|
| Bruising at injection site | Eyelid or eyebrow drooping (ptosis) |
| Headache for 24 to 48 hours | Asymmetry that does not resolve |
| Mild swelling or redness | Allergic reaction |
| "Heavy" forehead for 1 to 2 weeks | Difficulty swallowing (extremely rare) |
| Tenderness for 1 to 2 days | Vision changes (extremely rare) |

Below table, callout in `state/info` blue: "If you experience any of the rare side effects, contact your injector immediately. Most complications are resolvable when caught early."

### F.11 FAQs

Section H2 *Frequently asked questions*. 10 to 12 accordion rows (`C.14`). Schema-marked.

Questions:
1. How long does Botox last?
2. Does Botox hurt?
3. Can I exercise after Botox?
4. What's the difference between Botox and filler?
5. What's the difference between Botox, Dysport, and Xeomin?
6. Can I get Botox if I'm pregnant?
7. Will Botox make me look "frozen"?
8. How many units do I need?
9. Is Botox safe long-term?
10. What if I don't like the result?
11. Can I get Botox in my 20s?
12. Are tox parties or "Botox bars" safe?

### F.12 Provider CTA block

Padding `space/24` top + bottom. Background `color/brand/primary` navy. White text.

**Layout:** Centered, 720 max.

- Overline white mint: "READY TO BOOK?"
- H2 white: *Find a verified Botox injector near you.*
- Search bar `C.3` white pill on navy.
- Below search, micro stat row in white 70%: "1,240 NYC · 1,080 LA · 820 Miami · 640 Chicago · See all cities"

### F.13 Related guides

Padding `space/16` top + bottom.

**Header:** H3 *Keep reading*

**Layout:** 3-column guide cards (`C.5`):
- Botox vs Dysport: Which Lasts Longer?
- Masseter Botox: A Complete Guide
- How to Choose an Aesthetic Injector

### F.14 Author + reviewer bios

Padding `space/16` top + bottom. Background `color/bg/surface`.

**Layout:** Two side-by-side bio cards.

Each bio card:
- 80px avatar
- Name + role (H4)
- 3-line bio in `body`
- Credentials list with link icons (LinkedIn, NPI, board cert)
- Two recent articles linked

### F.15 Footer

`C.12`.

---

## G. Mobile Adaptations (390 width)

Frames: `01-Home-Mobile-390`, `02-City-Mobile-390`, `03-Guide-Mobile-390`.

**Universal mobile rules:**

1. **Header:** Logo left, hamburger right. Search becomes its own tap target row below logo or inside the menu sheet.
2. **Hero search bar:** Stack vertically. Treatment dropdown → Location input → Primary button (full width).
3. **Grids:** 4-col desktop → 2-col mobile. 3-col desktop → 1-col mobile (provider cards, guide cards).
4. **Filter rail:** Becomes a bottom-sheet modal triggered by a sticky "Filters" button (mint accent, full-width bar) at the bottom of the viewport.
5. **TOC:** Becomes a sticky collapsible bar under the header on the guide page. Tap to expand.
6. **Section padding:** All `space/24` becomes `space/16`.
7. **Map + list toggle:** List default. Map opens fullscreen.
8. **Footer:** Single column. Sections become accordion rows.

**Specific mobile tweaks:**

- Provider card mobile: 358w x 460h. Two-button row remains side-by-side (170w each).
- City tile mobile: 358w x 200h.
- Treatment tile mobile: 170w x 160h (2-col grid).

---

## H. Asset Brief (Unsplash placeholders)

Use Unsplash for everything. Filter by orientation and license-free.

| Asset | Quantity | Unsplash search term | Notes |
|---|---|---|---|
| Hero background or accent | 1 | "clinical interior soft light" or "minimal beauty editorial" | Subtle, off-white, no people in main view |
| Provider portraits (diverse) | 12 | "professional headshot doctor", "dermatologist portrait", "nurse practitioner portrait" | Mix gender, ethnicity, age 30s to 50s. Lab coat or business casual. Plain background. |
| Patient before/after stand-ins | 6 pairs | "natural skin closeup face" + "natural skin closeup smiling" | Editorial, no obvious filters. Same face per pair in production. |
| City photos | 12 | "manhattan skyline", "los angeles palm trees", "miami brickell" | Architectural, not generic skylines. Mid-day, soft. |
| Guide hero | 3 | "minimal beauty editorial", "skincare closeup editorial", "soft natural light face" | Editorial, calm |
| Clinic interior | 4 | "modern medical office", "minimal dermatology clinic" | Clean, plant, soft light |
| Credential logos (4) | 4 | Vector marks for ABMS, AAD, ASPS, ASDS | Use monochrome wordmarks. Note: confirm permitted use before launch. |
| Press logos | 6 | Vogue, Allure, NYT, Vox, WSJ, Refinery29 | "As seen in" row. Note: use only when actually featured. |

**Unsplash collection suggestion:** Build a private collection "injectors-world-mockup" so all assets are in one place. Tag photos by section.

---

## I. Annotation Layer (for client review)

Build a separate Figma page named `04-Annotations`. Drop each frame in, then overlay numbered pins with notes. These are what you talk to during the client review.

### Homepage annotations (12 pins)

1. **Search bar** → "Schema: WebSite + SearchAction. Captures `[treatment] x [location]` queries."
2. **Trust bar credentials** → "Above-fold trust density. Critical in YMYL aesthetic category."
3. **Treatment grid** → "Each tile is two CTAs: read the guide and find a provider. Content + directory in one unit."
4. **City grid** → "Programmatic SEO showcase. 200+ cities live on launch."
5. **Featured injector cards** → "Editorial pick, not paid. 'Editor's Pick' ribbon on premium-tier listings."
6. **Guide cards** → "Medical reviewer byline visible on every card. E-E-A-T at a glance."
7. **How we verify** → "The page that competitors do not have. Differentiator."
8. **Before/after** → "Consent badge on every photo. Required for credibility."
9. **FAQ** → "Schema: FAQPage. Each FAQ links to its full guide. Sitewide internal linking strategy."
10. **Pre-footer search** → "Second conversion opportunity for users who scrolled past hero."
11. **Footer** → "Sitemap structure: treatments x cities x guides. Internal link density for SEO."
12. **Sticky header (after scroll)** → "Mini-search persists. No dead-end pages."

### City page annotations (10 pins)

1. **Breadcrumb** → "Schema: BreadcrumbList. Anchors page in URL hierarchy."
2. **H1 with provider count** → "Targets `botox new york city` and `botox nyc` exact-match queries."
3. **Stat row** → "Above-fold trust + price transparency. Reduces bounce."
4. **Filter rail** → "Mirrors Google query intent: by neighborhood, by credential, by specialty."
5. **Sort toggle** → "Default 'Editor's picks' keeps editorial control. Patient can re-sort by rating or price."
6. **Provider card** → "Single most important unit on the site. Trust signals on every card."
7. **Local editorial block** → "The SEO weapon. Edited copy beats generic templates. Same template, unique content per city."
8. **Popular neighborhoods** → "Internal linking to long-tail neighborhood pages. Captures `botox tribeca` and similar."
9. **Related treatments in NYC** → "Lateral movement. Same-city, adjacent-treatment intent."
10. **NYC FAQ** → "Schema: FAQPage scoped to city. Targets People Also Ask boxes in SERPs."

### Treatment guide annotations (10 pins)

1. **H1 + lede** → "Targets `botox guide` and `botox what to know`."
2. **Byline row** → "Author + Medical Reviewer visible. Highest E-E-A-T lever in YMYL."
3. **Hero CTA** → "Inline conversion path. Reader does not have to scroll back to top."
4. **Sticky TOC** → "Improves engagement metrics: dwell time, scroll depth."
5. **Pull quote from reviewer** → "Doctor's voice surfaces inside the article body. Trust at peak attention moment."
6. **Cost table** → "Targets featured snippet for `how much does botox cost`. Structured for SERP capture."
7. **Mini-CTAs inside body** → "Conversion every 3 to 4 sections. Reader is funneling, not stranded."
8. **Risks section** → "Balanced coverage. Required for medical YMYL ranking. Most competitors skip this."
9. **FAQ accordion** → "Schema: FAQPage. 10 to 12 questions captures People Also Ask saturation."
10. **Author + reviewer bios at end** → "Schema: Person with sameAs. Builds author entity over time across the site."

---

## J. Figma File Structure

Single file: `injectors-world-mockups.fig`.

**Pages (left rail):**

1. `00-Cover` → Title board, positioning line, table of contents.
2. `01-Design-System` → Color, type, spacing, radii, shadow, grid swatches.
3. `02-Components` → Master components from section C.
4. `03-Home` → Desktop + mobile + variants.
5. `04-City` → Desktop + mobile + 2nd city variant (LA) to show programmatic.
6. `05-Guide` → Desktop + mobile.
7. `06-Money-Flow` → 4 frames side by side: Home → City → Provider preview → Booking modal.
8. `07-Annotations` → All three frames with pin overlays.
9. `08-Architecture` → IA diagram (URL tree, schema map).
10. `09-CMS-Structure` → Payload collection diagram.
11. `10-Phase-2-Roadmap` → What is in scope after launch.

**Frame naming convention:** `[Page#]-[Page name]-[Device]-[Variant]`. Example: `03-Home-Desktop-1440-Default`, `04-City-Mobile-390-Filter-Open`.

**Layer naming:** Use `section/[name]`, `block/[name]`, `component/[name]`, `text/[name]` so the Figma layer panel reads like a sitemap.

---

## K. Build Order

Execute in this order. Each step unblocks the next.

1. **Set up the file.** Create the pages from J.
2. **Build the design system page.** Drop all color, type, spacing, radius, shadow tokens as styles + variables.
3. **Build the component library.** Start with Button → Input → Search bar → Trust badge → Star rating → Provider card → Guide card → Treatment tile → City tile → Filter chip → Header → Footer. Each as a component with variants.
4. **Frame 1: Homepage desktop.** Use only components. Drop in real copy from D.
5. **Frame 2: City page desktop.** Reuse provider card, header, footer.
6. **Frame 3: Guide page desktop.** Reuse guide card, header, footer.
7. **Mobile adaptations** for all three.
8. **Money flow board (page 06).** Duplicate hero, city, profile, booking modal frames side-by-side.
9. **Annotations layer (page 07).** Pin overlays.
10. **Cover + supporting boards** (architecture, CMS, phase 2).

**Time estimate for a single designer with this spec in hand:**
- Design system + components: 2 days.
- Three desktop frames: 2 days.
- Three mobile frames: 1 day.
- Money flow, annotations, supporting boards: 1.5 days.
- Polish, real photo curation, review: 1.5 days.
- Total: 8 working days.

---

## Quick checklist before review

- [ ] Every page has trust signals visible in the first viewport.
- [ ] Real copy everywhere. No lorem ipsum.
- [ ] Medical reviewer visible on the guide and on at least one homepage section.
- [ ] City page has the locally-edited editorial block.
- [ ] Annotations layer is ready and explains the SEO strategy without you having to talk.
- [ ] Money flow board shows search to booking in 4 frames.
- [ ] Mobile frames present for all three pages.
- [ ] One delightful detail per frame: verified pulse, sticky TOC, before/after slider hover.

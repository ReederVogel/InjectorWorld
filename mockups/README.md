# injector.world — Mockups

Three working high-fidelity HTML mockups for the client. Open in any browser. Fully responsive (desktop + mobile + tablet).

## What's in here

| File | What it is | URL pattern in the real product |
|---|---|---|
| `index.html` | Homepage | `injector.world/` |
| `city.html` | Local directory page (Botox in New York City) | `injector.world/botox/new-york-ny` |
| `guide.html` | Treatment guide (Botox: The Complete Guide) | `injector.world/guides/botox` |

All three pages link to each other through the nav, cards, and CTAs. You can click around like it's a real site.

---

## How to open them on your computer

### Easiest way

1. Open File Explorer.
2. Navigate to `C:\Users\risha\injector.world\mockups\`.
3. Double-click `index.html`. It opens in your default browser (Edge or Chrome).
4. Click through to the city page and guide page using the nav links.

That's it. No install. No build. Internet needed only to load fonts and images.

### To check the mobile view

Open the page in Chrome, then:

- Press `F12` (opens DevTools).
- Click the small phone/tablet icon at the top-left of DevTools (or press `Ctrl + Shift + M`).
- Pick "iPhone 14 Pro" or "Pixel 7" from the dropdown at the top.
- Reload the page.

Now you see the mobile version. Show this to the client side-by-side with desktop.

---

## How to share with the client

You have three options, from easiest to most professional.

### Option 1: Screen share on a call (zero setup)

1. Open the pages on your computer.
2. Share your screen on Zoom, Google Meet, or whatever you use.
3. Walk the client through homepage to city to guide.

Good for a first review call.

### Option 2: Zip and email (5 minutes)

1. Right-click the `mockups` folder.
2. Select "Send to" then "Compressed (zipped) folder".
3. Email the zip to the client.
4. They unzip and double-click `index.html` to view.

Catch: some Windows builds block downloaded HTML files from loading external fonts. Works for most clients, but not all.

### Option 3: Deploy a live link (10 minutes, looks most professional)

This gives you a real URL the client can open from anywhere. Free. No coding needed.

**Recommended: Netlify Drop**

1. Go to https://app.netlify.com/drop
2. Drag the entire `mockups` folder into the page.
3. Wait 30 seconds.
4. Netlify gives you a URL like `https://lucky-cat-12345.netlify.app/`.
5. Send that URL to the client. Done.

**Alternative: Vercel**

1. Go to https://vercel.com/new
2. Create a free account.
3. Drag the `mockups` folder. Same flow.

Both are free for static sites like this.

---

## What the client will see

### Homepage (`index.html`)
- Hero with treatment + location search
- Trust bar with credential logos and aggregate stats
- 12 treatment tiles (Botox, Lip Filler, etc.)
- 8 city tiles with provider counts
- 3 featured injector cards (Editor's Picks)
- 3 guide cards with medical reviewer bylines
- "How we verify" 3-step trust section
- 3 before/after stories
- 6 FAQ accordion items
- Pre-footer CTA in navy
- Full footer with sitemap

### City page (`city.html`)
- Breadcrumb (Home / Botox / New York)
- Local hero with 4 stats and dual CTA
- Sticky filter rail with 7 filter groups (neighborhood, price, rating, credentials, specialty, languages, other)
- 6 provider cards with review pull quotes
- Sort dropdown and Map/List toggle
- 500-word locally-edited editorial block reviewed by Dr. Lena Park
- 8 neighborhood internal links
- 4 related treatments in NYC
- 3 verified patient reviews
- NYC-specific FAQ (5 questions)
- Internal link block to the Botox guide

### Guide page (`guide.html`)
- Breadcrumb and overline
- Article header with byline + medical reviewer (the E-E-A-T signal)
- Inline find-an-injector CTA right under the byline
- Hero image with editorial caption
- Sticky table of contents on the left
- 11 body sections with real medical copy
- 2 pull quotes from the medical reviewer
- Cost table by US region (snippet-targeted)
- 10-step "How to choose an injector" checklist with filter links
- Risks and side effects in a 2-column layout (common vs rare)
- 6 FAQs with accordions
- Provider CTA section in navy
- 3 related guides
- Author and medical reviewer bio cards with credentials
- Editorial standards callout

---

## What to say in the client meeting

Open with the **money flow**. This is the single most powerful demo path:

1. Start on the homepage. Point to the hero search.
2. Click "New York City" in the city grid (or any provider card). Land on the city page.
3. Scroll the city page. Stop at the locally-edited editorial block. Say: *This is the SEO weapon. Same template across 200 cities, but the content under it is human-edited per city. That is what beats competitor pages on Google.*
4. Click "Read the Botox guide" CTA. Land on the guide page.
5. Stop at the byline row. Say: *Every guide has a named medical reviewer with credentials. This is the single biggest trust signal for a YMYL medical category. It's also what Google's E-E-A-T algorithm rewards.*
6. Scroll to the cost table. Say: *This kind of structured data is what wins featured snippets on cost queries.*
7. Scroll to the "How to choose an injector" checklist. Point out the filter links. Say: *Every checklist item links back to a filter on the directory. Content does not live as an island, it feeds the directory.*

That's a 4-minute walkthrough that sells the whole strategy.

---

## Differences between this mockup and the production build

I used free font substitutes to keep the mockup fast and portable:

| Mockup uses | Production should use | Why |
|---|---|---|
| Fraunces (Google Fonts) | Tiempos Headline (Klim Type Foundry) | Tiempos is the paid premium serif. Fraunces is the closest free match. Same editorial feeling. |
| Inter (Google Fonts) | GT America (Grilli Type) | GT America is the paid premium sans. Inter is the closest free match. |
| picsum.photos / pravatar.cc placeholders | Real provider photos, real city photos, real before/after pairs | Mockup uses random placeholders so you don't wait for an Unsplash search. Production needs licensed photos. |

The colors, spacing, layout, and components are exactly what the production build should use. Only fonts and images need to be swapped at build time.

---

## If the client wants a Figma file too

Some clients insist on Figma. You have two paths:

1. **Hand them this HTML + the design spec.** A designer can build the Figma file in 2 to 3 days using these pages as visual reference and the `figma-build-spec.md` as the data source. Cheaper than building Figma from scratch.

2. **Use Figma's "Import from URL" with a deployed link.** Plugins like *html.to.design* can pull the rendered pages into Figma. The result needs cleanup but gives you a starting point in a few minutes.

---

## What's not in the mockup yet (and why)

These are intentionally out of scope for v1 client review:

- Provider profile page (full individual injector page)
- Booking modal with date picker
- Provider claim and verification flow
- Provider dashboard (where they edit their profile, respond to reviews, manage bookings)
- Review submission form
- Patient account flow (sign up, shortlist, history)
- Search results page (when user types something other than a top treatment or city)

These exist in the strategy doc but are bigger lifts. Build them in phase 2 after the client signs off on the visual direction.

---

## Files in this folder

```
mockups/
├── index.html          (homepage)
├── city.html           (NYC directory page)
├── guide.html          (Botox treatment guide)
└── README.md           (this file)
```

Three HTML files. Self-contained. No build step. No dependencies to install. Open and go.

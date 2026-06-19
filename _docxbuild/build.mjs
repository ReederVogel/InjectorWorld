import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
  LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType, VerticalAlign,
  PageNumber, PageBreak, Header, Footer, TableOfContents, TabStopType, TabStopPosition,
} from 'docx'
import fs from 'node:fs'

// ---- palette ----
const NAVY='0B1B34', MINT='2F8E76', GREEN='2E7D32', AMBER='B7791F', RED='B91C1C',
      BLUE='1E40AF', GRAY='64748B', INK='1F2937', MUTED='475569', WHITE='FFFFFF'
const F_MINT='E6F2EE', F_SURF='F2F5F8', F_AMBER='FBEFD6', F_RED='FBE4E4', F_BLUE='E2E9FB', F_GRAY='ECEFF3', F_NAVY='0B1B34'
const CW = 9360

// ---- helpers ----
const run = (text, o={}) => new TextRun({ text: String(text), font: 'Arial', ...o })
const para = (children, o={}) => new Paragraph({ children: Array.isArray(children) ? children : [run(children)], ...o })
const H = (text, level) => new Paragraph({ heading: level, children: [run(text)] })
const bullet = (children) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 40 }, children: Array.isArray(children) ? children : [run(children)] })
const numbered = (children) => new Paragraph({ numbering: { reference: 'n', level: 0 }, spacing: { after: 40 }, children: Array.isArray(children) ? children : [run(children)] })
const spacer = (h=120) => new Paragraph({ spacing: { after: h }, children: [run('')] })

const TB = { style: BorderStyle.SINGLE, size: 2, color: 'D5DBE3' }
const tableBorders = { top: TB, bottom: TB, left: TB, right: TB, insideHorizontal: TB, insideVertical: TB }
const NB = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const noBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB }

function cell(text, { w, fill, bold=false, color=INK, align=AlignmentType.LEFT, size=19, span, borders } = {}) {
  const kids = Array.isArray(text) && text[0] instanceof Paragraph
    ? text
    : [new Paragraph({ alignment: align, children: Array.isArray(text) ? text : [run(text, { bold, color, size })] })]
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    columnSpan: span,
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    borders,
    children: kids,
  })
}
function table(rows, columnWidths) {
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths, borders: tableBorders, rows })
}
function headerRow(labels, widths, fill=F_NAVY, color=WHITE) {
  return new TableRow({ tableHeader: true, children: labels.map((l, i) => cell(l, { w: widths[i], fill, bold: true, color, size: 19 })) })
}

// severity bar (unicode blocks, colored)
function sevRow(label, count, color, fill) {
  const blocks = count > 0 ? '█'.repeat(count) : '— none'
  return new TableRow({ children: [
    cell(label, { w: 2000, bold: true, color: INK, size: 19, fill: F_SURF }),
    cell([ run(blocks, { color, size: 19 }), run('   ' + count, { bold: true, color: INK, size: 19 }) ], { w: 7360 }),
  ]})
}

// pipeline box
function pbox(title, sub, fill, color) {
  return cell([
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(title, { bold: true, color, size: 18 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [run(sub, { color, size: 15 })] }),
  ], { w: 1700, fill })
}
const arrowCell = () => cell('→', { w: 215, align: AlignmentType.CENTER, bold: true, color: GRAY, size: 22, borders: noBorders })

// ---- content ----
const children = []

// COVER
children.push(new Paragraph({ spacing: { before: 1400, after: 80 }, alignment: AlignmentType.CENTER, children: [run('injector.world', { bold: true, size: 30, color: NAVY })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run('Full Codebase Audit', { bold: true, size: 56, color: NAVY })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [run('Security, data, content publishing, journeys, UI/UX, accessibility', { size: 22, color: MUTED })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run('Overall grade', { size: 22, color: MUTED })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run('A−', { bold: true, size: 130, color: GREEN })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [run('Launch-ready after a short fix list', { size: 22, color: INK })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run('Prepared for the founders  ·  19 June 2026', { size: 20, color: MUTED })] }))
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run('Read-only audit · no application code changed · database restored after testing', { size: 18, color: GRAY, italics: true })] }))
children.push(new Paragraph({ children: [new PageBreak()] }))

// TOC
children.push(H('Contents', HeadingLevel.HEADING_1))
children.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }))
children.push(new Paragraph({ children: [new PageBreak()] }))

// 1. EXECUTIVE SUMMARY
children.push(H('1. Executive summary', HeadingLevel.HEADING_1))
children.push(para([ run('The site is in genuinely good shape. ', { bold: true }), run('It is built carefully, with security considered far more thoroughly than is typical at this stage. There is no critical, site-breaking bug. After a short list of fixes (led by one trust issue), it is ready for a full public launch.') ]))
children.push(para([ run('This audit covered eight areas end to end: security, the database and backend, content publishing (JSON and CSV), routing, the patient / provider / clinic / admin journeys, UI and UX, dead code and contradictions, and accessibility. Everything was checked both by reading the code and by running the live site, including real test uploads that were later removed.') ]))
children.push(spacer(80))
children.push(para([ run('Verdict at a glance', { bold: true, size: 22, color: NAVY }) ]))
children.push(table([
  new TableRow({ children: [ cell('0', { w: 2340, fill: F_MINT, bold: true, color: GREEN, size: 40, align: AlignmentType.CENTER }), cell('50+', { w: 2340, fill: F_SURF, bold: true, color: NAVY, size: 40, align: AlignmentType.CENTER }), cell('25', { w: 2340, fill: F_SURF, bold: true, color: NAVY, size: 40, align: AlignmentType.CENTER }), cell('0', { w: 2340, fill: F_MINT, bold: true, color: GREEN, size: 40, align: AlignmentType.CENTER }) ] }),
  new TableRow({ children: [ cell('critical bugs', { w: 2340, fill: F_MINT, color: MUTED, align: AlignmentType.CENTER }), cell('pages, all pass', { w: 2340, fill: F_SURF, color: MUTED, align: AlignmentType.CENTER }), cell('data collections', { w: 2340, fill: F_SURF, color: MUTED, align: AlignmentType.CENTER }), cell('console errors', { w: 2340, fill: F_MINT, color: MUTED, align: AlignmentType.CENTER }) ] }),
], [2340,2340,2340,2340]))
children.push(spacer(120))

// scorecard grid
children.push(para([ run('Area grades', { bold: true, size: 22, color: NAVY }) ]))
const card = (name, grade, gcolor, desc, fill) => cell([
  new Paragraph({ children: [run(name, { bold: true, color: INK, size: 18 })] }),
  new Paragraph({ spacing: { before: 20, after: 20 }, children: [run(grade, { bold: true, color: gcolor, size: 34 })] }),
  new Paragraph({ children: [run(desc, { color: MUTED, size: 16 })] }),
], { w: 3120, fill })
children.push(table([
  new TableRow({ children: [ card('Security', 'A−', GREEN, 'No injection, no IDOR', F_SURF), card('Backend & data', 'A', GREEN, '25 collections locked', F_SURF), card('Content publishing', 'A', GREEN, 'Upload to live works', F_SURF) ] }),
  new TableRow({ children: [ card('Routing', 'A', GREEN, 'All page types load', F_SURF), card('UI & UX', 'A−', GREEN, 'Clean light + dark', F_SURF), card('Accessibility', 'B+', AMBER, 'Good base, small gaps', F_SURF) ] }),
], [3120,3120,3120]))
children.push(spacer(120))

// severity chart
children.push(para([ run('Findings by severity', { bold: true, size: 22, color: NAVY }) ]))
children.push(table([
  sevRow('Critical', 0, GREEN, F_SURF),
  sevRow('High', 1, RED, F_SURF),
  sevRow('Medium', 6, AMBER, F_SURF),
  sevRow('Low', 5, BLUE, F_SURF),
  sevRow('Polish', 11, GRAY, F_SURF),
], [2000,7360]))
children.push(new Paragraph({ children: [new PageBreak()] }))

// 2. METHOD
children.push(H('2. What was tested, and how', HeadingLevel.HEADING_1))
children.push(para('Three lenses were used: reading the code, running the live site, and checking the build. Concrete evidence collected:'))
children.push(bullet([ run('Build health: ', { bold: true }), run('full TypeScript typecheck passed clean.') ]))
children.push(bullet([ run('JSON publishing: ', { bold: true }), run('logged in as admin, uploaded a news article (created = 1), it sat as pending, was approved, and the public page returned HTTP 200 with title and body rendered.') ]))
children.push(bullet([ run('CSV import: ', { bold: true }), run('uploaded sample providers/clinics/reviews; a duplicate provider was correctly skipped and an unknown treatment was flagged; dry-run matched the real run exactly.') ]))
children.push(bullet([ run('Pages: ', { bold: true }), run('about 50 URLs across all page templates plus feeds, auth redirects, and 404s — all behaved correctly.') ]))
children.push(bullet([ run('Accessibility: ', { bold: true }), run('live homepage scan — one H1, clean heading order, 104 of 104 images had alt text, all links and buttons named.') ]))
children.push(bullet([ run('UI: ', { bold: true }), run('light, dark, and mobile (375px) screenshots; zero application console errors.') ]))
children.push(bullet([ run('Safety: ', { bold: true }), run('a full database backup was taken before any write and restored afterward; all temporary test data was removed.') ]))

// 3. CONTENT PUBLISHING
children.push(H('3. Content publishing — JSON and CSV both verified', HeadingLevel.HEADING_1))
children.push(para([ run('Both publishing paths were tested with real uploads and both work. ', {}), run('The flow is a deliberate editorial gate: nothing goes public until a human approves it.', { bold: true }) ]))
children.push(spacer(60))
children.push(para([ run('How a page gets published', { bold: true, size: 20, color: NAVY }) ]))
children.push(table([ new TableRow({ children: [
  pbox('Upload', 'JSON / CSV', F_GRAY, INK), arrowCell(),
  pbox('Validate', '+ dry-run', F_GRAY, INK), arrowCell(),
  pbox('Pending', 'not public', F_AMBER, '7A4F12'), arrowCell(),
  pbox('Approve', 'admin', F_MINT, '1C5F4A'), arrowCell(),
  pbox('Live', 'public', F_MINT, '1C5F4A'),
]})], [1700,215,1700,215,1700,215,1700,215,1700]))
children.push(spacer(60))
children.push(para([ run('Bad rows', { bold: true }), run(' are flagged as DataAlerts and skipped; the rest of the batch still imports. Approved pages are live immediately, but stay hidden from Google until a separate "drip index" step releases them — this lets you control SEO timing.') ]))
children.push(spacer(60))
children.push(para([ run('One rule to remember (by design): ', { bold: true, color: AMBER }), run('a JSON article is skipped if its author is not already in the Authors list. Before a bulk content upload, create the authors first (or an "Editorial Team" author). The importer reports this clearly.') ]))

// 4. PAGE COVERAGE
children.push(H('4. Page coverage', HeadingLevel.HEADING_1))
children.push(para('About 50 URLs were loaded across every page template. Summary:'))
children.push(table([
  headerRow(['Group', 'Examples', 'Result'], [2600,4760,2000]),
  new TableRow({ children: [ cell('Core content (25)', { w: 2600 }), cell('home, /injectors, /clinics, /guides, /news, /questions, /pricing, legal pages', { w: 4760, size: 17 }), cell('All 200', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Auth & utility (6)', { w: 2600 }), cell('/login, /signup, /forgot-password, /reset-password, newsletter pages', { w: 4760, size: 17 }), cell('All 200', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Protected (2)', { w: 2600 }), cell('/dashboard, /profile (logged out)', { w: 4760, size: 17 }), cell('Redirect to login', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Dynamic (6 types)', { w: 2600 }), cell('/botox, /los-angeles-ca, city directory, neighborhood, provider, clinic, brand, treatment area', { w: 4760, size: 17 }), cell('All 200', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('SEO / machine', { w: 2600 }), cell('/sitemap.xml, /robots.txt, /llms.txt, /news/rss.xml', { w: 4760, size: 17 }), cell('All 200', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Bogus URLs', { w: 2600 }), cell('/this-page-does-not-exist, /botox/nowhere-zz', { w: 4760, size: 17 }), cell('Correct 404', { w: 2000, color: GREEN, bold: true }) ]}),
], [2600,4760,2000]))
children.push(spacer(80))
children.push(para([ run('Note (development only): ', { bold: true }), run('while loading many never-seen pages in a burst, the development server hit a memory limit and auto-restarted (one /login compile took 143 seconds). This is normal for Next.js dev mode, which compiles each page on first visit. Production is pre-built and serves pages in milliseconds, so this will not happen live. Keep ~4 GB free on the dev machine.') ]))
children.push(new Paragraph({ children: [new PageBreak()] }))

// 5. FINDINGS
children.push(H('5. Findings, by priority', HeadingLevel.HEADING_1))
children.push(para('Each finding lists what it is, where, why it matters, the effort to fix, and the fix.'))

const finding = (tag, tagColor, title, rows) => {
  children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [ run(tag + '  ', { bold: true, color: tagColor, size: 22 }), run(title, { bold: true, size: 22, color: NAVY }) ] }))
  children.push(table(rows.map(([k,v]) => new TableRow({ children: [ cell(k, { w: 1500, fill: F_SURF, bold: true, color: MUTED, size: 17 }), cell(v, { w: 7860, size: 18 }) ]})), [1500,7860]))
}

finding('HIGH', RED, 'H1 — "License verified" badge shows on EXPIRED licenses', [
  ['Where', 'lib/license.ts:12; shown on injectors/[slug]/page.tsx:167, QuickViewPanel.tsx:101, FeaturedInjectors.tsx:75, dashboard/page.tsx:259'],
  ['What', 'A provider with an Expired license still gets the green "License verified" badge. Her profile shows "License verified" at the top and "License: ... — Expired" three lines down.'],
  ['Why it matters', 'The whole brand is trust. A green verified mark on an expired license misleads patients and is exactly what a consumer-protection regulator (FTC) examines. The badge checks "is there a verification link?" but never "is the license active?"'],
  ['Effort', 'Low (a few hours).'],
  ['Fix', 'Show the green badge only when license status is Active. For Expired / Inactive / Suspended, show a neutral or amber label such as "License on file" or "License expired".'],
])
const med = (t, rows) => finding('MEDIUM', AMBER, t, rows)
med('M1 — Signup form is weaker than the others', [
  ['Where', 'app/api/auth/signup/route.ts'],
  ['What', 'No anti-CSRF check, no CAPTCHA, and an IP-detection method a bot can fake — so the "5 signups/hour" limit can be bypassed to mass-create fake accounts.'],
  ['Fix', 'Use the same shared protections the booking and claim forms already use (checkOrigin + shared rate limiter + CAPTCHA).'],
])
med('M2 — Eight write endpoints have no anti-CSRF check', [
  ['Where', 'account/profile, auth/signup, providers/view, admin/scan, admin/branches, admin/backup, admin/newsletter/send-news, dashboard/zip-feature-request'],
  ['What', 'The other 14 write routes have it. For the admin ones, a tricked logged-in admin could be forced to trigger a backup or scan.'],
  ['Fix', 'Add the one-line checkOrigin guard to each route.'],
])
med('M3 — Hidden reviews are readable through the public API', [
  ['Where', 'collections/Reviews.ts:14'],
  ['What', 'Public read does not hide "pending" or "rejected" reviews. The Q&A collection does this correctly.'],
  ['Fix', 'Copy the Q&A pattern so only approved reviews are public.'],
])
med('M4 — Six structured-data blocks are not escaped', [
  ['Where', 'NeighborhoodPage, CityHubPage, StateHubPage, CityDirectoryPage, TreatmentStatePage, TreatmentPillarPage'],
  ['What', 'These write SEO JSON without the </script>-escape the other 8 pages use. Since that data includes imported clinic/FAQ text, it is a latent code-injection path.'],
  ['Fix', 'Apply the same escape everywhere, or use one shared component.'],
])
med('M5 — Provider onboarding link is broken', [
  ['Where', 'collections/Claims.ts:64'],
  ['What', 'When admin approves a claim for a brand-new user, they are pointed to /setup-account — but that page does not exist, so they cannot set their password.'],
  ['Fix', 'Build the page, or send a normal password-reset email instead.'],
])
med('M6 — Rate-limit IP detection needs the right proxy setting', [
  ['Where', 'lib/rate-limit.ts:84'],
  ['What', 'A self-contradicting comment about reading the visitor IP. If TRUSTED_PROXY_COUNT is wrong for DigitalOcean, rate limits can be dodged.'],
  ['Fix', 'Confirm the host setup, set the value, and clean up the comment.'],
])
children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [ run('LOW', { bold: true, color: BLUE, size: 22 }), run('   five items', { color: MUTED, size: 18 }) ] }))
children.push(bullet([ run('L1 admin email mismatch ', { bold: true }), run('— config says admin@injector.world, the real admin is admin@injectors.world. Pick one.') ]))
children.push(bullet([ run('L2 city-page "License verified" ', { bold: true }), run('— a static blanket claim; make sure it is defensible.') ]))
children.push(bullet([ run('L3 imported links not scheme-checked ', { bold: true }), run('— a javascript: link in imported content would be clickable. Allow only http(s)/mailto/tel/internal.') ]))
children.push(bullet([ run('L4 localhost allowed in production ', { bold: true }), run('— harmless but should be dev-only.') ]))
children.push(bullet([ run('L5 redirect param inconsistent ', { bold: true }), run('— /dashboard uses ?next=, /profile uses ?redirect=. Pick one.') ]))
children.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [ run('POLISH', { bold: true, color: GRAY, size: 22 }), run('   eleven nice-to-haves', { color: MUTED, size: 18 }) ] }))
children.push(para('Move rate limiting to Redis before running multiple servers; restrict the Mapbox token to injector.world; rotate R2 keys if ever shared; add a double-submit guard on bookings; consider a stricter Content-Security-Policy; remove placeholder image hosts before launch; add a "Skip to content" link; add a favicon; fix the mobile header glitch (§9); label one input (§8); review mobile touch-target sizes (§8).'))
children.push(new Paragraph({ children: [new PageBreak()] }))

// 6. JOURNEYS
children.push(H('6. Persona journeys — all four work', HeadingLevel.HEADING_1))
children.push(table([
  headerRow(['Journey', 'What was checked', 'Status'], [2200,5160,2000]),
  new TableRow({ children: [ cell('Patient', { w: 2200, bold: true }), cell('Home / search to city directory to provider profile to booking. The booking form is well-protected: anti-CSRF, rate limit, CAPTCHA, consent required, and it verifies the clinic belongs to the provider.', { w: 5160, size: 17 }), cell('Works', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Provider', { w: 2200, bold: true }), cell('Login and dashboard load. A provider can edit only their own profile and only safe fields (never license, rating, or verified flag). Onboarding link gap = M5.', { w: 5160, size: 17 }), cell('Works', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Clinic owner', { w: 2200, bold: true }), cell('Clinic pages load; brand and branch linking works ("3 locations"); owner has a locations dashboard.', { w: 5160, size: 17 }), cell('Works', { w: 2000, color: GREEN, bold: true }) ]}),
  new TableRow({ children: [ cell('Admin', { w: 2200, bold: true }), cell('Import to approve to publish all verified live. Wipe needs a typed phrase plus an automatic backup. The activity log is append-only and cannot be tampered with.', { w: 5160, size: 17 }), cell('Works', { w: 2000, color: GREEN, bold: true }) ]}),
], [2200,5160,2000]))

// 7. SECURITY
children.push(H('7. Security scorecard', HeadingLevel.HEADING_1))
const sec = (k,v,ok) => new TableRow({ children: [ cell(k, { w: 5560, size: 18 }), cell(v, { w: 3800, color: ok===1?GREEN:(ok===0?AMBER:RED), bold: true, size: 18 }) ]})
children.push(table([
  headerRow(['Control', 'Status'], [5560,3800]),
  sec('SQL injection','Safe — values parameterized, numbers validated',1),
  sec('XSS (script injection)','Mostly safe (2 hardening gaps: M4, L3)',0),
  sec('Patient becoming admin','Blocked — role is access-controlled',1),
  sec('Editing someone else’s data','Blocked — target taken from login token',1),
  sec('Sensitive data (bookings, emails)','Staff-only; public create blocked',1),
  sec('Server secret strength','Refuses to start in prod if weak',1),
  sec('Activity audit log','Append-only, tamper-resistant',1),
  sec('Anti-CSRF coverage','Strong on 14 routes, missing on 8 + signup',0),
  sec('Rate limiting','Present on most; signup method weak',0),
  sec('Secrets in git','Hidden from git (.env.local ignored)',1),
], [5560,3800]))

// 8. ACCESSIBILITY
children.push(H('8. Accessibility (deep check)', HeadingLevel.HEADING_1))
const acc = (k,v,ok) => new TableRow({ children: [ cell(k, { w: 6360, size: 18 }), cell(v, { w: 3000, color: ok===1?GREEN:AMBER, bold: true, size: 18 }) ]})
children.push(table([
  headerRow(['Check', 'Result'], [6360,3000]),
  acc('Page language set','en',1),
  acc('Exactly one main heading (H1)','Yes',1),
  acc('Heading order (H1 to H3)','Clean, no skips',1),
  acc('Images with alt text','104 of 104',1),
  acc('Links and buttons named','All named',1),
  acc('Form labels','130 ARIA attrs, 52 labels',1),
  acc('Unlabeled inputs','1 (placeholder only)',0),
  acc('Skip-to-content link','Missing',0),
  acc('Mobile touch targets','Check icon buttons vs 44px',0),
  acc('Favicon','Missing (has a TODO)',0),
], [6360,3000]))
children.push(para([ run('Verdict: B+. ', { bold: true }), run('Strong foundations; the gaps are small and quick.') ]))

// 9. MOBILE
children.push(H('9. Mobile sweep', HeadingLevel.HEADING_1))
children.push(bullet('Homepage at 375px renders cleanly: search box stacks, navy "Search" button with readable white text, chips wrap, trust badges show. Dark mode also confirmed.'))
children.push(bullet([ run('One minor glitch: ', { bold: true }), run('at narrow widths the header search icon overlaps the "world" wordmark. Cosmetic — fix header spacing on small screens.') ]))
children.push(bullet('No broken layouts or horizontal-scroll issues on the pages checked.'))

// 10. CONTRADICTIONS
children.push(H('10. Contradictions found', HeadingLevel.HEADING_1))
children.push(numbered('"License verified" vs "Expired" on the same profile — the important one (H1).'))
children.push(numbered('Docs say "no email in v1," but email is built everywhere (signup, claims, bookings, newsletter, reset). It is dormant (no key, nothing sends) — but code and the decision log disagree. Update the doc.'))
children.push(numbered('CLAUDE.md says "DOMPurify for rich text," but the app does not use it. The renderer is safe anyway, so the result is fine — but the claim is inaccurate.'))
children.push(numbered('Admin email spelling differs between config and the real account (L1).'))

// 11. DEAD CODE
children.push(H('11. Dead code and cruft — very clean', HeadingLevel.HEADING_1))
children.push(bullet('Only 3 to-do notes in the entire codebase — unusually tidy.'))
children.push(bullet('No duplicate modules (the two "merit" files do different jobs; the seed files are not duplicates).'))
children.push(bullet('Minor dev annoyance: one file mixes a component with a non-component export, causing extra dev reloads. Dev-only.'))

// 12. FIX ORDER
children.push(H('12. Suggested fix order', HeadingLevel.HEADING_1))
children.push(numbered([ run('H1 ', { bold: true }), run('— license badge must respect license status (trust + legal). Do first.') ]))
children.push(numbered([ run('M1 + M2 ', { bold: true }), run('— add anti-CSRF and CAPTCHA to signup and the 8 unprotected routes.') ]))
children.push(numbered([ run('M3 ', { bold: true }), run('— hide pending/rejected reviews from the public API.') ]))
children.push(numbered([ run('M5 ', { bold: true }), run('— fix or replace the broken /setup-account onboarding link.') ]))
children.push(numbered([ run('M4 ', { bold: true }), run('— escape the 6 SEO data blocks.') ]))
children.push(numbered([ run('M6 / L1 / L5 ', { bold: true }), run('— proxy IP setting; fix the email-spelling and redirect-param inconsistencies.') ]))
children.push(numbered([ run('Polish list ', { bold: true }), run('— when convenient (skip-link, favicon, mobile header, Mapbox lock-down, Redis).') ]))

// 13. GLOSSARY
children.push(H('13. Jargon explained simply (for founders)', HeadingLevel.HEADING_1))
const g = (t,d) => new TableRow({ children: [ cell(t, { w: 2400, bold: true, color: NAVY, size: 18, fill: F_SURF }), cell(d, { w: 6960, size: 18 }) ]})
children.push(table([
  headerRow(['Term', 'Plain meaning'], [2400,6960]),
  g('CSRF','A trick where a bad website makes your logged-in browser do something without you meaning to. The "anti-CSRF check" stops it.'),
  g('XSS','Sneaking malicious code into a page so it runs in a visitor’s browser. The site is safe here.'),
  g('IDOR','Editing someone else’s record by changing an ID. Blocked here.'),
  g('SQL injection','Tricking the database by typing code into a form. Blocked here.'),
  g('Rate limiting','Capping how many times an action can run per hour (stops spam and bots).'),
  g('CAPTCHA','The "prove you’re human" check.'),
  g('SSR / ISR','The site builds pages on the server so they load fast and rank well on Google.'),
  g('Upsert','"Update if it exists, otherwise create" — how imports avoid duplicates.'),
  g('DataAlert','An automatic flag the system raises when imported data looks wrong.'),
  g('noindex / drip index','A page can be live but hidden from Google until you deliberately release it. Controls SEO timing.'),
  g('PostGIS','The location engine in the database, used for "near me" search.'),
], [2400,6960]))

// 14. CLEANUP
children.push(H('14. Honesty notes and cleanup', HeadingLevel.HEADING_1))
children.push(bullet('Tested live: JSON import, CSV import, ~50 pages, accessibility, mobile, light/dark.'))
children.push(bullet('Not separately load-tested: performance under heavy traffic; live email delivery (Resend has no key, as agreed).'))
children.push(bullet('Cleanup done: all temporary test scripts deleted; database restored from the pre-audit backup and verified (users 3, providers 218, clinics 99, reviews 2,800 — all original; zero test leftovers). No application code was changed.'))

// ---- document ----
const doc = new Document({
  creator: 'Audit', title: 'injector.world Full Codebase Audit',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 30, bold: true, font: 'Arial', color: NAVY }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, font: 'Arial', color: NAVY }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
    { reference: 'n', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
  ]},
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1320, right: 1440, bottom: 1320, left: 1440 } } },
    headers: { default: new Header({ children: [ new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D5DBE3', space: 6 } }, children: [ run('injector.world — Full Codebase Audit', { size: 16, color: GRAY }) ] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: 9360 }], children: [ run('Confidential · 19 June 2026', { size: 16, color: GRAY }), run('\t', {}), run('Page ', { size: 16, color: GRAY }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GRAY, font: 'Arial' }) ] }) ] }) },
    children,
  }],
})

Packer.toBuffer(doc).then(buf => { fs.writeFileSync('docs/FULL-AUDIT-2026-06-19.docx', buf); console.log('WROTE docs/FULL-AUDIT-2026-06-19.docx', buf.length, 'bytes') })

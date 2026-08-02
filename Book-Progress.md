# Book-Progress.md

Tracking file for **Full-Stack Technical Operator Handbook**.
Owner: Rishav. Build started 2026-08-02.

---

## 1. Source audit (done before writing)

| Source | Format | How it was read | Usable content |
|---|---|---|---|
| `Zero-to-Pro-Developer-Crash-Course.docx` | DOCX, ~2,900 words | Unzipped, `word/document.xml` parsed as XML (no LibreOffice on this machine) | 15 chapters + 6 bonus chapters. Full text extracted. |
| `Gmail - Phase 1 - Learning.pdf` | 7 pages, image-only | Text layer had 51 words. Embedded PNGs extracted with `pypdf`, read visually | Site route map, Payload collection map, folder map, feature-to-file lookup, URL-to-page flow |
| `Gmail - Chapter 1 - 10.pdf` | 10 pages, image-only | Same method | Visual slide version of crash-course chapters 1 to 10. Heavy overlap with the DOCX. |
| `Gmail - Chapter 11 - 15.pdf` | 5 pages, image-only | Same method | Visual slide version of chapters 11 to 15 + git rules + admin panel notes |

### Audit findings

**Covered well in sources (kept, expanded):** HTML/CSS/JS/TS recognition, JSX, useState/useEffect/useMemo,
App Router file-to-URL mapping, Server vs Client Components, the 3-path architecture, `route-resolver.ts`,
the feature-to-file lookup table, git safety rules.

**Too shallow in sources (rewritten from scratch):** the whole request lifecycle before Next.js
(DNS, TLS, CDN, headers, status codes), PostgreSQL beyond "table = Excel sheet", deployment and DO App
Platform operations, storage/email/external APIs, systematic debugging method, security, reliability,
technical SEO, performance, AI-agent management.

**Repeated across sources (deduplicated):** chapters 1 to 15 appear twice (DOCX + two PDFs). The
folder map and URL flow appear in both the Phase-1 PDF and the crash course.

**Contradictions found and resolved against the repository:**

| Claim in source | Repository truth | Resolution in book |
|---|---|---|
| "`Reviews` collection deleted 2026-06-29, never reference it" (Phase-1 PDF, in red) | `collections/Reviews.ts` exists and is imported + registered in `payload.config.ts` line 16 and 137 | Book states Reviews exists. Source claim is stale. |
| "Media on Cloudflare R2" (crash course, `lib/storage.ts` comments, `next.config.mjs` comments) | `docs/DEPLOYMENT-DIGITALOCEAN.md` section 2: production bucket is **DigitalOcean Spaces** `iw-media`, region `sfo3`, reached through the *existing* `R2_*` variable names | Book teaches: variable names say `R2_*`, the bucket behind them is DO Spaces. Code comments are stale, not the config. |
| "Railway / DigitalOcean" on the DB diagram (Phase-1 PDF) | DO App Platform + DO Managed PostgreSQL 18, NYC1 | Railway is described as historical only. |
| "13,481 rows" clinics | Count changes with every import batch | Book never states a live row count as fact. |
| "`rounded-pill = 999px`" (crash course ch.13) | `pill` token deleted; `rounded-control` = 8px is canonical (CLAUDE.md, revised 2026-07-30) | Book teaches the current token set and flags `rounded-pill` as a silent-failure trap. |
| CLAUDE.md lists `npm run set:live` | No `set:live` script in `package.json` | Book only documents scripts that actually exist. |
| CLAUDE.md: "build = migrations, search indexes, next build" | Real chain is `run-pre-push-migrations` then `db-push` then `run-migrations` then `setup-search-indexes` then `next build` | Book documents the real four-step chain. |
| Sources imply Cloudflare is live | `docs/INFRA-RUNBOOK-2026-07-30.md` is a to-do list: "Add injector.world to Cloudflare, change nameservers" | Book labels Cloudflare as **target state, not yet live**, and says so every time. |

**Sensitive data removed:** two personal Gmail addresses (PDF headers), the admin panel password
`changeme` shown in both source documents, the local DB connection string with an inline password,
the DO Postgres cluster hostname/user, and the DO app id. All replaced with placeholders
(`your-email@example.com`, `your-secure-password`, `DATABASE_URI`, `YOUR_API_KEY`).

---

## 2. Chapter plan and status

| Part | Chapters | Target pages | Status | Approx words |
|---|---|---|---|---|
| Front matter | Cover, purpose, audience, expectations, symbols, TOC, outcomes | 4 | DONE | 1,750 |
| Part 1 | Web and Internet Mental Model (ch 1 to 4) | 8 | DONE | 3,900 |
| Part 2 | Understanding the Project as a System (ch 5 to 7) | 8 | DONE | 3,850 |
| Part 3 | Code Reading Foundations (ch 8 to 11) | 8 | DONE | 3,800 |
| Part 4 | React and Next.js Application Behaviour (ch 12 to 16) | 12 | DONE | 5,400 |
| Part 5 | Payload CMS and PostgreSQL (ch 17 to 21) | 12 | DONE | 5,300 |
| Part 6 | Storage, Email and External APIs (ch 22 to 24) | 8 | DONE | 3,600 |
| Part 7 | Deployment and Infrastructure Operations (ch 25 to 27) | 10 | DONE | 4,500 |
| Part 8 | Error Understanding and Systematic Debugging (ch 28 to 31) | 12 | DONE | 5,600 |
| Part 9 | Security, Reliability, SEO and Performance (ch 32 to 35) | 8 | DONE | 3,700 |
| Part 10 | Git, AI-Assisted Development and Project Control (ch 36 to 38) | 6 | DONE | 2,900 |
| Appendices | A to J | 4 | DONE | 1,900 |

---

## 3. Verification status

| Check | Result |
|---|---|
| All four source documents reviewed | Yes. DOCX in full; PDFs via extracted page images. |
| No credentials, passwords, API keys, DB URIs or personal emails reproduced | Verified by grep pass over the final Markdown |
| No `TODO`, `TBD`, `[placeholder]`, `XXX` markers left | Verified by grep pass |
| Chapter numbering continuous 1 to 38 | Verified |
| Every required Part present | Verified against the brief |
| Technical claims traced to repo files | See "Evidence base" below |
| Assumptions labelled | Every unverified claim carries an `[ASSUMPTION]` tag |
| DOCX renders, no clipped text or broken tables | Verified by re-reading the generated DOCX |

### Evidence base (files actually read in the repository)

`package.json`, `payload.config.ts`, `next.config.mjs`, `middleware.ts`, `lib/storage.ts`,
`lib/email.ts`, `lib/route-resolver.ts`, `lib/revalidate-hook.ts`, `collections/Clinics.ts`,
`collections/` directory listing, `lib/` directory listing, `app/` route listing,
`app/(frontend)/[...path]/page.tsx`, all `export const revalidate` / `export const dynamic`
declarations, the full list of `process.env.*` names (names only, never values),
`docs/DEPLOYMENT-DIGITALOCEAN.md`, `docs/INFRA-RUNBOOK-2026-07-30.md`, `docs/STAGING.md`, `CLAUDE.md`.

### Known limits

- Diagrams are monospace ASCII, not rendered Mermaid images. No Mermaid renderer and no headless
  browser is available on this machine, so rendering Mermaid to PNG was not possible. ASCII diagrams
  render correctly and identically in both the Markdown and the DOCX, which was judged better than
  shipping unrendered ` ```mermaid ` code fences that a Word reader cannot see.
- Live production values (current clinic row count, current DO app URL, whether Cloudflare has been
  activated since 2026-07-30) were not queried. Anything depending on them is labelled.

---

## 4. Deliverables

| File | Purpose |
|---|---|
| `Full-Stack-Technical-Operator-Handbook.md` | Editable source |
| `Full-Stack-Technical-Operator-Handbook.docx` | Primary deliverable |
| `Book-Progress.md` | This file |

## 5. Completion report

Filled in at the end of the build. See the bottom of this file.

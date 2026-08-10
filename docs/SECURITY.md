# Security posture

Last full audit: **2026-08-08**. Scope: 84 API routes, 30 Payload collections, 2 globals,
6 SQL query builders, CSP and security headers, the dependency tree, and the browser console.

This file is the standing reference for how this application is defended and, more
importantly, **why each control is where it is**. Most of the fixes below look small.
Several of them are the only thing standing between a routine change and a full data
disclosure, so the reasoning is written down rather than left to be rediscovered.

> Unlike most files in `docs/`, this one is **not gitignored** and does reach the
> staging and production repos. So does `scripts/security-retest.mjs`.

---

## The one thing to understand

Everything hand-written in this codebase was in good shape. SQL is parameterised
everywhere, XSS has no sinks, privilege escalation is blocked at the field level, secrets
never reached git, and the assistant, wipe and backup flows are genuinely careful.

Both critical findings came from the same blind spot: **Payload generates a REST API for
every collection automatically, and `read: () => true` publishes every field in it.**

Nobody wrote `/api/clinics`. It appeared the moment a collection was marked publicly
readable, and it arrived with the full `where`, `sort`, `limit` and `depth` query surface
attached. The reasoning at the time was correct as far as it went — clinic pages are
public, so clinics are public — but it was made about *pages*, and it silently applied to
*fields the pages never render*.

**Rule that follows from this: `read: () => true` on a collection is a decision about an
API, not about a page.** Before setting it, list every field in that collection and ask
whether each one should be world-readable in bulk. If the answer is no for even one field,
that field needs its own `access.read`.

---

## Controls, and why they exist

### 1. Payload REST is closed for `clinics` and `providers`

Three layers, deliberately overlapping.

| Layer | Where | What it does |
|---|---|---|
| Middleware | `middleware.ts` | Anonymous requests to `/api/clinics*` and `/api/providers*` get 404 before a DB connection is taken |
| Collection access | `collections/Clinics.ts`, `collections/Providers.ts` | `read` is staff-only. **This is the authoritative gate.** |
| Field access | same files | `phone`, `email`, `licenseNumber`, `phoneDirect` are staff-only individually |

**The middleware layer is not sufficient on its own and must never be treated as if it
were.** It checks that a `payload-token` cookie is *present*, not that it is *valid*,
because middleware runs on the edge runtime without the Payload instance. Sending
`Cookie: payload-token=anything` walks straight past it. That is fine and intended: the
collection-level check runs inside Payload with a genuinely resolved `req.user` and rejects
a forged cookie. If you ever move a control such that middleware is the only thing in front
of it, that control is broken.

**Why this breaks nothing.** `access.read` is consulted by the REST API. It is *not*
consulted by the Local API (`payload.find()` / `payload.findByID()`), which defaults to
`overrideAccess: true`. Every page render, every sitemap entry and all 64 clinic query
sites go through the Local API. Verified: there is no `overrideAccess: false` anywhere in
the codebase. Nothing in the app ever fetched `/api/clinics` or `/api/providers` — the
frontend uses purpose-built routes (`/api/clinics-list`, `/api/city-clinics`,
`/api/clinics/lookup`).

The `emailPublic` opt-in on Clinics only ever controlled the rendered page. The API ignored
it and returned scraped addresses regardless. That gap is what these layers close.

### 2. Anonymous `limit` and `depth` are clamped

`middleware.ts`, 100 rows and depth 2. Signed-in callers skip the clamp so the Payload
admin panel's list views keep working.

The database pool is capped at 4 connections (`payload.config.ts`, deliberately — see the
comment there). That makes an unbounded `limit` a one-request denial of service rather than
a slow query. Two concurrent requests were enough to exhaust the pool and make an unrelated
trivial request return 504.

This clamp still matters after control 1, and by more than it looks. Locking clinics and
providers does not lock `zip-codes`, which is public by design and holds ~41,000 rows: a
single unclamped request pulled all of them. `reviews`, `media` and `locations` are in the
same position.

### 3. Verification codes are cryptographic

`lib/verification-code.ts`. All six-digit codes go through `generateVerificationCode()`,
which uses `crypto.randomInt`.

Three routes previously used `Math.random()`. That is V8's xorshift128+: deterministic,
and its internal state can be solved for from enough observed outputs. The signup endpoint
is public, so an attacker can generate those outputs on demand and then predict somebody
else's code. The claim flow is the one that matters — that code is what confirms control of
the email attached to a clinic listing.

**Keep every code going through that helper.** A second inline `Math.random()` is invisible
in review, which is how three copies survived.

### 4. Rate limiting

`lib/rate-limit.ts` provides `RateLimiter` and the `enforceLimit(req, limiter, bucket)`
helper. Redis-backed when `REDIS_URL` is set, per-process otherwise.

Two rules that are easy to get wrong:

- **Always key with a bucket prefix.** Keying on the bare IP makes every route that does so
  share one budget, so a visitor browsing normally can exhaust a limit no single endpoint
  came close to.
- **Always resolve the IP with `getIp()`.** Several routes read
  `x-forwarded-for.split(',')[0]`, which is the *caller-written* leftmost entry.
  `getIp()` counts in from the right by trusted proxy hop. Anything keyed on the leftmost
  entry is bypassable by rotating one header — that is how provider view counts (which feed
  merit ranking) and the upload limit were both defeatable.

Verification codes are limited **twice**: per IP and per account. Per-IP alone does nothing
against a distributed attempt, since rotating addresses gives each one a fresh budget
against the same victim. The per-account limiter accepts a known tradeoff: an attacker can
burn a victim's budget and make them wait out the window. That 15-minute nuisance is the
better side of the trade.

### 4a. Client IP resolution — `TRUSTED_PROXY_COUNT` (measured, do not guess)

`getIp()` in `lib/rate-limit.ts` decides what every rate limiter keys on **and** what geo
lookups resolve. Getting the index wrong does not throw; it silently returns an
infrastructure address, which fails in two ways at once:

- every visitor behind the same edge node shares **one** rate-limit bucket;
- geo returns the **datacenter's** location instead of the visitor's.

That is not hypothetical. Staging shipped with `TRUSTED_PROXY_COUNT=1` and the search bar
began prefilling "Mumbai" with no ZIP for a visitor in Kolkata. Measured on staging via
`/api/admin/debug/ip`:

```
xForwardedFor: "103.182.106.146,162.158.227.53"

  index 0  103.182.106.146   Zita Telecom     Kolkata, WB, 700002   <- the actual visitor
  index 1  162.158.227.53    Cloudflare Inc.  Mumbai, no ZIP        <- the edge node
```

With `TRUSTED_PROXY_COUNT=1` the selected index is `len - 1 = 1`, the Cloudflare node.
Cloudflare IPs carry no postal code, which is exactly why the ZIP came back `null`.
The correct value for this topology is **2** (`len - 2 = 0`).

**`TRUST_CF_HEADERS` is NOT the fix here, despite looking like the obvious one.**
`CF-Connecting-IP` arrives as `null` on `*.ondigitalocean.app` — DigitalOcean's edge does
not forward it to the app. Setting `TRUST_CF_HEADERS=true` therefore changes nothing: the
header check falls through and the same wrong XFF index is used. The flag is only worth
revisiting on a domain where that header is actually present.

`TRUSTED_PROXY_COUNT=2` stays spoof-resistant, which is the whole reason for counting from
the right. A caller who supplies their own header just lengthens the list:

```
client sends "8.8.8.8"  ->  "8.8.8.8, 103.182.106.146, 162.158.227.53"   len 3
                                index 1 = len - 2 = the real visitor, forged value ignored
```

**Measure before setting this on any new environment.** `/api/admin/debug/ip` (admin-gated)
prints the raw header, every entry with its index, and which index the current config
selects. The hop count depends on the domain and the edge in front of it, so a value that is
correct on one deployment is not evidence for another — production uses a custom domain and
has not been measured.

### 5. Uploads are validated against bytes, not claims

`lib/image-validation.ts`. `file.type` is the client-written Content-Type of the multipart
part — a claim, not a fact. Validation now reads the file signature, and separately caps
pixel dimensions.

The dimension cap is not a quality policy. A 50,000px image of one flat colour compresses to
a couple of megabytes, passes an 8 MB byte limit, and then asks for roughly ten gigabytes
the moment anything decodes it. A byte cap cannot see that coming.

**SVG is excluded on purpose.** It is XML, it can carry `<script>`, and it is served from a
media domain. Do not add it because it is "an image format".

### 6. Error responses never carry the cause

`lib/api-errors.ts`. `serverError(scope, err, publicMessage)` logs the full error and stack
with a short random `ref`, and returns only the generic message plus that `ref`.

`err.message` from the `pg` driver names the failing constraint, column and table, and
sometimes the SQL. Thirty-one routes returned it directly, turning any 500 into a free read
of the schema.

This is *more* debuggable than what it replaced, not less: the admin reports the `ref`, you
grep the logs, and you get the stack too — which the response never had.

### 7. Signed tokens for unauthenticated actions

Three flows let an anonymous caller act without a session. All three use an HMAC keyed with
`PAYLOAD_SECRET`, same pattern each time:

| Flow | Helper |
|---|---|
| Outreach unsubscribe | `lib/outreach.ts` |
| Newsletter unsubscribe | `lib/newsletter-email.ts` |
| Assistant feedback | `lib/assistant/feedback-token.ts` |

Newsletter unsubscribe links previously carried the subscriber's `confirmToken` — one
secret doing two unrelated jobs, where the one that gets forwarded and logged by mail
gateways was also the one that confirms a subscription. The route still accepts the legacy
`?token=` form, **on purpose and indefinitely**: unsubscribe links live in inboxes forever,
and breaking them on already-delivered mail is both bad practice and a CAN-SPAM problem.

Assistant feedback took a `logId` straight from the body into
`payload.update(..., overrideAccess: true)` with no ownership test at all.

### 8. CSRF

`checkOrigin()` from `lib/rate-limit.ts` on every cookie-authenticated write. Requests with
no `Origin` header are rejected, not trusted — browsers always send it on same-origin POST.

### 9. Cache headers on private responses

`Cache-Control: no-store` on anything user-scoped or gated. Cloudflare currently bypasses
caching on those paths, which meant the omission was never visible. That is luck, not
design, and one cache-rule change away from serving one visitor's data to everyone.

---

## Not a control, despite appearances

**`middleware.ts` blocks a list of tool user agents.** A User-Agent is a request header the
caller writes:

```
curl -A "curl/7.88.1" .../api/clinics-list  ->  403
curl -A "Mozilla/5.0"  .../api/clinics-list  ->  200
```

It filters lazy scrapers out of the logs. That is all it does. Never count it as a layer
when reasoning about whether a route is protected, and never drop a real control because
"the UA filter covers it". The entire audit was conducted through it.

Side effect worth knowing: it blocks your own `curl` while debugging. Pass
`-A "Mozilla/5.0"`.

---

## Accepted risks

**`'unsafe-inline'` in `script-src`.** Documented at length in `next.config.mjs`. The
standard fix is a per-request nonce, which requires every JSON-LD block to read `headers()`,
which opts those routes into dynamic rendering — converting essentially every public page
from cached ISR to per-request server rendering against a 4-connection pool. That trades a
CSP improvement for the exact failure mode the rest of this work exists to prevent. Set
`CSP_REPORT_ONLY=true` to gather real data before revisiting.

**Coarse geo is fetched over plain HTTP.** `lib/geo-ip.ts`. ip-api.com serves TLS only on
its paid tier, so forcing `https://` would break geo rather than harden it. A network
observer between the server and ip-api can see which visitor IP was looked up and can
return a wrong city. No credential or user content is in the request. Override
`GEOIP_ENDPOINT` to move to a TLS provider or a local MaxMind database if geo ever becomes
load-bearing.

**Blocked GA remarketing pixel in the console.** With Google Signals enabled, GA4 fires a
pixel at the visitor's local Google ccTLD (`google.co.in`, `google.de`), which
`https://*.google.com` does not cover. Nothing is broken; analytics is unaffected. The fix
is upstream — turn off ads personalisation in the GA4 property if remarketing is not being
used. Do not enumerate ~200 ccTLDs in the CSP.

---

## Open items

| Item | Why it is still open |
|---|---|
| `next` 15.4.11 → 15.5.x | Many advisories. `CLAUDE.md` pins 15.4.x, and `postcss` + Next's bundled `sharp` only clear with this upgrade. Needs a deliberate decision and a full build test. |
| `payload` / `@payloadcms/*` | Advisories clear only on a major upgrade. Breaking; plan separately. |
| `dompurify` | Pinned by Payload's lexical editor, so `npm audit fix` cannot move it. Clears with the Payload upgrade. Note it is a *transitive* dependency — no application code calls it. |
| `uuid` via `exceljs` | The only available fix downgrades exceljs to 3.4.0, which is breaking. Not worth it. |
| `SEED_ADMIN_PASSWORD` in `.env.local` | `.env.local` points at **production**. An accidental seed run would create a known-password admin there. Remove it, or point the seed scripts at `.env.staging`. |
| `ANALYTICS_IP_SALT` unset | `hashIp()` therefore always returns null and the column is dead. Privacy-safe by accident; set it or drop the field deliberately. |
| Cloudflare WAF / rate limiting | Cloudflare already fronts the app (`CF-RAY` present) but no API rate limiting is configured there. That is a free outer layer. |
| `TRUSTED_PROXY_COUNT` on production | Verified and corrected on staging (see below). Production's topology uses a custom domain and has **not** been measured. Check `/api/admin/debug/ip` there before deploying, rather than assuming staging's value carries over. |

---

## Verifying

```bash
node scripts/security-retest.mjs https://your-deployment
```

Re-runs every probe from the audit and asserts the fixes. Read-only. The rate-limit burst is
opt-in behind `--include-load`, because proving a limiter fires means sending traffic past
it, and against a deployment that lacks the fix that burst *is* the denial of service rather
than a test of it.

Expect this to fail against any deployment that has not received these changes. That is the
point — it failed on 5 checks against staging before the fixes landed, and those 5 were the
critical findings.

The local gate for the code itself is `npx tsc --noEmit`. Do **not** run `npm run build`
casually: it runs migrations, and every npm script in this repo is hardcoded to
`--env-file=.env.local`, which points at production.

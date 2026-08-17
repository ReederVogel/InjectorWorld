import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { seoPlugin } from '@payloadcms/plugin-seo'
import type { GenerateTitle, GenerateDescription, GenerateURL } from '@payloadcms/plugin-seo/types'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Services } from './collections/Services'
import { Locations } from './collections/Locations'
import { Brands } from './collections/Brands'
import { Clinics } from './collections/Clinics'
import { Reviews } from './collections/Reviews'
import { Providers } from './collections/Providers'
import { Photos } from './collections/Photos'
import { QA } from './collections/QA'
import { Authors } from './collections/Authors'
import { MedicalReviewers } from './collections/MedicalReviewers'
import { Guides } from './collections/Guides'
import { FAQs } from './collections/FAQs'
import { BeforeAfterCases } from './collections/BeforeAfterCases'
import { Bookings } from './collections/Bookings'
import { Promotions } from './collections/Promotions'
import { AuditLogs } from './collections/AuditLogs'
import { DataAlerts } from './collections/DataAlerts'
import { ExportJobs } from './collections/ExportJobs'
import { AssistantLogs } from './collections/AssistantLogs'
import { PageIndex } from './collections/PageIndex'
import { Claims } from './collections/Claims'
import { ClaimInvites } from './collections/ClaimInvites'
import { Subscribers } from './collections/Subscribers'
import { News } from './collections/News'
import { ZipCodes } from './collections/ZipCodes'
import { VideoTestimonials } from './collections/VideoTestimonials'
import { SocialPosts } from './collections/SocialPosts'
import { InternalLinkSuggestions } from './collections/InternalLinkSuggestions'
import { HeaderConfig } from './collections/globals/HeaderConfig'
import { SiteConfig } from './collections/globals/SiteConfig'
import { mediaStoragePlugins } from './lib/storage'
import { emailAdapter } from './lib/email'
import { getDbSsl, getDbConnectionString } from './lib/db-ssl'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Guard: fail fast in production if PAYLOAD_SECRET is missing or too short.
// jwt tokens are trivially forgeable with a weak secret — catch this before the server accepts traffic.
const _payloadSecret = process.env.PAYLOAD_SECRET ?? ''
if (_payloadSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[payload] PAYLOAD_SECRET must be a random string of at least 32 characters. ' +
      'Generate one with: openssl rand -base64 48',
    )
  } else {
    // Warn in dev so the dev notices, but don't block local startup.
    console.warn(
      '[payload] WARN: PAYLOAD_SECRET is not set or too short (< 32 chars). This is insecure in production.',
    )
  }
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// Per-statement cap, applied ONLY to the Next.js server's own pool (see the pool
// block below). NEXT_RUNTIME is the gate because it is set inside Next (route
// handlers, page rendering) and unset in every plain `tsx scripts/...` run.
// That distinction matters: scripts/setup-search-indexes.ts builds GIN/GIST
// indexes over ~40k clinics through THIS config during the deploy, and imports,
// seeds and backfills run long by design. A cap there would fail the build or
// abort a batch halfway. db-push is excluded for the same reason (drizzle
// introspection is slow on purpose), and dev is left uncapped.
// DB_STATEMENT_TIMEOUT_MS=0 turns it off.
const statementTimeoutMs =
  !process.env.NEXT_RUNTIME ||
  process.env.PAYLOAD_FORCE_PUSH === 'true' ||
  process.env.NODE_ENV !== 'production'
    ? 0
    : process.env.DB_STATEMENT_TIMEOUT_MS
      ? parseInt(process.env.DB_STATEMENT_TIMEOUT_MS, 10)
      : 30_000

// News categories are distinct from guide categories — used to route the SEO URL correctly.
const NEWS_CATS = new Set([
  'treatment-update', 'industry', 'company', 'announcement',
  'product-launch', 'research', 'regulation',
])

// SEO plugin generators. Used by the "Auto-generate" buttons and previews.
const generateTitle: GenerateTitle = ({ doc }) =>
  doc?.title ? `${doc.title} | injector.world` : 'injector.world'

const generateDescription: GenerateDescription = ({ doc }) =>
  doc?.excerpt || doc?.lede || ''

const generateURL: GenerateURL = ({ doc }) => {
  if (!doc?.slug) return siteUrl
  const isNews = doc.category && NEWS_CATS.has(doc.category as string)
  return isNews ? `${siteUrl}/news/${doc.slug}` : `${siteUrl}/guides/${doc.slug}`
}

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  cors: [process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'],
  csrf: [process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'],
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' | injector.world admin',
    },
    components: {
      graphics: {
        Logo: '/components/admin/Logo#Logo',
        Icon: '/components/admin/Icon#Icon',
      },
      views: {
        dashboard: {
          Component: '/components/admin/views/CommandCenter#CommandCenter',
        },
        ops: {
          Component: '/components/admin/views/OpsView#OpsView',
          path: '/ops',
        },
        indexing: {
          Component: '/components/admin/views/IndexingView#IndexingView',
          path: '/indexing',
        },
        tools: {
          Component: '/components/admin/views/ToolsView#ToolsView',
          path: '/tools',
        },
        analytics: {
          Component: '/components/admin/views/AnalyticsView#AnalyticsView',
          path: '/analytics',
        },
        contentReport: {
          Component: '/components/admin/views/ContentReportView#ContentReportView',
          path: '/content-report',
        },
      },
      afterNavLinks: ['/components/admin/NavLinks#NavLinks'],
      providers: ['/components/admin/CommandPalette#CommandPaletteProvider'],
    },
  },
  collections: [
    Users,
    Media,
    Services,
    Brands,
    Locations,
    Clinics,
    Reviews,
    Providers,
    Photos,
    QA,
    Authors,
    MedicalReviewers,
    Guides,
    News,
    FAQs,
    BeforeAfterCases,
    Bookings,
    Promotions,
    AuditLogs,
    DataAlerts,
    ExportJobs,
    AssistantLogs,
    PageIndex,
    Claims,
    ClaimInvites,
    Subscribers,
    ZipCodes,
    VideoTestimonials,
    SocialPosts,
    InternalLinkSuggestions,
  ],
  globals: [HeaderConfig, SiteConfig],
  editor: lexicalEditor(),
  email: emailAdapter,
  // Payload 3 sets SameSite=Lax by default on auth cookies (httpOnly JWT).
  // Lax prevents CSRF on cross-origin top-level navigations. The checkOrigin()
  // guard in lib/rate-limit.ts is the primary defence for same-site write routes.
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // Auto schema-push is OFF by default — it runs a slow DB introspection on
    // every Payload init in dev (the "Pulling schema from database" spam). Only
    // the `db:push` script (and the build) turn it on via PAYLOAD_FORCE_PUSH.
    // After changing a collection, run `npm run db:push` to apply it.
    push: process.env.PAYLOAD_FORCE_PUSH === 'true',
    // Some DBs (e.g. staging, restored from a full pg_dump of a cluster that once
    // had the postgis extension installed) carry spatial_ref_sys / geometry_columns
    // / geography_columns even though no collection here declares geometry fields.
    // Without this, db-push's drizzle-kit diff sees those as "extra" tables and
    // throws an interactive "DATA LOSS WARNING — about to delete spatial_ref_sys"
    // confirm prompt — which hangs forever on a non-interactive DO build (no TTY
    // to answer it), since nothing there ever supplies a response to it. Declaring
    // the postgis extension here makes drizzle-kit exclude those tables from the
    // diff entirely (verified against node_modules/drizzle-kit's
    // getTablesFilterByExtensions, which maps 'postgis' -> ['!geography_columns',
    // '!geometry_columns', '!spatial_ref_sys']). This does NOT run CREATE EXTENSION
    // during db-push (that only happens in `payload migrate`, and is wrapped in a
    // try/catch there) — it only affects what the push diff considers ours to manage.
    extensions: ['postgis'],
    pool: {
      // getDbConnectionString() strips ssl* query params; getDbSsl() supplies the
      // real TLS config (incl. the DB_SSL_CA cert). They MUST be used together —
      // see lib/db-ssl.ts for why an sslmode in the URI would otherwise discard
      // our CA.
      connectionString: getDbConnectionString(),
      ssl: getDbSsl(),
      // Keep a small pool. The build connection-exhaustion problem is solved by
      // forcing `next build` to use a single static-generation worker (see
      // experimental.cpus in next.config.mjs), NOT by shrinking this pool — a pool
      // of 1 deadlocks Payload, which runs related queries concurrently within one
      // page and needs more than one connection at a time. One build worker * 4 =
      // 4 connections, well under the DO dev-tier limit. At runtime there is a
      // single server process. Override with DB_POOL_MAX if ever needed.
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 4,
      // Everything below exists so a DB blip fails FAST instead of hanging
      // forever (2026-08-17). Staging wedged: every DB-backed route (listing
      // APIs, /api/search, robots.txt) stopped responding entirely, Cloudflare
      // eventually returned 520 after ~162s, and pg_stat_activity showed the app
      // holding ZERO sessions the whole time. The pool's four connections were
      // dead sockets it had not noticed, and with pg's defaults every later
      // query waits on that pool with no deadline.
      //
      // Waiting for a free/new connection. pg's default is 0 = wait forever,
      // which is what turned a recoverable blip into a permanent hang.
      connectionTimeoutMillis: process.env.DB_CONN_TIMEOUT_MS
        ? parseInt(process.env.DB_CONN_TIMEOUT_MS, 10)
        : 10_000,
      // TCP keepalives so a connection killed at the other end (DO managed-PG
      // maintenance, failover, an idle NAT drop) surfaces as a socket error the
      // pool can evict, instead of a socket that looks alive forever.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      // Recycle idle connections rather than holding them open indefinitely, so
      // a stale one is far less likely to be handed to a request.
      idleTimeoutMillis: 30_000,
      // Server-side cap on a single statement (0 = absent, see statementTimeoutMs
      // above for exactly where it applies). The heaviest runtime query today,
      // the distance-banded listing over ~39.7k clinics, measures ~1.3s, so 30s
      // is a wide margin rather than a tuning knob.
      ...(statementTimeoutMs > 0 ? { statement_timeout: statementTimeoutMs } : {}),
    },
  }),
  plugins: [
    seoPlugin({
      collections: ['guides', 'news'],
      uploadsCollection: 'media',
      tabbedUI: true,
      generateTitle,
      generateDescription,
      generateURL,
    }),
    // Media -> Cloudflare R2 (S3-compatible) when the R2_* env vars are set;
    // local-disk fallback otherwise. See lib/storage.ts. DO Spaces swap later
    // is env-only.
    ...mediaStoragePlugins(),
  ],
  sharp,
})

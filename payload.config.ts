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
import { Treatments } from './collections/Treatments'
import { Locations } from './collections/Locations'
import { Brands } from './collections/Brands'
import { Clinics } from './collections/Clinics'
import { Providers } from './collections/Providers'
import { Reviews } from './collections/Reviews'
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
import { Claims } from './collections/Claims'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

// SEO plugin generators. Used by the "Auto-generate" buttons and previews.
const generateTitle: GenerateTitle = ({ doc }) =>
  doc?.title ? `${doc.title} | injector.world` : 'injector.world'

const generateDescription: GenerateDescription = ({ doc }) =>
  doc?.excerpt || doc?.lede || ''

const generateURL: GenerateURL = ({ doc }) =>
  doc?.slug ? `${siteUrl}/guides/${doc.slug}` : siteUrl

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
      beforeDashboard: ['/components/admin/DashboardWidget#DashboardWidget'],
      afterNavLinks: ['/components/admin/NavLinks#NavLinks'],
    },
  },
  collections: [
    Users,
    Media,
    Treatments,
    Locations,
    Brands,
    Clinics,
    Providers,
    Reviews,
    Photos,
    QA,
    Authors,
    MedicalReviewers,
    Guides,
    FAQs,
    BeforeAfterCases,
    Bookings,
    Promotions,
    AuditLogs,
    DataAlerts,
    Claims,
  ],
  editor: lexicalEditor(),
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
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      // Local Postgres (localhost) does not support SSL, so disable it there.
      // Remote (Railway postgres-ssl, DO Managed Postgres) gets SSL with
      // self-signed certs accepted. DO's cert is valid so this is a no-op there.
      ssl:
        !process.env.DATABASE_URI ||
        /@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URI)
          ? false
          : { rejectUnauthorized: false },
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX, 10) : 4,
    },
  }),
  plugins: [
    seoPlugin({
      collections: ['guides'],
      uploadsCollection: 'media',
      tabbedUI: true,
      generateTitle,
      generateDescription,
      generateURL,
    }),
  ],
  sharp,
})

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
      titleSuffix: ' — injector.world admin',
    },
    components: {
      beforeDashboard: ['/components/admin/DashboardWidget#DashboardWidget'],
    },
  },
  collections: [
    Users,
    Media,
    Treatments,
    Locations,
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
    pool: {
      connectionString: process.env.DATABASE_URI || '',
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

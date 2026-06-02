import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: ' — injector.world admin',
    },
  },
  collections: [
    Users,
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
  sharp,
})

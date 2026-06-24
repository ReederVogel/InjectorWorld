import type { CollectionConfig } from 'payload'

/**
 * US ZIP code centroids seeded from GeoNames public domain data.
 * Used for offline ZIP resolution (no geocoder round-trip) and as the
 * canonical anchor for paid ZIP featuring (Promotions.zipScope).
 *
 * Source: GeoNames US postal codes (CC BY 4.0)
 * https://download.geonames.org/export/zip/US.zip
 *
 * ~42 000 rows. Seeded via `npm run seed:zips` (scripts/seed-zips.ts).
 * Do NOT edit records manually — re-run seed:zips to refresh.
 */
export const ZipCodes: CollectionConfig = {
  slug: 'zip-codes',
  admin: {
    useAsTitle: 'zip',
    defaultColumns: ['zip', 'city', 'state', 'county', 'lat', 'lng'],
    group: 'System',
    description:
      'US ZIP code centroids (GeoNames, public domain). Seeded via `npm run seed:zips`. ' +
      'Read-only reference used for ZIP search resolution and ZIP featuring.',
    listSearchableFields: ['zip', 'city', 'state'],
  },
  access: {
    read: () => true,
    create: ({ req }) => req.user?.role === 'admin',
    update: ({ req }) => req.user?.role === 'admin',
    delete: () => false,
  },
  fields: [
    {
      name: 'zip',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      maxLength: 5,
      admin: {
        description: '5-digit US ZIP code.',
        readOnly: true,
      },
    },
    {
      name: 'city',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'state',
      type: 'text',
      required: true,
      maxLength: 2,
      admin: {
        description: '2-letter state code (e.g. NY).',
        readOnly: true,
      },
    },
    {
      name: 'county',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'lat',
      type: 'number',
      required: true,
      admin: {
        description: 'Latitude of the ZIP centroid.',
        readOnly: true,
      },
    },
    {
      name: 'lng',
      type: 'number',
      required: true,
      admin: {
        description: 'Longitude of the ZIP centroid.',
        readOnly: true,
      },
    },
  ],
  timestamps: true,
}

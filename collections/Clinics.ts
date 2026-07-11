import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'
import { denormalizeClinicPhotos } from '../lib/photo'
import { ensureClinicSlug } from '../lib/clinic-slug-hook'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['clinicName', 'status', 'city', 'state', 'aggregateRating', 'aggregateRatingCount'],
    listSearchableFields: ['clinicName', 'clinicId', 'city'],
    group: 'Directory',
    description: 'Physical clinic locations. Ratings come from imported reviews and are read-only. Each clinic is its own page and location.',
    components: {
      beforeListTable: ['/components/admin/ClinicQueueChips#ClinicQueueChips'],
    },
  },
  access: {
    read: () => true,
    // All writes go through the admin panel or /api/dashboard/save (overrideAccess).
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Basics',
          fields: [
            { name: 'clinicName', type: 'text', required: true, index: true },
            { name: 'slug', type: 'text', required: true, unique: true, index: true },
            { name: 'tagline', type: 'text', maxLength: 100 },
            { name: 'description', type: 'textarea' },
            {
              name: 'clinicType',
              type: 'select',
              label: 'Clinic Type',
              options: [
                { label: 'Med Spa', value: 'medspa' },
                { label: 'Dermatology', value: 'dermatology' },
                { label: 'Plastic Surgery', value: 'plastic-surgery' },
                { label: 'Dental Aesthetics', value: 'dental-aesthetics' },
                { label: 'Other', value: 'other' },
              ],
            },
            {
              name: 'serviceType',
              type: 'select',
              defaultValue: 'In-Person',
              options: [
                { label: 'In-Person', value: 'In-Person' },
                { label: 'Telehealth', value: 'Telehealth' },
                { label: 'Both', value: 'Both' },
              ],
            },
            { name: 'yearEstablished', type: 'number' },
            { name: 'acceptsInsurance', type: 'checkbox', defaultValue: false },
            { name: 'paymentMethods', type: 'text', admin: { description: 'Semicolon list.' } },
            { name: 'amenities', type: 'text', admin: { description: 'Semicolon list.' } },
            {
              name: 'aggregateRating',
              type: 'number',
              admin: { readOnly: true, description: 'Computed from imported reviews. Not hand-editable (trust signal).' },
            },
            {
              name: 'aggregateRatingCount',
              type: 'number',
              admin: { readOnly: true, description: 'Number of reviews behind the rating. Set by import.' },
            },
            {
              name: 'providers',
              type: 'relationship',
              relationTo: 'providers',
              hasMany: true,
            },
          ],
        },
        {
          label: 'Location & Contact',
          fields: [
            {
              type: 'collapsible',
              label: 'Address',
              fields: [
                { name: 'addressLine1', type: 'text' },
                { name: 'addressLine2', type: 'text' },
                { name: 'city', type: 'text', required: true, index: true },
                { name: 'state', type: 'text', required: true, maxLength: 2, index: true },
                { name: 'zip', type: 'text' },
                { name: 'neighborhood', type: 'text', index: true },
                { name: 'county', type: 'text' },
                { name: 'country', type: 'text', defaultValue: 'US' },
              ],
            },
            {
              type: 'collapsible',
              label: 'Map data',
              admin: { initCollapsed: true },
              fields: [
                { name: 'latitude', type: 'number', index: true },
                { name: 'longitude', type: 'number', index: true },
                { name: 'googlePlaceId', type: 'text' },
                { name: 'googleMapsUrl', type: 'text' },
                { name: 'directionsUrl', type: 'text' },
                { name: 'appleMapsUrl', type: 'text' },
              ],
            },
            {
              type: 'collapsible',
              label: 'Contact',
              fields: [
                { name: 'phone', type: 'text' },
                { name: 'email', type: 'email' },
                { name: 'websiteUrl', type: 'text' },
                { name: 'bookingUrl', type: 'text' },
              ],
            },
            {
              type: 'collapsible',
              label: 'Social',
              admin: { initCollapsed: true },
              fields: [
                { name: 'instagramUrl', type: 'text', label: 'Instagram URL' },
                { name: 'tiktokUrl', type: 'text', label: 'TikTok URL' },
                { name: 'facebookUrl', type: 'text', label: 'Facebook URL' },
              ],
            },
            { name: 'hoursJson', type: 'json' },
          ],
        },
        {
          label: 'Brands & Services',
          fields: [
            {
              name: 'brandsOffered',
              type: 'relationship',
              relationTo: 'brands',
              hasMany: true,
              label: 'Brands Carried',
              admin: { description: 'Product brands this clinic uses (e.g., Botox, Juvederm, Dysport).' },
            },
            {
              name: 'servicesOffered',
              type: 'relationship',
              relationTo: 'services',
              hasMany: true,
              label: 'Services Offered',
              admin: { description: 'Service areas this clinic provides (e.g., Lip Filler, Cheek Filler).' },
            },
            { name: 'offersVirtualConsult', type: 'checkbox', defaultValue: false, label: 'Offers Virtual Consult' },
            { name: 'acceptsNewPatients', type: 'checkbox', defaultValue: true, label: 'Accepts New Patients' },
            {
              name: 'startingPrice',
              type: 'number',
              label: 'Starting Price ($)',
              admin: { description: 'Lowest service price shown on listing cards.' },
            },
            {
              name: 'languages',
              type: 'select',
              hasMany: true,
              label: 'Languages Spoken',
              options: [
                { label: 'English', value: 'en' },
                { label: 'Spanish', value: 'es' },
                { label: 'French', value: 'fr' },
                { label: 'Mandarin', value: 'zh' },
                { label: 'Cantonese', value: 'yue' },
                { label: 'Korean', value: 'ko' },
                { label: 'Portuguese', value: 'pt' },
                { label: 'Arabic', value: 'ar' },
                { label: 'Hindi', value: 'hi' },
                { label: 'Russian', value: 'ru' },
              ],
            },
          ],
        },
        {
          label: 'Photos',
          fields: [
            { name: 'logoUrl', type: 'text' },
            {
              name: 'clinicPhotoUrls',
              type: 'array',
              fields: [{ name: 'url', type: 'text' }],
            },
            {
              name: 'photos',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
              admin: {
                description:
                  'Uploaded clinic photos (gallery). When set, these are shown instead of the legacy ' +
                  'clinicPhotoUrls. A claimed clinic owner can upload these from their dashboard.',
              },
            },
          ],
        },
        {
          label: 'Billing & Claim',
          fields: [
            {
              name: 'subscriptionTier',
              type: 'select',
              defaultValue: 'free',
              // M5: Billing info — restrict to staff. Server-side reads use overrideAccess: true.
              access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
              options: [
                { label: 'Free', value: 'free' },
                { label: 'Starter', value: 'starter' },
                { label: 'Pro', value: 'pro' },
                { label: 'Elite', value: 'elite' },
              ],
              admin: { description: 'Plan tier for this clinic. Entitlement for clinic-level features derives from the claimed-owner provider\'s tier.' },
            },
            {
              name: 'subscriptionStatus',
              type: 'select',
              defaultValue: 'none',
              // M5: Billing info — restrict to staff.
              access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
              options: [
                { label: 'None', value: 'none' },
                { label: 'Active', value: 'active' },
                { label: 'Past due', value: 'past_due' },
                { label: 'Canceled', value: 'canceled' },
              ],
              admin: { description: 'Billing status. Set manually for now (manual billing v1); Stripe self-serve later.' },
            },
            {
              name: 'claimed',
              type: 'checkbox',
              defaultValue: false,
              admin: { readOnly: true, description: 'Set automatically when a claim is approved. Not hand-editable.' },
            },
            {
              name: 'claimedBy',
              type: 'relationship',
              relationTo: 'users',
              // M5: PII — the relationship to a user account must not be exposed publicly.
              access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
              admin: { readOnly: true, description: 'The user who claimed this profile. Set on claim approval.' },
            },
          ],
        },
        {
          label: 'Import provenance',
          admin: { description: 'Set automatically by the data importer. Not hand-editable.' },
          fields: [
            {
              name: 'clinicId', type: 'text', required: true, unique: true, index: true,
              admin: { description: 'Unique import ID from the CSV scrape (e.g. "clinic-ca-00001"). Set by the importer automatically. Never edit this field manually — it is used for upsert deduplication.' },
            },
            {
              name: 'importBatch',
              type: 'text',
              index: true,
              // M5: Internal ops field — hide from public Payload REST API responses.
              access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
              admin: {
                readOnly: true,
                description: 'Set by the data importer to group a batch (for scoped re-import / wipe). Not hand-editable.',
              },
            },
            { name: 'lastScrapedDate', type: 'date' },
            {
              name: 'sourceUrls',
              type: 'array',
              fields: [{ name: 'url', type: 'text' }],
            },
          ],
        },
      ],
    },
    // Sidebar fields — must stay at top level, outside the tabs field; position: 'sidebar' does not work nested.
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      label: 'Publish Status',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Review', value: 'review' },
        { label: 'Draft', value: 'draft' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'noindex',
      type: 'checkbox',
      defaultValue: true,
      label: 'Skip build pre-render',
      admin: {
        position: 'sidebar',
        description: 'Does NOT control the page\'s live noindex meta tag (that\'s driven automatically by Status, above). When checked, this clinic is excluded from the list of pages statically pre-rendered at build time. Bulk uploads default to checked.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Publish Date',
      admin: {
        position: 'sidebar',
        description: 'Set when a staged clinic is approved. Draft clinics are never shown publicly.',
      },
    },
    {
      name: 'dataConfidence',
      type: 'number',
      min: 0,
      max: 100,
      label: 'Data Confidence (0–100)',
      admin: {
        position: 'sidebar',
        description: 'Scraper confidence score. 100 = fully verified.',
      },
    },
    {
      name: 'needsManualReview',
      type: 'checkbox',
      defaultValue: false,
      label: 'Needs Manual Review',
      admin: {
        position: 'sidebar',
        description: 'Flag set by importer when data looks uncertain.',
      },
    },
  ],
  hooks: {
    beforeValidate: [ensureClinicSlug],
    beforeChange: [denormalizeClinicPhotos],
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

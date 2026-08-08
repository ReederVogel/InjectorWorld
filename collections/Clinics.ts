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
      beforeList: ['/components/admin/list-headers/ClinicsListHeader#ClinicsListHeader'],
      beforeListTable: ['/components/admin/ClinicQueueChips#ClinicQueueChips'],
    },
  },
  access: {
    /**
     * Staff only, even though clinic pages are public. This looks contradictory
     * and is not — read it before "fixing" it.
     *
     * `access.read` is consulted by the Payload REST API. It is NOT consulted by
     * the Local API (`payload.find()` / `payload.findByID()`), which defaults to
     * `overrideAccess: true`. Every server component, every page render, every
     * sitemap entry and all 64 clinic query sites in this repo go through the
     * Local API, so none of them are affected by this line. Verified: there is
     * no `overrideAccess: false` anywhere in the codebase.
     *
     * What this DOES close is `GET /api/clinics`, which Payload generates
     * automatically from this collection and which supported the full `where`,
     * `sort`, `limit` and `depth` query surface. Anonymously, that served all
     * ~40k rows with 59 fields each, including `email` and `phone`, and it
     * ignored the `emailPublic` opt-in below entirely: a clinic with
     * `emailPublic: false` still had its scraped address returned. Confirmed
     * against the staging deployment, including `?where[email][contains]=gmail`
     * returning 5,408 matches, which made it a targeted lookup tool and not
     * merely a bulk export.
     *
     * Nothing in this application consumes that endpoint. The frontend uses
     * purpose-built routes (/api/clinics-list, /api/city-clinics,
     * /api/clinics/lookup). middleware.ts blocks the anonymous case earlier and
     * more cheaply; this line is the authoritative check, because it runs with a
     * genuinely resolved `req.user` and so cannot be bypassed with a forged
     * cookie the way the middleware gate can.
     */
    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
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
                /**
                 * Field-level guards on the two contact fields, as a second
                 * layer under the collection-level `read` above.
                 *
                 * The collection guard is what actually closes GET /api/clinics
                 * today. These exist so that if someone later relaxes that back
                 * to `() => true` (a very reasonable-looking edit, since clinic
                 * pages are public), the scraped contact data does not silently
                 * become public again along with it. That exact combination —
                 * "collection is public, nobody thought about the individual
                 * fields" — is how ~40k business emails ended up exposed.
                 *
                 * As with the collection guard, this only applies to the REST
                 * API. Local API reads (`overrideAccess: true`) are unaffected,
                 * so the clinic page still renders phone and, when the owner has
                 * opted in via `emailPublic`, email.
                 */
                {
                  name: 'phone',
                  type: 'text',
                  access: {
                    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
                  },
                },
                {
                  name: 'email',
                  type: 'email',
                  access: {
                    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
                  },
                },
                {
                  name: 'emailPublic',
                  type: 'checkbox',
                  defaultValue: false,
                  label: 'Show email on the public profile',
                  admin: {
                    description:
                      'Off by default. Phone, website and social are public for every clinic, but a scraped email is never published until the owner claims the profile and turns this on themselves.',
                  },
                },
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
                // Added 2026-08-06. No scraped data for these two yet; the
                // profile renders whichever channels are filled in.
                { name: 'linkedinUrl', type: 'text', label: 'LinkedIn URL' },
                { name: 'youtubeUrl', type: 'text', label: 'YouTube URL' },
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
        description:
          'BUILD BUDGET ONLY -- nothing to do with SEO, despite the column name. When checked, this clinic is left out of the pages pre-rendered at build time (it still renders on demand). Bulk uploads default to checked so a 39k-clinic import cannot blow up the build. Indexing is controlled entirely in SEO > URLs. Until 2026-08-08 this field ALSO silently gated the clinic sitemap, which is why zero clinic urls were ever submitted to Google; the sitemap now reads the url registry instead.',
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
    {
      name: 'analyticsPanel',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: {
          Field: '/components/admin/fields/ClinicAnalyticsPanel#ClinicAnalyticsPanel',
        },
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

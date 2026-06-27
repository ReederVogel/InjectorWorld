import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'
import { denormalizeProviderPhoto } from '../lib/photo'
import { denormalizeProviderSearchDoc, removeProviderSearchDoc } from '../lib/search-doc'

export const Providers: CollectionConfig = {
  slug: 'providers',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'credentials', 'title', 'aggregateRating', 'aggregateRatingCount'],
    listSearchableFields: ['fullName', 'providerId', 'licenseNumber'],
    group: 'Directory',
    description: 'Individual injectors. Ratings come from imported reviews and are read-only. Verification and ratings cannot be set by hand.',
  },
  access: {
    read: () => true,
    // All writes go through the admin panel or /api/dashboard/save (overrideAccess).
    // Blocking the raw Payload REST endpoint prevents any logged-in user (e.g. a patient) from
    // modifying provider records directly.
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    // ── Basic Info ─────────────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Basic Info',
      admin: {
        description: 'Core identity fields. providerId and slug are set by the importer and must be unique.',
        initCollapsed: false,
      },
      fields: [
        { name: 'providerId', type: 'text', required: true, unique: true, index: true },
        { name: 'fullName', type: 'text', required: true, index: true },
        { name: 'slug', type: 'text', required: true, unique: true, index: true },
        {
          name: 'credentials',
          type: 'select',
          required: true,
          options: ['MD', 'DO', 'NP', 'PA', 'RN', 'DDS'].map((v) => ({ label: v, value: v })),
        },
        { name: 'title', type: 'text', required: true },
        { name: 'yearsExperience', type: 'number' },
        { name: 'yearStartedPracticing', type: 'number' },
        {
          name: 'clinic',
          type: 'relationship',
          relationTo: 'clinics',
          required: true,
          admin: { description: 'Primary location.' },
        },
        {
          name: 'additionalClinics',
          type: 'relationship',
          relationTo: 'clinics',
          hasMany: true,
          admin: {
            description:
              'Other locations (branches) where this provider also practices, beyond the primary "clinic" ' +
              'above. Shown as "Also practices at" on the public profile. Optional. A claimed owner can also ' +
              'manage these from their dashboard.',
          },
        },
      ],
    },

    // ── License & Verification ──────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'License & Verification',
      admin: {
        description: 'State license details and NPI. Used for the verified badge on the public profile.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'boardCertifications',
          type: 'array',
          fields: [{ name: 'name', type: 'text', required: true }],
        },
        { name: 'licenseNumber', type: 'text', required: true, index: true },
        { name: 'licenseState', type: 'text', required: true, maxLength: 2, index: true },
        {
          name: 'licenseStatus',
          type: 'select',
          required: true,
          defaultValue: 'Active',
          options: ['Active', 'Inactive', 'Expired'].map((v) => ({ label: v, value: v })),
        },
        { name: 'licenseVerificationUrl', type: 'text', required: true },
        { name: 'npiNumber', type: 'text' },
      ],
    },

    // ── Profile & Media ─────────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Profile & Media',
      admin: {
        description: 'Provider bio, headshot, languages, and gender. Shown on the public profile page.',
        initCollapsed: false,
      },
      fields: [
        { name: 'tagline', type: 'text', maxLength: 100 },
        { name: 'bio', type: 'textarea' },
        { name: 'profilePhotoUrl', type: 'text' },
        {
          name: 'profilePhoto',
          type: 'upload',
          relationTo: 'media',
          admin: {
            description:
              'Uploaded headshot. When set, this is shown instead of the legacy profilePhotoUrl. ' +
              'A claimed provider can upload this from their dashboard.',
          },
        },
        {
          name: 'languages',
          type: 'select',
          hasMany: true,
          options: [
            'English', 'Spanish', 'Mandarin', 'Korean', 'Hindi', 'Russian',
            'French', 'Portuguese', 'Arabic', 'Vietnamese',
          ].map((v) => ({ label: v, value: v })),
        },
        {
          name: 'gender',
          type: 'select',
          options: ['Female', 'Male', 'Non-binary', 'Unknown'].map((v) => ({ label: v, value: v })),
        },
      ],
    },

    // ── Treatments & Pricing ────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Treatments & Pricing',
      admin: {
        description: 'Services offered, specialty tags, price points, and loyalty program affiliations.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'treatmentsOffered',
          type: 'relationship',
          relationTo: 'services',
          hasMany: true,
          required: true,
        },
        {
          name: 'specialties',
          type: 'array',
          fields: [{ name: 'name', type: 'text', required: true }],
        },
        { name: 'pricingBotoxPerUnit', type: 'number' },
        { name: 'pricingFillerPerSyringe', type: 'number' },
        { name: 'pricingConsultation', type: 'number' },
        {
          name: 'startingPrice',
          type: 'number',
          admin: { description: 'Display price on cards.' },
        },
        {
          name: 'loyaltyPrograms',
          type: 'select',
          hasMany: true,
          admin: { description: 'Loyalty programs accepted at this practice.' },
          options: [
            { label: 'Allē (Allergan)', value: 'alle' },
            { label: 'Aspire Galderma', value: 'aspire' },
            { label: 'Xperience (Merz)', value: 'xperience' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
    },

    // ── Availability & Social ───────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Availability & Social',
      admin: {
        description: 'Appointment types, virtual consult flag, and online contact / social links.',
        initCollapsed: false,
      },
      fields: [
        { name: 'acceptsNewPatients', type: 'checkbox', defaultValue: true },
        { name: 'offersVirtualConsult', type: 'checkbox', defaultValue: false },
        { name: 'offersInPerson', type: 'checkbox', defaultValue: true },
        { name: 'websiteUrl', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'phoneDirect', type: 'text' },
        { name: 'instagramUrl', type: 'text' },
        { name: 'tiktokUrl', type: 'text' },
        { name: 'linkedinUrl', type: 'text' },
      ],
    },

    // ── Ratings (read-only) ─────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Ratings',
      admin: {
        description: 'Computed from imported reviews. Do not edit by hand — these are trust signals.',
        initCollapsed: true,
      },
      fields: [
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
      ],
    },

    // ── Admin & Promotion ───────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Admin & Promotion',
      admin: {
        description: 'Editorial pins, subscription billing, and import provenance. Not visible to providers.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'editorsPick',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Show "Top Pick" ribbon on homepage.' },
        },
        { name: 'featuredRank', type: 'number', defaultValue: 999 },
        {
          name: 'subscriptionTier',
          type: 'select',
          defaultValue: 'free',
          access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
          options: [
            { label: 'Free', value: 'free' },
            { label: 'Starter', value: 'starter' },
            { label: 'Pro', value: 'pro' },
            { label: 'Elite', value: 'elite' },
          ],
          admin: { description: 'Plan tier for this provider. Controls feature gating on the public profile and dashboard.' },
        },
        {
          name: 'subscriptionStatus',
          type: 'select',
          defaultValue: 'none',
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
          name: 'sourceUrls',
          type: 'array',
          fields: [{ name: 'url', type: 'text', required: true }],
        },
        { name: 'lastScrapedDate', type: 'date' },
        {
          name: 'importBatch',
          type: 'text',
          index: true,
          access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
          admin: {
            readOnly: true,
            description: 'Set by the data importer to group a batch (for scoped re-import / wipe). Not hand-editable.',
          },
        },
      ],
    },

    // ── Claim ───────────────────────────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Claim',
      admin: {
        description: 'Set automatically when a provider completes the claim flow. Do not edit by hand.',
        initCollapsed: true,
      },
      fields: [
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
          access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
          admin: { readOnly: true, description: 'The user who claimed this profile. Set on claim approval.' },
        },
      ],
    },

    // Sidebar fields — must stay at top level; position: 'sidebar' does not work inside a collapsible.
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
      name: 'profileViewCount',
      type: 'number',
      defaultValue: 0,
      access: { read: ({ req }) => Boolean(req.user?.role === 'admin' || req.user?.role === 'editor') },
      admin: {
        readOnly: true,
        description: 'Total profile page views (server-side, bot-filtered). Auto-incremented, not hand-editable.',
        position: 'sidebar',
      },
    },
  ],
  hooks: {
    beforeChange: [denormalizeProviderPhoto],
    afterChange: [auditAfterChange, revalidateAfterChange, denormalizeProviderSearchDoc],
    afterDelete: [auditAfterDelete, revalidateAfterDelete, removeProviderSearchDoc],
  },
  timestamps: true,
}

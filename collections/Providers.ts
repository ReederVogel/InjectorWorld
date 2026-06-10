import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Providers: CollectionConfig = {
  slug: 'providers',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'credentials', 'title', 'aggregateRating', 'aggregateRatingCount'],
    listSearchableFields: ['fullName', 'providerId', 'licenseNumber'],
    group: 'Directory',
    description: 'Individual injectors. Ratings come from imported reviews and are read-only. Verification and ratings cannot be set by hand.',
  },
  access: { read: () => true },
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
    {
      name: 'boardCertifications',
      type: 'array',
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      type: 'collapsible',
      label: 'License',
      fields: [
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
    { name: 'tagline', type: 'text', maxLength: 100 },
    { name: 'bio', type: 'textarea' },
    { name: 'profilePhotoUrl', type: 'text' },
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
    {
      name: 'treatmentsOffered',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: true,
      required: true,
    },
    {
      name: 'specialties',
      type: 'array',
      fields: [{ name: 'name', type: 'text', required: true }],
    },
    {
      type: 'collapsible',
      label: 'Pricing',
      fields: [
        { name: 'pricingBotoxPerUnit', type: 'number' },
        { name: 'pricingFillerPerSyringe', type: 'number' },
        { name: 'pricingConsultation', type: 'number' },
        { name: 'startingPrice', type: 'number', admin: { description: 'Display price on cards.' } },
      ],
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
    { name: 'acceptsNewPatients', type: 'checkbox', defaultValue: true },
    { name: 'offersVirtualConsult', type: 'checkbox', defaultValue: false },
    { name: 'offersInPerson', type: 'checkbox', defaultValue: true },
    {
      type: 'collapsible',
      label: 'Social',
      fields: [
        { name: 'websiteUrl', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'phoneDirect', type: 'text' },
        { name: 'instagramUrl', type: 'text' },
        { name: 'tiktokUrl', type: 'text' },
        { name: 'linkedinUrl', type: 'text' },
      ],
    },
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
    { name: 'editorsPick', type: 'checkbox', defaultValue: false, admin: { description: 'Show "Editor\'s Pick" ribbon on homepage.' } },
    { name: 'featuredRank', type: 'number', defaultValue: 999 },
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
      admin: {
        readOnly: true,
        description: 'Set by the data importer to group a batch (for scoped re-import / wipe). Not hand-editable.',
      },
    },
    {
      name: 'subscriptionTier',
      type: 'select',
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
        { label: 'Elite', value: 'elite' },
      ],
      admin: { description: 'NOT LIVE YET (Phase 9: Pricing tiers). Plan tier; no feature gating wired yet.' },
    },
    {
      name: 'subscriptionStatus',
      type: 'select',
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Active', value: 'active' },
        { label: 'Past due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
      ],
      admin: { description: 'NOT LIVE YET (Phase 9: Pricing tiers). Billing status; no gating wired yet.' },
    },
    {
      type: 'collapsible',
      label: 'Claim',
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
          admin: { readOnly: true, description: 'The user who claimed this profile. Set on claim approval.' },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  timestamps: true,
}

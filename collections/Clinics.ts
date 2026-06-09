import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['clinicName', 'city', 'state', 'aggregateRating', 'aggregateRatingCount'],
    listSearchableFields: ['clinicName', 'clinicId', 'city'],
    group: 'Directory',
    description: 'Physical clinic locations. Ratings come from imported reviews and are read-only. Each clinic is its own page and location.',
  },
  access: { read: () => true },
  fields: [
    { name: 'clinicId', type: 'text', required: true, unique: true, index: true },
    { name: 'clinicName', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'tagline', type: 'text', maxLength: 100 },
    { name: 'description', type: 'textarea' },
    {
      name: 'brand',
      type: 'relationship',
      relationTo: 'brands',
      admin: {
        description:
          'Parent brand, if this clinic is one of several branches. Optional. Each clinic stays its own location.',
      },
    },
    {
      type: 'collapsible',
      label: 'Address',
      fields: [
        { name: 'addressLine1', type: 'text', required: true },
        { name: 'addressLine2', type: 'text' },
        { name: 'city', type: 'text', required: true, index: true },
        { name: 'state', type: 'text', required: true, maxLength: 2, index: true },
        { name: 'zip', type: 'text', required: true },
        { name: 'neighborhood', type: 'text', index: true },
        { name: 'county', type: 'text' },
        { name: 'country', type: 'text', required: true, defaultValue: 'US' },
      ],
    },
    {
      type: 'collapsible',
      label: 'Map data',
      fields: [
        { name: 'latitude', type: 'number', required: true, index: true },
        { name: 'longitude', type: 'number', required: true, index: true },
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
        { name: 'phone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'websiteUrl', type: 'text', required: true },
        { name: 'bookingUrl', type: 'text' },
      ],
    },
    { name: 'hoursJson', type: 'json' },
    {
      name: 'serviceType',
      type: 'select',
      required: true,
      defaultValue: 'In-Person',
      options: [
        { label: 'In-Person', value: 'In-Person' },
        { label: 'Telehealth', value: 'Telehealth' },
        { label: 'Both', value: 'Both' },
      ],
    },
    { name: 'acceptsInsurance', type: 'checkbox', defaultValue: false },
    { name: 'paymentMethods', type: 'text', admin: { description: 'Semicolon list.' } },
    { name: 'amenities', type: 'text', admin: { description: 'Semicolon list.' } },
    { name: 'logoUrl', type: 'text' },
    {
      name: 'clinicPhotoUrls',
      type: 'array',
      fields: [{ name: 'url', type: 'text', required: true }],
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
    {
      name: 'providers',
      type: 'relationship',
      relationTo: 'providers',
      hasMany: true,
    },
    { name: 'yearEstablished', type: 'number' },
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

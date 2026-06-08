import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    useAsTitle: 'clinicName',
    defaultColumns: ['clinicName', 'city', 'state', 'aggregateRating', 'aggregateRatingCount'],
    group: 'Directory',
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
    { name: 'aggregateRating', type: 'number' },
    { name: 'aggregateRatingCount', type: 'number' },
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
      name: 'subscriptionTier',
      type: 'select',
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Starter', value: 'starter' },
        { label: 'Pro', value: 'pro' },
        { label: 'Elite', value: 'elite' },
      ],
      admin: { description: 'Plan tier. Fields only, no gating logic yet (Phase 8).' },
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
    },
    {
      type: 'collapsible',
      label: 'Claim',
      fields: [
        {
          name: 'claimed',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Set automatically when a claim is approved.' },
        },
        {
          name: 'claimedBy',
          type: 'relationship',
          relationTo: 'users',
          admin: { description: 'The user who claimed this profile.' },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
}

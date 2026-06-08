import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'

/**
 * A Brand is a parent company that owns one or more clinic locations (branches).
 * Each clinic stays its own physical location with its own page; the brand only
 * groups them. Branch detection is auto-SUGGEST (via DataAlerts) + human confirm,
 * never silent merge. See docs/DECISIONS.md (branch model).
 */
export const Brands: CollectionConfig = {
  slug: 'brands',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'claimed', 'subscriptionTier'],
    group: 'Directory',
    description:
      'Parent company that owns one or more clinic locations (branches). Each clinic stays its own location.',
  },
  access: { read: () => true },
  fields: [
    { name: 'brandId', type: 'text', required: true, unique: true, index: true },
    { name: 'name', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'logoUrl', type: 'text' },
    { name: 'websiteUrl', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      type: 'collapsible',
      label: 'Social',
      fields: [
        { name: 'instagramUrl', type: 'text' },
        { name: 'tiktokUrl', type: 'text' },
        { name: 'linkedinUrl', type: 'text' },
      ],
    },
    // Subscription tier (fields only, no gating logic yet — Phase 8).
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
          admin: { description: 'The user who claimed this brand.' },
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

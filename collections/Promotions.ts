import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

const MAX_SPONSORED_SLOTS = 3
const MAX_PIN_SLOTS = 3
const MAX_BANNER_SLOTS = 1

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  admin: {
    useAsTitle: 'notes',
    defaultColumns: ['placement', 'provider', 'scopeType', 'rank', 'active', 'endDate'],
    group: 'Commercial',
    description: [
      'Three placement types per scope:',
      '  banner — max 1 active ad banner (image + outbound link, no provider required).',
      '  sponsored-card — max 3 active cards, each with a unique rank (existing behaviour).',
      '  organic-pin — max 3 active pins, each with a unique rank (admin-pinned top of organic list).',
      'Limits are enforced per placement per scope. Overselling is hard-blocked.',
    ].join('\n'),
  },
  access: {
    read: () => true,
    create: ({ req }) => {
      const role = (req.user as any)?.role
      return role === 'admin' || role === 'editor'
    },
    update: ({ req }) => {
      const role = (req.user as any)?.role
      return role === 'admin' || role === 'editor'
    },
    delete: ({ req }) => {
      const role = (req.user as any)?.role
      return role === 'admin' || role === 'editor'
    },
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Only active promotions compete for limited slots.
        if (!data.active) return data

        const placement: string = data.placement ?? 'sponsored-card'

        // Build a where clause matching the same scope AND the same placement.
        // Filtering by placement is critical: without it, banners would eat into
        // the sponsored-card budget, and pins would eat into the banner budget.
        const where: Record<string, unknown> = {
          active: { equals: true },
          scopeType: { equals: data.scopeType },
          placement: { equals: placement },
        }
        if (data.treatmentScope) where.treatmentScope = { equals: data.treatmentScope }
        if (data.locationScope) where.locationScope = { equals: data.locationScope }
        if (data.bodyAreaScope) where.bodyAreaScope = { equals: data.bodyAreaScope }

        const existing = await req.payload.find({
          collection: 'promotions',
          where: where as any,
          limit: 100,
          depth: 0,
        })

        // Exclude the record being edited from the counts.
        const selfId = originalDoc?.id ?? (data as any).id
        const others = existing.docs.filter((d: any) => d.id !== selfId)

        if (placement === 'banner') {
          if (others.length >= MAX_BANNER_SLOTS) {
            throw new Error(
              `This scope already has an active ad banner. ` +
                `Deactivate or delete the existing banner before adding a new one.`,
            )
          }
        } else if (placement === 'sponsored-card') {
          if (others.length >= MAX_SPONSORED_SLOTS) {
            throw new Error(
              `This scope already has ${MAX_SPONSORED_SLOTS} active sponsored cards, which is the maximum. ` +
                `Deactivate an existing slot before adding another. ` +
                `If a provider was charged for this slot, it cannot display until you free one up.`,
            )
          }
          const rankClash = others.find((d: any) => d.rank === data.rank)
          if (rankClash) {
            throw new Error(
              `Rank ${data.rank} is already taken for sponsored cards in this scope. ` +
                `Each sponsored card needs a unique rank. ` +
                `Try rank ${[1, 2, 3].find((r) => !others.some((d: any) => d.rank === r)) ?? 'another value'} instead.`,
            )
          }
        } else if (placement === 'organic-pin') {
          if (others.length >= MAX_PIN_SLOTS) {
            throw new Error(
              `This scope already has ${MAX_PIN_SLOTS} active organic pins, which is the maximum. ` +
                `Deactivate an existing pin before adding another.`,
            )
          }
          const rankClash = others.find((d: any) => d.rank === data.rank)
          if (rankClash) {
            throw new Error(
              `Rank ${data.rank} is already taken for organic pins in this scope. ` +
                `Try rank ${[1, 2, 3].find((r) => !others.some((d: any) => d.rank === r)) ?? 'another value'} instead.`,
            )
          }
        }

        return data
      },
    ],
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, revalidateAfterDelete],
  },
  fields: [
    // ── Core ─────────────────────────────────────────────────────────────────
    {
      name: 'placement',
      type: 'select',
      required: true,
      defaultValue: 'sponsored-card',
      options: [
        { label: 'Sponsored Card (existing behaviour)', value: 'sponsored-card' },
        { label: 'Ad Banner (top of page, image + link)', value: 'banner' },
        { label: 'Organic Pin (pinned to top of organic list)', value: 'organic-pin' },
      ],
      admin: {
        description: 'Where this promotion appears on listing pages.',
      },
    },
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'providers',
      required: false,
      admin: {
        description:
          'The provider this slot promotes. Required for sponsored cards and organic pins. ' +
          'Optional for banners (which may advertise a third party without a provider profile).',
      },
    },

    // ── Banner-only fields ────────────────────────────────────────────────────
    {
      name: 'advertiserName',
      type: 'text',
      admin: {
        description: 'Advertiser display name shown alongside the "Ad" label.',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerImageUrl',
      type: 'text',
      admin: {
        description: 'Full URL of the banner image. Recommended size: 1200 x 160 px.',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerLinkUrl',
      type: 'text',
      admin: {
        description: 'Destination URL when the banner is clicked (opens in a new tab).',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerAltText',
      type: 'text',
      admin: {
        description: 'Alt text for the banner image (accessibility and SEO).',
        condition: (data) => data.placement === 'banner',
      },
    },

    // ── Scope fields ─────────────────────────────────────────────────────────
    {
      name: 'scopeType',
      type: 'select',
      required: true,
      options: [
        { label: 'Treatment (sitewide)', value: 'treatment' },
        { label: 'State', value: 'state' },
        { label: 'City', value: 'city' },
        { label: 'Treatment + State', value: 'treatment+state' },
        { label: 'Treatment + City (most targeted)', value: 'treatment+city' },
        { label: 'Body Area', value: 'body-area' },
      ],
      admin: { description: 'Which listing pages this promotion appears on.' },
    },
    {
      name: 'treatmentScope',
      type: 'relationship',
      relationTo: 'treatments',
      admin: {
        description: 'Required when scope includes a treatment.',
        condition: (data) =>
          ['treatment', 'treatment+state', 'treatment+city'].includes(data.scopeType),
      },
    },
    {
      name: 'locationScope',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'Required when scope includes a state or city.',
        condition: (data) =>
          ['state', 'city', 'treatment+state', 'treatment+city'].includes(data.scopeType),
      },
    },
    {
      name: 'bodyAreaScope',
      type: 'text',
      admin: {
        description: 'Body area slug (e.g. "forehead"). Required when scope = body-area.',
        condition: (data) => data.scopeType === 'body-area',
      },
    },

    // ── Rank (sponsored-card and organic-pin only) ────────────────────────────
    {
      name: 'rank',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 3,
      admin: {
        description: 'Display position 1, 2, or 3. Used for sponsored cards and organic pins.',
        condition: (data) => data.placement !== 'banner',
      },
    },

    // ── Scheduling ────────────────────────────────────────────────────────────
    { name: 'startDate', type: 'date' },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'Auto-expires after this date. Leave blank for no expiry.' },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Internal label. E.g. "Botox Houston — Q3 2026 ad banner".',
      },
    },
  ],
  timestamps: true,
}

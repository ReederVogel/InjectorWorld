import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'

const MAX_SLOTS_PER_SCOPE = 3

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  admin: {
    useAsTitle: 'notes',
    defaultColumns: ['provider', 'scopeType', 'rank', 'active', 'endDate'],
    group: 'Commercial',
    description: `Sponsored slots. Max ${MAX_SLOTS_PER_SCOPE} active per scope, each with a unique rank. The system blocks a 4th slot or a duplicate rank to prevent overselling.`,
  },
  access: { read: () => true },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Only active slots compete for the limited sponsored positions.
        if (!data.active) return data

        // Build a where clause matching the exact same scope.
        const where: Record<string, unknown> = {
          active: { equals: true },
          scopeType: { equals: data.scopeType },
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

        // Exclude the record being edited from the count.
        const selfId = originalDoc?.id ?? (data as any).id
        const others = existing.docs.filter((d: any) => d.id !== selfId)

        // Guard 1: never more than MAX_SLOTS_PER_SCOPE active slots in one scope.
        if (others.length >= MAX_SLOTS_PER_SCOPE) {
          throw new Error(
            `This scope already has ${MAX_SLOTS_PER_SCOPE} active sponsored slots, which is the maximum. ` +
              `Deactivate an existing slot before adding another. ` +
              `Heads up: if a provider was charged for this slot, it cannot be displayed until you free one up.`,
          )
        }

        // Guard 2: each rank (1, 2, 3) must be unique within a scope.
        const rankClash = others.find((d: any) => d.rank === data.rank)
        if (rankClash) {
          throw new Error(
            `Rank ${data.rank} is already taken in this scope. ` +
              `Each sponsored slot needs a unique rank. Use ${
                [1, 2, 3].find((r) => !others.some((d: any) => d.rank === r)) ?? 'another value'
              } instead.`,
          )
        }

        return data
      },
    ],
    afterChange: [auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  fields: [
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'providers',
      required: true,
      admin: { description: 'The provider this paid slot promotes.' },
    },
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
      admin: { description: 'Where this sponsored slot appears.' },
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
    {
      name: 'rank',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 3,
      admin: { description: 'Slot position 1, 2, or 3. Max 3 sponsored per page.' },
    },
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
      admin: { description: 'Internal label. E.g. "Botox NYC — Q3 2026 campaign".' },
    },
  ],
  timestamps: true,
}

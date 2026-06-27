import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

const MAX_BANNER_SLOTS = 1
const MAX_SPONSORED_SLOTS = 3
const MAX_FEATURED_SLOTS = 3

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'placement', 'scope', 'status', 'endDate'],
    group: 'Monetization',
    description:
      'Three placement types per scope:\n' +
      '  banner — max 1 active per scope. Needs image + link.\n' +
      '  sponsored-card — max 3 per scope. Promotes a provider OR a clinic.\n' +
      '  featured-pin — max 3 per scope. Pins to top of organic list (positions 1-3).',
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
    delete: ({ req }) => (req.user as any)?.role === 'admin',
  },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Only active promotions are validated. Inactive/draft promos may be
        // incomplete, and deactivating an existing promo must always be allowed.
        if (data.status !== 'active') return data

        const placement: string = data.placement ?? 'sponsored-card'
        const field = (name: string) => (data as any)[name] ?? (originalDoc as any)?.[name]

        // ── Completeness validation ────────────────────────────────────────────
        if (placement === 'sponsored-card' || placement === 'featured-pin') {
          if (!field('provider') && !field('clinic')) {
            throw new Error(
              `A ${placement} must link to a provider or a clinic. ` +
                `Set at least one, or set this promotion to draft to save without linking.`,
            )
          }
        }

        if (placement === 'banner') {
          if (!field('bannerImage')) {
            throw new Error(
              `A banner must have a banner image before going active. ` +
                `Upload an image or set the promotion to draft.`,
            )
          }
          if (!field('bannerLinkUrl')) {
            throw new Error(`A banner needs a destination link (Banner Link URL) before going active.`)
          }
        }

        // ── Scope field validation ─────────────────────────────────────────────
        const scope: string = field('scope') ?? 'national'
        const needsTreatment = scope.startsWith('treatment')
        const needsState = scope === 'state' || scope === 'treatment+state'
        const needsCity = scope === 'city' || scope === 'treatment+city'

        if (needsTreatment && !field('treatment')) {
          throw new Error(`Scope "${scope}" requires a treatment. Set the Treatment field.`)
        }
        if (needsState && !field('state')) {
          throw new Error(`Scope "${scope}" requires a state location. Set the State field.`)
        }
        if (needsCity && !field('city')) {
          throw new Error(`Scope "${scope}" requires a city location. Set the City field.`)
        }

        // ── Slot guard ─────────────────────────────────────────────────────────
        const where: Record<string, unknown> = {
          status: { equals: 'active' },
          scope: { equals: field('scope') },
          placement: { equals: placement },
        }
        if (field('treatment')) where.treatment = { equals: field('treatment') }
        if (field('state')) where.state = { equals: field('state') }
        if (field('city')) where.city = { equals: field('city') }

        const existing = await req.payload.find({
          collection: 'promotions',
          where: where as any,
          limit: 10,
          depth: 0,
        })

        const selfId = originalDoc?.id ?? (data as any).id
        const others = existing.docs.filter((d: any) => d.id !== selfId)

        if (placement === 'banner') {
          if (others.length >= MAX_BANNER_SLOTS) {
            throw new Error(
              `This scope already has an active banner. ` +
                `Deactivate or delete the existing banner before adding a new one.`,
            )
          }
        } else if (placement === 'sponsored-card') {
          if (others.length >= MAX_SPONSORED_SLOTS) {
            throw new Error(
              `This scope already has ${MAX_SPONSORED_SLOTS} active sponsored cards (maximum). ` +
                `Deactivate an existing slot before adding another.`,
            )
          }
          const rankClash = others.find((d: any) => d.featuredRank === data.featuredRank)
          if (rankClash) {
            const available = [1, 2, 3].find((r) => !others.some((d: any) => d.featuredRank === r))
            throw new Error(
              `Rank ${data.featuredRank} is already taken for sponsored cards in this scope. ` +
                `Try rank ${available ?? 'another value'} instead.`,
            )
          }
        } else if (placement === 'featured-pin') {
          if (others.length >= MAX_FEATURED_SLOTS) {
            throw new Error(
              `This scope already has ${MAX_FEATURED_SLOTS} active featured pins (maximum). ` +
                `Deactivate an existing pin before adding another.`,
            )
          }
          const rankClash = others.find((d: any) => d.featuredRank === data.featuredRank)
          if (rankClash) {
            const available = [1, 2, 3].find((r) => !others.some((d: any) => d.featuredRank === r))
            throw new Error(
              `Rank ${data.featuredRank} is already taken for featured pins in this scope. ` +
                `Try rank ${available ?? 'another value'} instead.`,
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
    // ── Identity ────────────────────────────────────────────────────────────────
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Internal label e.g. "Botox Houston Q3 2026".' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Expired', value: 'expired' },
      ],
    },

    // ── Placement ───────────────────────────────────────────────────────────────
    {
      name: 'placement',
      type: 'select',
      required: true,
      defaultValue: 'sponsored-card',
      options: [
        { label: 'Banner (top of page, image + link)', value: 'banner' },
        { label: 'Sponsored Card (in listing grid)', value: 'sponsored-card' },
        { label: 'Featured Pin (hoisted to top of organic list)', value: 'featured-pin' },
      ],
      admin: { description: 'Where this promotion appears on listing pages.' },
    },

    // ── Scope ───────────────────────────────────────────────────────────────────
    {
      name: 'scope',
      type: 'select',
      required: true,
      defaultValue: 'national',
      options: [
        { label: 'National (all directory pages)', value: 'national' },
        { label: 'Treatment (e.g. all Botox pages)', value: 'treatment' },
        { label: 'State (Find path — /texas)', value: 'state' },
        { label: 'City (Find path — /texas/houston)', value: 'city' },
        { label: 'Treatment + State (/botox/texas)', value: 'treatment+state' },
        { label: 'Treatment + City (/botox/texas/houston — most targeted)', value: 'treatment+city' },
      ],
      admin: { description: 'Which pages this promotion appears on.' },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'services',
      admin: {
        description: 'Required when scope includes a treatment (service).',
        condition: (data) => (data.scope ?? '').startsWith('treatment'),
      },
    },
    {
      name: 'state',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'State location. Required when scope = state or treatment+state.',
        condition: (data) => data.scope === 'state' || data.scope === 'treatment+state',
      },
    },
    {
      name: 'city',
      type: 'relationship',
      relationTo: 'locations',
      admin: {
        description: 'City location (kind = city or metro). Required when scope = city or treatment+city.',
        condition: (data) => data.scope === 'city' || data.scope === 'treatment+city',
      },
    },

    // ── What is being promoted ──────────────────────────────────────────────────
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'providers',
      admin: {
        description: 'Provider to promote. Required for sponsored-card and featured-pin unless a clinic is set instead.',
        condition: (data) => data.placement !== 'banner',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      admin: {
        description: 'Promote a clinic instead of a provider. Set this OR provider, not both.',
        condition: (data) => data.placement !== 'banner',
      },
    },

    // ── Banner creative (banner placement only) ─────────────────────────────────
    {
      name: 'bannerImage',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Banner image. Required for banner placement. Recommended size: 1200 × 200 px (6:1).',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerLinkUrl',
      type: 'text',
      admin: {
        description: 'Destination URL when the banner is clicked (opens in new tab). Required for banner.',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerAltText',
      type: 'text',
      admin: {
        description: 'Alt text for the banner image (accessibility).',
        condition: (data) => data.placement === 'banner',
      },
    },

    // ── Rank (sponsored-card and featured-pin) ──────────────────────────────────
    {
      name: 'featuredRank',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 3,
      admin: {
        description: 'Display position 1, 2, or 3 within the sponsored / featured section.',
        condition: (data) => data.placement !== 'banner',
      },
    },

    // ── Scheduling ──────────────────────────────────────────────────────────────
    { name: 'startDate', type: 'date' },
    {
      name: 'endDate',
      type: 'date',
      admin: { description: 'Auto-expires after this date. Leave blank for no expiry.' },
    },

    // ── Billing notes ───────────────────────────────────────────────────────────
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Internal billing / contact notes. Not shown publicly.' },
    },
  ],
  timestamps: true,
}

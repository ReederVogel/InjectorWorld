import type { CollectionConfig } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

const MAX_SPONSORED_SLOTS = 3
const MAX_PIN_SLOTS = 3
const MAX_BANNER_SLOTS = 1
const MIN_ZIP_RADIUS = 1
const MAX_ZIP_RADIUS = 50
const DEFAULT_ZIP_RADIUS = 10

export const Promotions: CollectionConfig = {
  slug: 'promotions',
  admin: {
    useAsTitle: 'notes',
    defaultColumns: ['placement', 'provider', 'scopeType', 'zipScope', 'rank', 'active', 'endDate'],
    group: 'Commercial',
    description: [
      'Three placement types per scope:',
      '  banner — max 1 active ad banner (image + outbound link, no provider required).',
      '  sponsored-card — max 3 active cards, each with a unique rank.',
      '  organic-pin — max 3 active pins, each with a unique rank (admin-pinned top of organic list).',
      'Scope types include city/state/treatment (existing) plus zip and treatment+zip (Phase 14).',
      '  zip / treatment+zip — provider floated to the top of any search centred within zipRadiusMiles',
      '  of the ZIP centroid. Slot guard: max sponsored + banner limits apply per ZIP.',
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
        // Only active promotions are validated for completeness and compete for
        // limited slots. Inactive/draft promos may be incomplete, and deactivating
        // an existing (even broken) promo must always be allowed.
        if (!data.active) return data

        const placement: string = data.placement ?? 'sponsored-card'

        // ── Completeness validation ──────────────────────────────────────────
        // Read merged values so partial API updates don't trip a false "missing".
        const field = (name: string) => (data as any)[name] ?? (originalDoc as any)?.[name]
        const scopeType: string = field('scopeType')

        // Provider is required for any slot that renders a provider card.
        if (placement === 'sponsored-card' || placement === 'organic-pin') {
          if (!field('provider')) {
            const label = placement === 'sponsored-card' ? 'sponsored card' : 'organic pin'
            throw new Error(
              `A ${label} must point at a provider. ` +
                `Select a provider, or set this promotion inactive to save it as a draft.`,
            )
          }
        }

        // Banners need a creative (image) and a destination link.
        if (placement === 'banner') {
          if (!field('bannerImageUrl')) {
            throw new Error(
              `An ad banner needs a banner image URL before it can go active. ` +
                `Add the image (1200 x 200 px), or set the banner inactive to save a draft.`,
            )
          }
          if (!field('bannerLinkUrl')) {
            throw new Error(
              `An ad banner needs a destination link (banner link URL) before it can go active.`,
            )
          }
        }

        // Scope fields must match the chosen scopeType.
        const isZipScope = scopeType === 'zip' || scopeType === 'treatment+zip'
        const needsTreatment = ['treatment', 'treatment+state', 'treatment+city', 'treatment+zip'].includes(scopeType)
        const needsLocation = ['state', 'city', 'treatment+state', 'treatment+city'].includes(scopeType)
        if (needsTreatment && !field('treatmentScope')) {
          throw new Error(`Scope "${scopeType}" requires a treatment. Set the Treatment scope field.`)
        }
        if (needsLocation && !field('locationScope')) {
          throw new Error(`Scope "${scopeType}" requires a state or city. Set the Location scope field.`)
        }
        if (scopeType === 'body-area' && !field('bodyAreaScope')) {
          throw new Error(`Scope "body-area" requires a body area slug. Set the Body area scope field.`)
        }
        if (isZipScope) {
          const zipVal = field('zipScope')
          if (!zipVal) {
            throw new Error(`Scope "${scopeType}" requires a ZIP code. Set the ZIP scope field.`)
          }
          if (!/^\d{5}$/.test(String(zipVal))) {
            throw new Error(`ZIP scope must be a 5-digit US ZIP code (e.g. 10001). Got: ${zipVal}`)
          }
          // Verify the ZIP exists in the zip_codes table.
          try {
            const pool = (req as any).payload?.db?.pool
            if (pool) {
              const hit = await pool.query(
                `SELECT zip FROM zip_codes WHERE zip = $1 LIMIT 1`,
                [String(zipVal)],
              )
              if (!hit.rows.length) {
                throw new Error(
                  `ZIP code ${zipVal} was not found in the ZIP code database. ` +
                    `Run "npm run seed:zips" to populate the ZIP code dataset, or check the code.`,
                )
              }
            }
          } catch (err: any) {
            if (err.message?.startsWith('ZIP code')) throw err
            // DB query failed (e.g. table not seeded yet) — warn but do not block.
            console.warn('[Promotions] ZIP lookup error (non-blocking):', err.message)
          }
        }

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
        if ((data as any).zipScope) where.zipScope = { equals: (data as any).zipScope }

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
        description:
          'Full URL of the banner image. Required to go active. Size 1200 x 200 px (6:1 ratio, ' +
          'matches how it renders). JPG or PNG, keep under ~200 KB. The image is cropped to fit, ' +
          'so keep key content centered.',
        condition: (data) => data.placement === 'banner',
      },
    },
    {
      name: 'bannerLinkUrl',
      type: 'text',
      admin: {
        description: 'Destination URL when the banner is clicked (opens in a new tab). Required to go active.',
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
        { label: 'ZIP Code + Radius', value: 'zip' },
        { label: 'Treatment + ZIP Code + Radius', value: 'treatment+zip' },
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
          ['treatment', 'treatment+state', 'treatment+city', 'treatment+zip'].includes(data.scopeType),
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
      name: 'zipScope',
      type: 'text',
      maxLength: 5,
      admin: {
        description:
          'The 5-digit US ZIP code at the centre of this featuring radius. ' +
          'Must exist in the ZIP code dataset (run "npm run seed:zips" if not yet seeded). ' +
          'Required when scope is "zip" or "treatment+zip".',
        condition: (data) => data.scopeType === 'zip' || data.scopeType === 'treatment+zip',
      },
    },
    {
      name: 'zipRadiusMiles',
      type: 'number',
      defaultValue: DEFAULT_ZIP_RADIUS,
      min: MIN_ZIP_RADIUS,
      max: MAX_ZIP_RADIUS,
      admin: {
        description:
          `Featuring radius in miles (${MIN_ZIP_RADIUS}–${MAX_ZIP_RADIUS}). ` +
          'This provider is floated to the top of any search whose centre point falls within this radius ' +
          'of the ZIP centroid. Default is 10 miles.',
        condition: (data) => data.scopeType === 'zip' || data.scopeType === 'treatment+zip',
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
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { components: { Cell: '/components/admin/cells/PromoActiveCell#PromoActiveCell' } },
    },
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

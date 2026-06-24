import type { CollectionConfig } from 'payload'

export const Photos: CollectionConfig = {
  slug: 'photos',
  admin: {
    useAsTitle: 'photoId',
    defaultColumns: ['photoId', 'type', 'provider', 'treatmentTag', 'consentDocumented'],
    group: 'Media',
    description: 'Provider and clinic photos. Only photos with documented consent may be shown publicly.',
  },
  access: {
    read: () => true,
    // Provider photo uploads go through /api/dashboard/upload (overrideAccess + ownership check).
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'photoId', type: 'text', required: true, unique: true, index: true },
    { name: 'provider', type: 'relationship', relationTo: 'providers' },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
    { name: 'treatmentTag', type: 'text' },
    { name: 'photoUrl', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        'before', 'after', 'headshot', 'clinic_interior',
        'clinic_exterior', 'treatment_room', 'team', 'equipment',
      ].map((v) => ({ label: v, value: v })),
    },
    { name: 'pairId', type: 'text', admin: { description: 'Same id on a before + after pair.' } },
    { name: 'weeksPostTreatment', type: 'number' },
    { name: 'caption', type: 'text' },
    { name: 'consentDocumented', type: 'checkbox', defaultValue: false },
    {
      name: 'sourcePlatform',
      type: 'select',
      required: true,
      options: ['clinic_site', 'google', 'instagram', 'injectors_world']
        .map((v) => ({ label: v, value: v })),
    },
    { name: 'sourceUrl', type: 'text', required: true },
    {
      name: 'importBatch',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'Set by the data importer to group a batch (for scoped re-import / wipe). Not hand-editable.',
      },
    },
  ],
  timestamps: true,
}

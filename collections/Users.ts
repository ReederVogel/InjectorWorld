import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  admin: {
    useAsTitle: 'email',
    group: 'Access',
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'patient',
      // Only admins/editors can assign or change roles — prevents self-promotion to admin
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Provider', value: 'provider' },
        { label: 'Patient', value: 'patient' },
      ],
    },
    {
      name: 'linkedProvider',
      type: 'relationship',
      relationTo: 'providers',
      // Only admins/editors can link provider profiles (set during claim approval via overrideAccess)
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      admin: { description: 'Set on claim approval. The provider profile this user can edit.' },
    },
    {
      name: 'linkedClinic',
      type: 'relationship',
      relationTo: 'clinics',
      // Only admins/editors can link clinic profiles (set during claim approval via overrideAccess)
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      admin: { description: 'Set on claim approval. The clinic profile this user can edit.' },
    },
    {
      name: 'savedProviders',
      type: 'relationship',
      relationTo: 'providers',
      hasMany: true,
      admin: { description: 'Providers this patient saved. Wired in Phase 7 (patient profile).' },
    },
    {
      name: 'savedClinics',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: true,
      admin: { description: 'Clinics this patient saved. Wired in Phase 7 (patient profile).' },
    },
  ],
}

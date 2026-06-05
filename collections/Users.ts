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
      admin: { description: 'Set on claim approval. The provider profile this user can edit.' },
    },
    {
      name: 'linkedClinic',
      type: 'relationship',
      relationTo: 'clinics',
      admin: { description: 'Set on claim approval. The clinic profile this user can edit.' },
    },
  ],
}

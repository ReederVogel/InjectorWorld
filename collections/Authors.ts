import type { CollectionConfig } from 'payload'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'role', 'articleCount'],
    group: 'Content',
    description: 'Editorial bylines shown on guides and articles.',
  },
  access: { read: () => true },
  fields: [
    { name: 'fullName', type: 'text', required: true, index: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'role', type: 'text', defaultValue: 'Senior Editor' },
    { name: 'bio', type: 'textarea' },
    { name: 'photoUrl', type: 'text' },
    { name: 'linkedinUrl', type: 'text' },
    { name: 'twitterUrl', type: 'text' },
    { name: 'articleCount', type: 'number', defaultValue: 0 },
  ],
  timestamps: true,
}

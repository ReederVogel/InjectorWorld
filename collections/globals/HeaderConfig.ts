import type { GlobalConfig } from 'payload'

export const HeaderConfig: GlobalConfig = {
  slug: 'header-config',
  label: 'Header Editor',
  admin: {
    description: 'Control which services, locations, and guides appear in the navigation mega menu. Changes go live within 60 seconds.',
    group: 'Site Settings',
  },
  fields: [
    {
      name: 'featuredBrands',
      label: 'Featured Brands (max 10)',
      type: 'relationship',
      relationTo: 'brands',
      hasMany: true,
      maxRows: 10,
      admin: {
        description: 'Pick up to 10 product brands to show in the Brands section of the menu.',
      },
    },
    {
      name: 'featuredServices',
      label: 'Featured Services (max 10)',
      type: 'relationship',
      relationTo: 'services',
      hasMany: true,
      maxRows: 10,
      admin: {
        description: 'Pick up to 10 services to show in the Services section of the menu.',
      },
    },
    {
      name: 'featuredLocations',
      label: 'Featured Locations (max 20 — any mix of cities and states)',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      maxRows: 20,
      admin: {
        description: 'Pick any mix of cities and states. These appear in the Find section.',
      },
    },
    {
      name: 'featuredGuides',
      label: 'Featured Guides (max 10)',
      type: 'relationship',
      relationTo: 'guides',
      hasMany: true,
      maxRows: 10,
      admin: {
        description: 'Pick up to 10 guides to show in the Learn section of the menu.',
      },
    },
  ],
}

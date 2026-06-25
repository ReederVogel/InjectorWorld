import type { GlobalConfig } from 'payload'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Site Config',
  admin: {
    group: 'Site Settings',
    description: 'Master switch for search engine visibility. Use the dashboard toggle for a cleaner experience.',
  },
  fields: [
    {
      name: 'siteNoindex',
      label: 'Block search engines (noindex)',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'When on: robots.txt blocks all crawlers + noindex meta tag on every page. Turn off when the site is ready to go live.',
      },
    },
  ],
}

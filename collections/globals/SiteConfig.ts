import type { GlobalConfig } from 'payload'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Visibility & Indexing',
  admin: {
    group: 'Site',
    description: 'Master switch for search engine visibility. Use the dashboard toggle for a cleaner experience.',
  },
  // Globals default to "any authenticated user" in Payload -- patients self-register
  // into the same `users` collection, so without this they could PATCH the raw
  // global endpoint directly and flip site-wide search visibility.
  access: {
    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  fields: [
    {
      name: 'siteNoindex',
      label: 'Block search engines (noindex)',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'When on: crawlers can still crawl the site, but every page carries a noindex meta tag so search engines won\'t list it. Turn off when the site is ready to go live.',
      },
    },
  ],
}

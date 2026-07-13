import type { GlobalConfig } from 'payload'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  label: 'Site Settings',
  admin: {
    group: 'More',
    description: 'Search visibility and the sitewide link preview (title/description/image shown when the homepage link is shared in Slack, email, iMessage, etc).',
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
    {
      name: 'metaTitle',
      label: 'Link preview title',
      type: 'text',
      admin: {
        description: 'Title shown when the homepage link is shared anywhere (Slack, email, iMessage, etc). Leave blank to use the built-in default.',
      },
    },
    {
      name: 'metaDescription',
      label: 'Link preview description',
      type: 'textarea',
      admin: {
        description: 'Description shown under the title in link previews. Leave blank to use the built-in default.',
      },
    },
    {
      name: 'ogImage',
      label: 'Link preview image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Image shown in link previews. Recommended 1200x630. Leave blank to use the default logo mark.',
      },
    },
  ],
}

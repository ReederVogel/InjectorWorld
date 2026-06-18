import type { CollectionConfig } from 'payload'

export const SocialPosts: CollectionConfig = {
  slug: 'social-posts',
  admin: {
    useAsTitle: 'author',
    defaultColumns: ['author', 'platform', 'featured', 'active', 'sortRank'],
    group: 'Content',
    description: 'Social proof posts shown in the "What they\'re saying" homepage section.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'platform',
      type: 'select',
      required: true,
      options: [
        { label: 'X (Twitter)', value: 'x' },
        { label: 'Instagram', value: 'instagram' },
        { label: 'Facebook', value: 'facebook' },
        { label: 'Reddit', value: 'reddit' },
        { label: 'Google', value: 'google' },
      ],
    },
    {
      name: 'quote',
      type: 'textarea',
      required: true,
      admin: { description: 'The review or post text (the quote shown on screen).' },
    },
    {
      name: 'author',
      type: 'text',
      required: true,
      admin: { description: 'Author display name, e.g. "Caroline M.".' },
    },
    {
      name: 'handle',
      type: 'text',
      required: true,
      admin: { description: 'Username or handle, e.g. "@carolinem_nyc" or "u/skin_curious".' },
    },
    {
      name: 'avatarUrl',
      type: 'text',
      admin: { description: 'URL to the author avatar image. Leave blank to use a default.' },
    },
    {
      name: 'href',
      type: 'text',
      defaultValue: '#',
      admin: { description: 'Link to the original post. Use # if not applicable.' },
    },
    {
      name: 'date',
      type: 'text',
      required: true,
      admin: { description: 'Display date string, e.g. "Mar 2026".' },
    },
    {
      name: 'likes',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Like or upvote count. Set to 0 to hide the count.' },
    },
    {
      name: 'rating',
      type: 'number',
      admin: { description: 'Star rating 1–5. Only shown for Google reviews.' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar', description: 'Show as a large featured pull-quote card (always visible, not filterable).' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Include in the site social feed.' },
    },
    {
      name: 'sortRank',
      type: 'number',
      defaultValue: 999,
      admin: { position: 'sidebar', description: 'Lower number = shown first.' },
    },
  ],
  timestamps: true,
}

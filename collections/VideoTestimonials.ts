import type { CollectionConfig } from 'payload'

export const VideoTestimonials: CollectionConfig = {
  slug: 'video-testimonials',
  admin: {
    useAsTitle: 'caption',
    defaultColumns: ['caption', 'creator', 'platform', 'active', 'sortRank'],
    group: 'Content',
    description: 'Video testimonials shown in the "On video" homepage section.',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'caption',
      type: 'text',
      required: true,
      admin: { description: 'Short title for the video, e.g. "How to spot an overfilled lip".' },
    },
    {
      name: 'creator',
      type: 'text',
      required: true,
      admin: { description: 'Creator name and credentials, e.g. "Dr. Lena Park, MD".' },
    },
    {
      name: 'thumbnailUrl',
      type: 'text',
      required: true,
      admin: { description: 'URL to the video thumbnail image (9:16 aspect ratio recommended).' },
    },
    {
      name: 'href',
      type: 'text',
      required: true,
      admin: { description: 'External link to the video (Instagram, TikTok, or YouTube URL).' },
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      options: [
        { label: 'Instagram', value: 'instagram' },
        { label: 'TikTok', value: 'tiktok' },
        { label: 'YouTube', value: 'youtube' },
      ],
    },
    {
      name: 'duration',
      type: 'text',
      required: true,
      admin: { description: 'Display duration string, e.g. "0:47" or "1:02".' },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Show this video on the site.' },
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

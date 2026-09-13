import type { GlobalConfig } from 'payload'
import { revalidatePath } from 'next/cache'

/**
 * Sitewide FAQ switches. Hidden from the admin nav: edited from the "Settings"
 * panel on the FAQs screen, because every FAQ control lives there (founder
 * instruction, 2026-09-13). Read by lib/faqs/queries.ts, which falls back to the
 * defaults below when the row has never been saved.
 */
export const FaqSettings: GlobalConfig = {
  slug: 'faq-settings',
  label: 'FAQ settings',
  admin: { hidden: true },
  access: {
    read: () => true,
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
  },
  hooks: {
    // Every switch here changes what several page families render, so this is
    // the broad invalidation on purpose. Saves are rare.
    afterChange: [
      async () => {
        try {
          revalidatePath('/', 'layout')
        } catch {
          // Best effort. Pages still refresh on their own timer.
        }
      },
    ],
  },
  fields: [
    {
      name: 'hubEnabled',
      label: 'FAQ pages are live (/faq and /faq/<category>)',
      type: 'checkbox',
      defaultValue: true,
    },
    { name: 'hubTitle', type: 'text', defaultValue: 'Frequently Asked Questions' },
    {
      name: 'hubIntro',
      type: 'textarea',
      defaultValue: 'Straight answers to the questions people ask most about injectables, from what a treatment does to what it costs and what can go wrong.',
    },
    { name: 'hubMetaDescription', type: 'textarea' },
    {
      name: 'previewCount',
      label: 'Questions shown in each preview',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 20,
    },
    { name: 'showOnServicePages', type: 'checkbox', defaultValue: true },
    { name: 'showOnBrandPages', type: 'checkbox', defaultValue: true },
    { name: 'showOnGuidePages', type: 'checkbox', defaultValue: true },
    { name: 'showOnLocationPages', type: 'checkbox', defaultValue: true },
    {
      name: 'schemaEnabled',
      label: 'Emit FAQPage schema on category pages',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}

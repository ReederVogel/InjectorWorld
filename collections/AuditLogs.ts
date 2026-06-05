import type { CollectionConfig } from 'payload'

/**
 * Append-only audit trail of admin and API write actions.
 * Records are written by the audit hook (lib/audit-hook.ts) via the local API.
 * Nobody can create, edit, or delete entries through the admin UI — it is a
 * tamper-resistant log. Only admins can read it.
 */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  admin: {
    useAsTitle: 'summary',
    defaultColumns: ['action', 'collectionSlug', 'documentTitle', 'userEmail', 'createdAt'],
    group: 'System',
    description: 'Read-only history of every create, update, and delete on tracked collections.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'action',
      type: 'select',
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Delete', value: 'delete' },
      ],
      required: true,
    },
    { name: 'collectionSlug', type: 'text', required: true },
    { name: 'documentId', type: 'text' },
    { name: 'documentTitle', type: 'text' },
    { name: 'userEmail', type: 'text', admin: { description: 'Who performed the action, or "system" for automated/public writes.' } },
    { name: 'userId', type: 'text' },
    { name: 'summary', type: 'text' },
    { name: 'changedFields', type: 'json', admin: { description: 'Field names that changed (updates only).' } },
  ],
  timestamps: true,
}

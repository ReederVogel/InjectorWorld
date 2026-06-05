import type { CollectionConfig } from 'payload'

/**
 * Operational alerts surfaced to the admin dashboard: duplicates, broken
 * relationships, missing required trust fields, oversold slots, etc.
 *
 * Alerts are written by the import engine (lib/import) and the standalone
 * integrity scan (scripts/scan-data-alerts.ts) via the local API with
 * overrideAccess. They are upserted by `alertKey` so re-running a scan does
 * not create duplicate alerts. Admins read them, change status, and delete
 * resolved ones.
 */
export const DataAlerts: CollectionConfig = {
  slug: 'data-alerts',
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['severity', 'type', 'message', 'collectionSlug', 'status', 'updatedAt'],
    group: 'System',
    description: 'Data integrity and operational alerts. Resolve or acknowledge each one.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'alertKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Deterministic key so re-scans upsert instead of duplicating.' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Duplicate clinic', value: 'duplicate_clinic' },
        { label: 'Duplicate provider', value: 'duplicate_provider' },
        { label: 'Missing coordinates', value: 'missing_coordinates' },
        { label: 'Missing source URL', value: 'missing_source' },
        { label: 'Unknown treatment', value: 'unknown_treatment' },
        { label: 'Broken relationship', value: 'broken_relationship' },
        { label: 'Unmatched city', value: 'unmatched_city' },
        { label: 'Missing trust field', value: 'missing_trust_field' },
        { label: 'Oversold / orphaned promotion', value: 'orphaned_promotion' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'warning',
      options: [
        { label: 'Error', value: 'error' },
        { label: 'Warning', value: 'warning' },
        { label: 'Info', value: 'info' },
      ],
    },
    { name: 'message', type: 'text', required: true },
    { name: 'collectionSlug', type: 'text' },
    { name: 'documentId', type: 'text', admin: { description: 'Business id (e.g. providerId / clinicId) or DB id.' } },
    { name: 'relatedId', type: 'text', admin: { description: 'The other record involved (for duplicates / relationships).' } },
    { name: 'source', type: 'text', admin: { description: 'What raised it: "import" or "scan".' } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Acknowledged', value: 'acknowledged' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
  ],
  timestamps: true,
}

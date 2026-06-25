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
    // Write access matches read: admin/editor only. Import pipeline uses overrideAccess.
    create: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    update: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'alertKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Set by the import / scan automation so re-scans update instead of duplicating. Not hand-editable.',
      },
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
        { label: 'Invalid ZIP code', value: 'invalid_zip' },
        { label: 'Invalid coordinates', value: 'invalid_coordinates' },
        { label: 'Invalid phone number', value: 'invalid_phone' },
        { label: 'Duplicate NPI', value: 'duplicate_npi' },
        { label: 'Possible branch (review before merge)', value: 'possible_branch' },
        { label: 'Oversold / orphaned promotion', value: 'orphaned_promotion' },
        { label: 'Promotion missing provider', value: 'promo_missing_provider' },
        { label: 'Banner missing image', value: 'promo_missing_image' },
        { label: 'Expired promotion (auto-deactivated)', value: 'promo_expired' },
        { label: 'Promotion scope mismatch', value: 'promo_scope_mismatch' },
        { label: 'ZIP featuring request (provider self-serve)', value: 'zip_feature_request' },
        { label: 'Content: missing medical reviewer', value: 'content_missing_reviewer' },
        { label: 'Content: missing author', value: 'content_missing_author' },
        { label: 'Content: too few sources', value: 'content_few_sources' },
        { label: 'Content: missing cover image', value: 'content_missing_cover' },
        { label: 'Content: validation error', value: 'content_validation_error' },
        { label: 'Content: duplicate slug', value: 'content_duplicate_slug' },
        { label: 'Promotion expiring soon', value: 'promo_expiring_soon' },
        { label: 'Promotion slot exceeded', value: 'promo_slot_exceeded' },
        { label: 'New indexable page (auto-indexed)', value: 'new_indexable_page' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'warning',
      admin: { components: { Cell: '/components/admin/cells/SeverityCell#SeverityCell' } },
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
      admin: { components: { Cell: '/components/admin/cells/AlertStatusCell#AlertStatusCell' } },
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Acknowledged', value: 'acknowledged' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
  ],
  timestamps: true,
}

import type { CollectionConfig } from 'payload'

/**
 * One row per admin-triggered data export.
 *
 * Exports are too big to generate inside a single request: the clinics export is
 * ~37,000 rows x 31 columns and the app has OOM-crashed on this dataset before
 * (see docs/DECISIONS.md 2026-07-29). So an export is a *job*: the API creates a
 * row here, a background worker streams the file out in batches while updating
 * `processedRows`, and the admin UI polls this collection for progress and keeps
 * the finished files as history.
 *
 * Rows are written by the export API/worker with overrideAccess. Admins read them
 * and may delete old ones. Nothing here is hand-editable, so every field is
 * readOnly in the admin UI.
 */
export const ExportJobs: CollectionConfig = {
  slug: 'export-jobs',
  admin: {
    useAsTitle: 'fileName',
    defaultColumns: ['collectionSlug', 'status', 'processedRows', 'totalRows', 'createdAt'],
    group: 'Inbox',
    description: 'History and progress of admin data exports. Created automatically, not by hand.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin',
    create: () => false, // API only, via overrideAccess
    update: () => false, // worker only, via overrideAccess
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
    {
      name: 'collectionSlug',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Clinics', value: 'clinics' },
        { label: 'Guides', value: 'guides' },
        { label: 'News', value: 'news' },
        { label: 'FAQs', value: 'faqs' },
        { label: 'Brands', value: 'brands' },
        { label: 'Services', value: 'services' },
        { label: 'All (combined workbook)', value: 'all' },
      ],
      admin: { readOnly: true, description: 'Which collection this export covers.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      index: true,
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Running', value: 'running' },
        { label: 'Done', value: 'done' },
        { label: 'Failed', value: 'failed' },
        // Set by the stale-job reaper: the process died mid-run (deploy,
        // restart, OOM) so the job can never finish or report its own failure.
        { label: 'Abandoned', value: 'abandoned' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'filters',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'State / city / brand / service the export was scoped to. Empty means everything.',
      },
    },
    {
      name: 'filterSummary',
      type: 'text',
      admin: { readOnly: true, description: 'Human-readable version of the filters, for the history list.' },
    },
    {
      name: 'totalRows',
      type: 'number',
      admin: { readOnly: true, description: 'Counted up front so progress has a denominator.' },
    },
    {
      name: 'processedRows',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Updated once per batch while the job runs.' },
    },
    {
      name: 'fileName',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'fileUrl',
      type: 'text',
      admin: { readOnly: true, description: 'Download link. Empty until the job finishes.' },
    },
    {
      name: 'fileSizeBytes',
      type: 'number',
      admin: { readOnly: true },
    },
    {
      name: 'error',
      type: 'textarea',
      admin: { readOnly: true, description: 'Failure reason, if the job failed.' },
    },
    {
      name: 'startedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      name: 'finishedAt',
      type: 'date',
      admin: { readOnly: true },
    },
    {
      // Bumped every batch. A "running" job whose heartbeat is stale is one whose
      // process died; the reaper flips those to "abandoned" so the UI does not
      // show a progress bar that will never move again.
      name: 'heartbeatAt',
      type: 'date',
      index: true,
      admin: { readOnly: true },
    },
  ],
}

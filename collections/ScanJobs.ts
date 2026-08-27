import type { CollectionConfig } from 'payload'

/**
 * One row per page-index scan run.
 *
 * The scan used to run inline inside the admin's POST request. That worked while
 * `page_index` only held the ~52,800 computed listing pages and the scan only
 * ever touched rows that already existed. It stopped being viable once the
 * registry grew to cover every url: a full run now walks ~39,800 clinics, 100
 * guides, 125 news and 35 static routes on top of the computed set, roughly
 * 92,700 rows. That does not fit in one HTTP request against DO's proxy, and a
 * request that dies halfway leaves the registry half-written with no record of
 * how far it got.
 *
 * So a scan is a *job*, following the same shape as `export-jobs`
 * (see lib/exports/run-export.ts): the API creates a row here, returns 202
 * immediately, and a background worker updates `processedRows` and `phase` as it
 * goes while the admin UI polls.
 *
 * This row is also the mutex. Two concurrent scans would fight over the same
 * rows and the second one's "lost data" reconcile could un-publish urls the first
 * had just written, so the API refuses to start one while another is live.
 *
 * Written by the scan API/worker with overrideAccess. Nothing is hand-editable.
 */
export const ScanJobs: CollectionConfig = {
  slug: 'scan-jobs',
  labels: { singular: 'Scan run', plural: 'Scan runs' },
  admin: {
    useAsTitle: 'phase',
    defaultColumns: ['status', 'phase', 'processedRows', 'totalRows', 'createdAt'],
    group: 'SEO',
    description: 'History and live progress of url registry scans. Created automatically, not by hand.',
  },
  access: {
    read: ({ req }) => req.user?.role === 'admin' || req.user?.role === 'editor',
    create: () => false, // API only, via overrideAccess
    update: () => false, // worker only, via overrideAccess
    delete: ({ req }) => req.user?.role === 'admin',
  },
  fields: [
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
        // Set by the stale-job reaper: the process died mid-run (deploy, restart,
        // OOM) so the job can never finish or report its own failure.
        { label: 'Abandoned', value: 'abandoned' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'phase',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Which stage the run is in. A full scan has several, and the slow one is the upsert.',
      },
    },
    {
      name: 'trigger',
      type: 'select',
      defaultValue: 'admin',
      options: [
        { label: 'Admin button', value: 'admin' },
        { label: 'Command line', value: 'cli' },
      ],
      admin: { readOnly: true },
    },

    // ── Progress ─────────────────────────────────────────────────────────────
    {
      name: 'totalRows',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Urls the scan intends to write. Only known once the build phase finishes, so it is empty at first.',
      },
    },
    {
      name: 'processedRows',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true, description: 'Updated every few batches while the job runs.' },
    },

    // ── Outcome ──────────────────────────────────────────────────────────────
    { name: 'createdRows', type: 'number', admin: { readOnly: true, description: 'Urls seen for the first time.' } },
    { name: 'updatedRows', type: 'number', admin: { readOnly: true, description: 'Urls that already existed and were refreshed.' } },
    {
      name: 'lostDataRows',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Urls that no longer have anything to show, so they dropped out of the sitemap. Their indexing decision is preserved.',
      },
    },
    {
      name: 'failedRows',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Rows that could not be written. Any failure here SKIPS the lost-data reconcile, because a failed batch is indistinguishable from a url that vanished.',
      },
    },
    {
      name: 'unmappedClinics',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Published clinics whose city and state match no Location, so no url could be built for them.',
      },
    },
    {
      name: 'bySource',
      type: 'json',
      admin: { readOnly: true, description: 'How many urls each source contributed. A source at zero means it produced nothing.' },
    },
    { name: 'indexedNow', type: 'number', admin: { readOnly: true, description: 'Urls in the sitemap after this run.' } },
    { name: 'queuedNow', type: 'number', admin: { readOnly: true, description: 'Urls waiting for a batch after this run.' } },
    {
      name: 'marketsFlippedLive',
      type: 'number',
      admin: { readOnly: true, description: 'Markets that went from Coming Soon to a real directory. Liveness is automatic; indexing is not.' },
    },
    { name: 'marketsFlippedComingSoon', type: 'number', admin: { readOnly: true } },

    { name: 'error', type: 'textarea', admin: { readOnly: true, description: 'Failure reason, if the job failed.' } },

    // ── Timing ───────────────────────────────────────────────────────────────
    { name: 'startedBy', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'startedAt', type: 'date', admin: { readOnly: true } },
    { name: 'finishedAt', type: 'date', admin: { readOnly: true } },
    {
      // Bumped every few batches. A "running" job whose heartbeat is stale is one
      // whose process died; the reaper flips those to "abandoned" so the UI never
      // shows a progress bar that will not move again.
      name: 'heartbeatAt',
      type: 'date',
      index: true,
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}

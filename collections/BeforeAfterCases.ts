import type { CollectionAfterDeleteHook, CollectionConfig, Where } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { revalidateAfterChange, revalidateAfterDelete } from '../lib/revalidate-hook'

const isStaff = (role?: string | null) => role === 'admin' || role === 'editor'
const PUBLIC_CASES: Where = { and: [{ status: { equals: 'approved' } }, { consentGranted: { equals: true } }] }

/** A case's two photos are its own uploads: they go with it. */
const deleteCasePhotos: CollectionAfterDeleteHook = async ({ doc, req }) => {
  for (const photo of [doc?.beforePhoto, doc?.afterPhoto]) {
    const id = photo && typeof photo === 'object' ? photo.id : photo
    if (id) await req.payload.delete({ collection: 'media', id, overrideAccess: true, req }).catch(() => {})
  }
  return doc
}

/**
 * Before and after photo pairs. Clinic owners on Pro and Elite add them from the
 * dashboard (POST /api/dashboard/before-after, overrideAccess after the ownership,
 * plan and consent checks); every one waits here as "Pending review" until staff
 * approve it. The clinic page shows only approved cases with consent, and only
 * while the clinic's paid plan is active.
 */
export const BeforeAfterCases: CollectionConfig = {
  slug: 'before-after-cases',
  admin: {
    useAsTitle: 'caseTitle',
    defaultColumns: ['caseTitle', 'clinic', 'status', 'beforePhoto', 'afterPhoto', 'createdAt'],
    listSearchableFields: ['caseTitle', 'serviceTag'],
    group: 'Inbox',
    description:
      'Before and after photos sent by clinic owners. Check both photos are real, unedited, the same patient and show no face or body detail that should not be public, then set Status to Approved.',
  },
  access: {
    // Public REST reads see only what the clinic page shows; staff see everything.
    read: ({ req: { user } }) => (isStaff(user?.role) ? true : PUBLIC_CASES),
    create: ({ req: { user } }) => isStaff(user?.role),
    update: ({ req: { user } }) => isStaff(user?.role),
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'caseTitle', type: 'text', required: true },
    { name: 'beforePhotoUrl', type: 'text', required: true },
    { name: 'afterPhotoUrl', type: 'text', required: true },
    { name: 'serviceTag', type: 'text', required: true, admin: { description: 'Botox, Lip Filler, etc.' } },
    { name: 'weeksPost', type: 'number', required: true, admin: { description: 'Weeks between before and after.' } },
    { name: 'city', type: 'text' },
    { name: 'state', type: 'text', maxLength: 2 },
    { name: 'patientNote', type: 'textarea', admin: { description: 'Shown under the photos.' } },
    { name: 'consentGranted', type: 'checkbox', required: true, defaultValue: false },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    { name: 'sortRank', type: 'number', defaultValue: 999 },
    // Added 2026-11-26 (owner uploads). Not required: NOT NULL + ON DELETE SET NULL would block clinic deletes.
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Not approved', value: 'rejected' },
      ],
      admin: { position: 'sidebar', description: 'Only Approved cases show on the clinic page.' },
    },
    { name: 'beforePhoto', type: 'upload', relationTo: 'media', admin: { description: 'The owner upload behind beforePhotoUrl.' } },
    { name: 'afterPhoto', type: 'upload', relationTo: 'media', admin: { description: 'The owner upload behind afterPhotoUrl.' } },
  ],
  hooks: {
    afterChange: [auditAfterChange, revalidateAfterChange],
    afterDelete: [auditAfterDelete, deleteCasePhotos, revalidateAfterDelete],
  },
  timestamps: true,
}

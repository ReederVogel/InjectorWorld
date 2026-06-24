import crypto from 'crypto'
import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'

const approveClaimHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only fire when status transitions to 'approved' for the first time
  if (doc.status !== 'approved') return doc
  if (previousDoc?.status === 'approved') return doc

  try {
    const { claimantEmail, claimantName, claimType } = doc
    const rawTarget = claimType === 'provider' ? doc.targetProvider : doc.targetClinic
    const targetId: number | null =
      rawTarget == null ? null
      : typeof rawTarget === 'object' ? rawTarget.id
      : rawTarget

    if (!claimantEmail || !targetId) {
      req.payload.logger.warn('[claims] approveClaimHook: missing email or targetId')
      return doc
    }

    let userId: number | null = null

    // Find existing user by email
    const found = await req.payload.find({
      collection: 'users',
      where: { email: { equals: claimantEmail } },
      limit: 1,
      overrideAccess: true,
    })

    const updateData: Record<string, unknown> = { role: 'provider' }
    if (claimType === 'provider') updateData.linkedProvider = targetId
    else updateData.linkedClinic = targetId

    if (found.docs.length > 0) {
      const existing = found.docs[0] as any
      userId = existing.id
      await req.payload.update({
        collection: 'users',
        id: userId!,
        data: updateData as any,
        overrideAccess: true,
      })
    } else {
      // Create a user with a temporary password (admin must share credentials)
      const tempPwd = crypto.randomBytes(16).toString('base64url') + 'Aa1!'
      const setupToken = crypto.randomBytes(32).toString('hex')
      const createData: Record<string, unknown> = {
        name: claimantName || claimantEmail,
        email: claimantEmail,
        password: tempPwd,
        setupToken,
        setupTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        ...updateData,
      }
      const created = await req.payload.create({
        collection: 'users',
        data: createData as any,
        overrideAccess: true,
      })
      userId = created.id
      console.log('[CLAIM APPROVED] Setup link: /setup-account?token=' + setupToken)
    }

    // Mark the target profile as claimed
    const targetCollection = claimType === 'provider' ? 'providers' : 'clinics'
    await req.payload.update({
      collection: targetCollection,
      id: targetId,
      data: { claimed: true, claimedBy: userId! },
      overrideAccess: true,
    })

    req.payload.logger.info(
      `[claims] approved: ${claimType} ${targetId} claimed by user ${userId} (${claimantEmail})`,
    )
  } catch (err) {
    req.payload.logger.error(`[claims] approveClaimHook error: ${err}`)
  }

  return doc
}

export const Claims: CollectionConfig = {
  slug: 'claims',
  admin: {
    useAsTitle: 'claimantEmail',
    defaultColumns: ['claimantEmail', 'claimType', 'status', 'waiting', 'createdAt'],
    group: 'Users & Ops',
    description: 'Provider and clinic profile claims awaiting review. Approving a claim promotes the claimant to a provider account and marks the profile claimed.',
  },
  access: {
    // Public claim submission goes through /api/claims (rate-limited, overrideAccess).
    // Block the raw REST endpoint so it can't be spammed directly, bypassing the limit.
    create: () => false,
    read: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    update: ({ req: { user } }) => !!(user && (user.role === 'admin' || user.role === 'editor')),
    delete: ({ req: { user } }) => !!(user && user.role === 'admin'),
  },
  fields: [
    {
      name: 'claimType',
      type: 'select',
      required: true,
      options: [
        { label: 'Provider', value: 'provider' },
        { label: 'Clinic', value: 'clinic' },
      ],
    },
    {
      name: 'targetProvider',
      type: 'relationship',
      relationTo: 'providers',
      admin: {
        condition: (data) => data?.claimType === 'provider',
        description: 'The provider profile being claimed.',
      },
    },
    {
      name: 'targetClinic',
      type: 'relationship',
      relationTo: 'clinics',
      admin: {
        condition: (data) => data?.claimType === 'clinic',
        description: 'The clinic profile being claimed.',
      },
    },
    { name: 'claimantName', type: 'text', required: true },
    { name: 'claimantEmail', type: 'email', required: true, index: true },
    { name: 'claimantPhone', type: 'text' },
    {
      name: 'roleAtPractice',
      type: 'text',
      required: true,
      admin: { description: 'e.g. Owner, Medical Director, Lead Injector' },
    },
    {
      name: 'licenseNumber',
      type: 'text',
      admin: { description: 'Required for provider claims.' },
    },
    {
      name: 'npiNumber',
      type: 'text',
      admin: { description: 'Optional NPI for provider claims.' },
    },
    {
      name: 'businessProof',
      type: 'text',
      admin: { description: 'Website, LLC docs, or other proof for clinic claims.' },
    },
    {
      name: 'message',
      type: 'textarea',
      admin: { description: 'Any additional context from the claimant.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      admin: { components: { Cell: '/components/admin/cells/ClaimStatusCell#ClaimStatusCell' } },
      // Only admins/editors can set or change status — prevents REST API hijack
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      options: [
        { label: 'New', value: 'new' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    {
      name: 'reviewedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Admin who reviewed this claim.' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Internal notes visible only to admins.' },
    },
    {
      name: 'waiting',
      type: 'ui',
      admin: {
        components: {
          Cell: '/components/admin/cells/WaitingCell#WaitingCell',
        },
      },
    },
  ],
  hooks: {
    afterChange: [approveClaimHook, auditAfterChange],
    afterDelete: [auditAfterDelete],
  },
  timestamps: true,
}

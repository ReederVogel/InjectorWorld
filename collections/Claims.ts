import crypto from 'crypto'
import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { auditAfterChange, auditAfterDelete } from '../lib/audit-hook'
import { sendTransactional, claimApprovedEmail } from '../lib/email-templates'

const approveClaimHook: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only fire when status transitions to 'approved' for the first time
  if (doc.status !== 'approved') return doc
  if (previousDoc?.status === 'approved') return doc

  try {
    const { claimantName, claimType } = doc
    // Normalize defensively: Payload stores auth emails lowercased, so a claim
    // captured with different casing must be lowered here or the users lookup
    // below misses the real account and tries to create a duplicate (which then
    // throws on the unique constraint and silently aborts the whole approval).
    const claimantEmail = String(doc.claimantEmail || '').toLowerCase().trim()
    const rawTarget = claimType === 'provider' ? doc.targetProvider : doc.targetClinic
    const targetId: number | null =
      rawTarget == null ? null
      : typeof rawTarget === 'object' ? rawTarget.id
      : rawTarget

    if (!claimantEmail || !targetId) {
      req.payload.logger.warn('[claims] approveClaimHook: missing email or targetId')
      return doc
    }

    // Collected here and written to reviewNotes once at the end, so an admin
    // reviewing this claim sees any anomaly without digging through server logs.
    const systemNotes: string[] = []

    async function flushSystemNotes() {
      if (systemNotes.length === 0) return
      try {
        const stamp = new Date().toISOString()
        const existingNotes = typeof doc.reviewNotes === 'string' ? doc.reviewNotes : ''
        const appended = systemNotes.map((n) => `[SYSTEM ${stamp}] ${n}`).join('\n')
        await req.payload.update({
          collection: 'claims',
          id: doc.id,
          data: { reviewNotes: existingNotes ? `${existingNotes}\n\n${appended}` : appended },
          overrideAccess: true,
        })
      } catch (noteErr) {
        req.payload.logger.error(`[claims] failed to record system note: ${noteErr}`)
      }
    }

    // Two pending claims can both target the same unclaimed profile (the
    // public submission API only blocks NEW submissions once claimed=true,
    // which isn't set until the FIRST one is approved). If an admin approves
    // both, this guard stops the second approval from silently stealing
    // dashboard access from the first owner — it never touches the target
    // or creates/links a user, it just flags the claim for manual review.
    const targetCollection = claimType === 'provider' ? 'providers' : 'clinics'
    const target = await req.payload.findByID({
      collection: targetCollection,
      id: targetId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null) as any

    if (!target) {
      req.payload.logger.warn(`[claims] approveClaimHook: target ${targetCollection}/${targetId} not found`)
      systemNotes.push(`The ${claimType} profile (ID ${targetId}) this claim points to no longer exists. Nothing was linked.`)
      await flushSystemNotes()
      return doc
    }

    if (target.claimed) {
      req.payload.logger.warn(
        `[claims] approveClaimHook: ${targetCollection}/${targetId} is already claimed — skipping approval side effects for claim ${doc.id}`,
      )
      systemNotes.push(
        `This ${claimType} was already claimed (likely a different claim for the same profile was approved first). ` +
        `To prevent silently taking over the existing owner's dashboard access, no account was created or linked and no ` +
        `email was sent for this approval. If this claim is legitimate, reject it and ask ${claimantEmail} to contact ` +
        `support, or resolve the conflict manually.`,
      )
      await flushSystemNotes()
      return doc
    }

    // Risk signal: there IS a contact on file for this profile and the claimant
    // email does not match it, and they never confirmed their inbox by code.
    // That is exactly the shape of someone claiming a profile they don't own,
    // so surface it. ('unknown' — no contact on file — is not suspicious on its
    // own, so it stays quiet to avoid alert fatigue.)
    if (!doc.emailVerified && doc.emailMatch === 'none') {
      systemNotes.push(
        `Heads up: this claim's email was not confirmed by code and does not match the profile's ` +
        `on-file contact. You approved on manual judgment alone — make sure ${claimantEmail} genuinely ` +
        `belongs to the owner.`,
      )
    }

    let userId: number | null = null

    // Find existing user by email
    const found = await req.payload.find({
      collection: 'users',
      where: { email: { equals: claimantEmail } },
      limit: 1,
      overrideAccess: true,
    })

    const linkField = claimType === 'provider' ? 'linkedProvider' : 'linkedClinic'
    const updateData: Record<string, unknown> = { role: claimType === 'provider' ? 'provider' : 'clinic' }
    updateData[linkField] = targetId

    if (found.docs.length > 0) {
      const existing = found.docs[0] as any
      userId = existing.id

      // This email already had a plain customer (patient) account. Approving
      // promotes it to an owner account with dashboard access to this profile.
      // That is legitimate when the real owner happened to sign up as a patient
      // first, but it changes an existing account without their re-consent, so
      // flag it so an admin can confirm the address genuinely belongs to them.
      if (existing.role === 'user') {
        systemNotes.push(
          `The email ${claimantEmail} already had a customer account. Approving promoted it to a ` +
          `${claimType === 'provider' ? 'provider' : 'clinic'} owner account and linked this profile. ` +
          `Confirm this address really belongs to the profile owner — a patient account should not become ` +
          `an owner unless they truly own it.`,
        )
      }

      // This account already has a DIFFERENT profile linked (e.g. an owner who
      // already claimed one clinic is now approved for a second). Users.linkedClinic
      // / linkedProvider is a single relationship, not a list — overwriting it would
      // silently cut off their dashboard access to the profile they already have.
      // Leave the existing link untouched and flag it for manual admin follow-up
      // instead. The new profile is still marked claimed/claimedBy below either way.
      const existingLinkRaw = existing[linkField]
      const existingLinkId = existingLinkRaw == null
        ? null
        : typeof existingLinkRaw === 'object' ? existingLinkRaw.id : existingLinkRaw
      const hasConflict = existingLinkId != null && String(existingLinkId) !== String(targetId)

      if (hasConflict) {
        delete updateData[linkField]
        systemNotes.push(
          `This account (${claimantEmail}) already has a different ${claimType} profile linked ` +
          `(ID ${existingLinkId}). The dashboard only supports one linked ${claimType} per account, ` +
          `so the new profile was marked claimed but NOT auto-linked — their existing dashboard access ` +
          `was left untouched. An admin must decide how to give them access to this profile.`,
        )
      }

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

    // Mark the target profile as claimed (already confirmed unclaimed above)
    const targetName = target.fullName || target.clinicName || `${claimType} #${targetId}`
    await req.payload.update({
      collection: targetCollection,
      id: targetId,
      data: { claimed: true, claimedBy: userId! },
      overrideAccess: true,
    })

    req.payload.logger.info(
      `[claims] approved: ${claimType} ${targetId} claimed by user ${userId} (${claimantEmail})`,
    )

    // Close the outreach loop: any invite pointing at this clinic is now converted
    if (claimType === 'clinic') {
      try {
        const invites = await req.payload.find({
          collection: 'claim-invites',
          where: { targetClinic: { equals: targetId } },
          limit: 20,
          depth: 0,
          overrideAccess: true,
        })
        for (const inv of invites.docs) {
          await req.payload.update({
            collection: 'claim-invites',
            id: inv.id,
            data: { status: 'claimed' },
            overrideAccess: true,
          })
        }
      } catch (invErr) {
        req.payload.logger.error(`[claims] invite status update failed: ${invErr}`)
      }
    }

    // Notify the claimant (non-blocking)
    const isExistingUser = found.docs.length > 0

    try {
      let resolvedSetupToken: string | null = null
      if (!isExistingUser && userId) {
        const u = await req.payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true }) as any
        resolvedSetupToken = u?.setupToken || null
      }
      // sendTransactional never throws — it returns { delivered, mode, error }
      // even when Resend rejects the send. This is the one email in the whole
      // claim flow that actually gets the owner into their account, so a
      // failure here must be visible on the claim, not just in server logs.
      const result = await sendTransactional({
        to: claimantEmail,
        subject: 'Your injector.world claim has been approved',
        ...claimApprovedEmail({
          claimantName: claimantName || claimantEmail,
          claimType,
          targetName,
          setupToken: resolvedSetupToken,
          isExistingUser,
        }),
        tag: 'claim-approved',
      })

      if (!result.delivered) {
        const reason = result.mode === 'console'
          ? 'RESEND_API_KEY is not configured on this environment — the email was only logged to the server console, never sent.'
          : `Resend rejected the send: ${result.error ?? 'unknown error'}`
        req.payload.logger.error(`[claims] approved email to ${claimantEmail} did NOT deliver: ${reason}`)
        systemNotes.push(
          `The approval email to ${claimantEmail} did not deliver (${reason}). ` +
          `The owner likely has no way to access their account yet — resend manually or contact them directly.`,
        )
      }
    } catch (emailErr) {
      req.payload.logger.error(`[claims] approved email threw unexpectedly: ${emailErr}`)
      systemNotes.push(`Sending the approval email threw an unexpected error: ${emailErr}. The owner may not have been notified.`)
    }

    // Surface any anomaly directly on the claim so admins see it without
    // reading server logs. Appended, never overwrites an admin's own notes.
    // Safe to call from inside this same afterChange hook: the recursive
    // afterChange run sees previousDoc.status already 'approved' and exits
    // immediately via the guard at the top, so this cannot loop.
    await flushSystemNotes()
  } catch (err) {
    req.payload.logger.error(`[claims] approveClaimHook error: ${err}`)
  }

  return doc
}

export const Claims: CollectionConfig = {
  slug: 'claims',
  admin: {
    useAsTitle: 'claimantEmail',
    defaultColumns: ['claimantEmail', 'claimType', 'emailMatch', 'emailVerified', 'status', 'waiting', 'createdAt'],
    group: 'Inbox',
    description: 'Provider and clinic profile claims awaiting review. Approving a claim promotes the claimant to a provider account and marks the profile claimed.',
    components: {
      beforeList: [
        '/components/admin/list-headers/ClaimsListHeader#ClaimsListHeader',
        '/components/admin/ClaimsControlCenter#ClaimsControlCenter',
      ],
    },
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
      // Set true once the claimant confirms the 6-digit code emailed to their
      // address (POST /api/claims/verify). False means they never proved they
      // control that inbox — approve only after manual verification.
      name: 'emailVerified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'True once the claimant confirmed the code we emailed. If false, they never proved they own this inbox — verify manually before approving.',
      },
    },
    {
      // Computed at submission: does the claimant email line up with the
      // profile's on-file contact? Purely an admin signal, never a hard block.
      name: 'emailMatch',
      type: 'select',
      defaultValue: 'unknown',
      admin: {
        readOnly: true,
        description: 'exact = same email on file, domain = same website/email domain, none = no match (extra caution), unknown = no contact on file to compare.',
      },
      options: [
        { label: 'Exact match', value: 'exact' },
        { label: 'Domain match', value: 'domain' },
        { label: 'No match', value: 'none' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'verificationCode',
      type: 'text',
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'verificationCodeExpiry',
      type: 'date',
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'verifyToken',
      type: 'text',
      index: true,
      admin: { readOnly: true, hidden: true },
    },
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

import type { CollectionConfig } from 'payload'
import { emailShell, primaryButton } from '../lib/email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 60 * 60 * 24 * 7,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    forgotPassword: {
      generateEmailSubject: () => 'Reset your injector.world password',
      generateEmailHTML: (args) => {
        const token = (args as { token?: string } | undefined)?.token ?? ''
        const url = `${SITE_URL}/reset-password?token=${token}`
        return emailShell({
          siteUrl: SITE_URL,
          heading: 'Reset your password',
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
              We received a request to reset the password for your injector.world account.
              Click the button below to choose a new one. This link expires in one hour.
            </p>
            <p style="margin:0 0 22px;">${primaryButton(url, 'Reset password')}</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
              If you did not request this, you can safely ignore this email and your password stays the same.
            </p>`,
        })
      },
    },
  },
  admin: {
    useAsTitle: 'email',
    group: 'Access',
    description: 'Staff, provider, and patient accounts. Role controls access; only admins and editors can change a role.',
  },
  access: {
    // Only staff may open the /admin panel. Providers use the frontend /dashboard,
    // patients have no admin access at all.
    admin: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    // Users can read their own record; staff can read all. Prevents account enumeration.
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin' || user.role === 'editor') return true
      return { id: { equals: user.id } }
    },
    // New accounts are created via the claim-approval hook (overrideAccess) or by admin.
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'editor',
    // Users can update their own record (e.g. name, quiz result); admins can update all.
    update: ({ req, id }) => {
      if (!req.user) return false
      if (req.user.role === 'admin' || req.user.role === 'editor') return true
      return String(req.user.id) === String(id)
    },
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    { name: 'name', type: 'text' },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'patient',
      // Only admins/editors can assign or change roles — prevents self-promotion to admin
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Provider', value: 'provider' },
        { label: 'Patient', value: 'patient' },
      ],
    },
    {
      name: 'linkedProvider',
      type: 'relationship',
      relationTo: 'providers',
      // Only admins/editors can link provider profiles (set during claim approval via overrideAccess)
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      admin: { description: 'Set on claim approval. The provider profile this user can edit.' },
    },
    {
      name: 'linkedClinic',
      type: 'relationship',
      relationTo: 'clinics',
      // Only admins/editors can link clinic profiles (set during claim approval via overrideAccess)
      access: {
        create: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
        update: ({ req }) => !!(req.user?.role === 'admin' || req.user?.role === 'editor'),
      },
      admin: { description: 'Set on claim approval. The clinic profile this user can edit.' },
    },
    {
      name: 'savedProviders',
      type: 'relationship',
      relationTo: 'providers',
      hasMany: true,
      admin: { description: 'Providers this patient saved from the directory. Editable by the patient on /profile.' },
    },
    {
      name: 'savedClinics',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: true,
      admin: { description: 'Clinics this patient saved from the directory. Editable by the patient on /profile.' },
    },
    {
      name: 'quizRecommendation',
      type: 'text',
      admin: {
        description: 'Treatment slug saved from the candidate quiz, surfaced as "recommended for you" on /profile. Not medical advice.',
      },
    },
    {
      name: 'setupToken',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      name: 'setupTokenExpiry',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
}

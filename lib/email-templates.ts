/**
 * Transactional email templates for all non-newsletter flows.
 *
 * Each function returns { html, text } ready for sendTransactional().
 * All dynamic content is HTML-escaped before insertion.
 *
 * Env vars used:
 *   RESEND_API_KEY       — if absent, logs to console (dev fallback)
 *   RESEND_FROM          — from address (default bookings@injector.world)
 *   ADMIN_EMAIL          — admin notification target
 *   FOUNDER_EMAIL        — founder copy on critical notifications
 *   NEXT_PUBLIC_SITE_URL — used in CTA links
 */

import { emailShell, primaryButton } from './email'

export const RESEND_FROM = process.env.RESEND_FROM || 'bookings@injector.world'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@injector.world'
export const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || ''
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string): string {
  if (!value) return ''
  return `<tr><td style="padding:3px 12px 3px 0;font-size:14px;color:#94A3B8;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font-size:14px;color:#0B1B34;">${esc(value)}</td></tr>`
}

function table(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;border-collapse:collapse;">${rows}</table>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">${text}</p>`
}

// ---------------------------------------------------------------------------
// Shared send helper (Resend → console fallback)
// ---------------------------------------------------------------------------
export async function sendTransactional(opts: {
  to: string | string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text: string
  tag?: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  const tag = opts.tag || 'tx'
  const toStr = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to

  if (!key) {
    console.log(`[email:console][${tag}] to="${toStr}" subject="${opts.subject}"`)
    if (opts.replyTo) console.log(`[email:console][${tag}] replyTo="${opts.replyTo}"`)
    console.log(`[email:console][${tag}] text:\n${opts.text.slice(0, 400)}`)
    return
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)
    await resend.emails.send({
      from: opts.from || RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    } as Parameters<InstanceType<typeof Resend>['emails']['send']>[0])
  } catch (err) {
    console.error(`[email:resend][${tag}] failed to "${toStr}":`, (err as Error)?.message)
  }
}

// ---------------------------------------------------------------------------
// Admin recipient list (admin + founder, deduped, non-empty)
// ---------------------------------------------------------------------------
export function adminRecipients(): string[] {
  const addrs = [ADMIN_EMAIL, FOUNDER_EMAIL].filter(Boolean)
  return [...new Set(addrs)]
}

// ---------------------------------------------------------------------------
// 1. Booking — patient confirmation
// ---------------------------------------------------------------------------
export function bookingPatientEmail(opts: {
  patientFirstName: string
  providerName: string
  clinicName: string
  treatmentTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { patientFirstName, providerName, clinicName, treatmentTag, preferredDate, message } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const bodyHtml = `
    ${p(`Hi ${esc(patientFirstName)},`)}
    ${p('Your consultation request has been received. Here is a summary:')}
    ${table([
      row('Provider', providerName),
      clinicName ? row('Practice', clinicName) : '',
      treatmentTag ? row('Treatment', treatmentTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Your message', message) : '',
    ].join(''))}
    ${p(`${esc(providerName.split(' ')[0] || providerName)} will be in touch within 24 hours.`)}
    <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#94A3B8;">
      This is not a confirmed appointment. Please wait for the provider to contact you.
    </p>
  `

  const text = `Hi ${patientFirstName},\n\nYour consultation request has been received.\n\nProvider: ${providerName}\n${clinicName ? `Practice: ${clinicName}\n` : ''}${treatmentTag ? `Treatment: ${treatmentTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nYour message:\n${message}\n` : ''}\n${providerName.split(' ')[0] || providerName} will be in touch within 24 hours.\n\nThis is not a confirmed appointment.\n\ninjector.world\n${SITE_URL}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Consultation request received', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 2. Booking — provider new lead
// ---------------------------------------------------------------------------
export function bookingProviderEmail(opts: {
  providerFirstName: string
  patientName: string
  patientEmail: string
  patientPhone: string
  treatmentTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { providerFirstName, patientName, patientEmail, patientPhone, treatmentTag, preferredDate, message, bookingId } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const bodyHtml = `
    ${p(`Hi ${esc(providerFirstName)},`)}
    ${p('You have a new consultation request through injector.world.')}
    ${table([
      row('Patient', patientName),
      row('Email', patientEmail),
      patientPhone ? row('Phone', patientPhone) : '',
      treatmentTag ? row('Treatment', treatmentTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(`${SITE_URL}/dashboard/provider`, 'View in your dashboard')}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
      Booking ID: ${esc(String(bookingId))}
    </p>
  `

  const text = `Hi ${providerFirstName},\n\nYou have a new consultation request.\n\nPatient: ${patientName}\nEmail: ${patientEmail}\n${patientPhone ? `Phone: ${patientPhone}\n` : ''}${treatmentTag ? `Treatment: ${treatmentTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nView in your dashboard: ${SITE_URL}/dashboard/provider\n\nBooking ID: ${bookingId}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'New consultation request', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 3. Booking — admin notification
// ---------------------------------------------------------------------------
export function bookingAdminEmail(opts: {
  patientName: string
  patientEmail: string
  patientPhone: string
  providerName: string
  clinicName: string
  treatmentTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { patientName, patientEmail, patientPhone, providerName, clinicName, treatmentTag, preferredDate, message, bookingId } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const adminLink = `${SITE_URL}/admin/collections/bookings/${bookingId}`

  const bodyHtml = `
    ${p(`New booking #${esc(String(bookingId))} submitted.`)}
    ${table([
      row('Patient', patientName),
      row('Email', patientEmail),
      patientPhone ? row('Phone', patientPhone) : '',
      row('Provider', providerName),
      clinicName ? row('Practice', clinicName) : '',
      treatmentTag ? row('Treatment', treatmentTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'View in admin')}</p>
  `

  const text = `New booking #${bookingId}\n\nPatient: ${patientName}\nEmail: ${patientEmail}\n${patientPhone ? `Phone: ${patientPhone}\n` : ''}Provider: ${providerName}\n${clinicName ? `Practice: ${clinicName}\n` : ''}${treatmentTag ? `Treatment: ${treatmentTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nView in admin: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New booking: ${patientName} for ${providerName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 4. Claim — admin notification
// ---------------------------------------------------------------------------
export function claimAdminEmail(opts: {
  claimantName: string
  claimantEmail: string
  claimantPhone: string
  claimType: string
  targetName: string
  roleAtPractice: string
  licenseNumber: string
  npiNumber: string
  message: string
  claimId: string | number
}): { html: string; text: string } {
  const { claimantName, claimantEmail, claimantPhone, claimType, targetName, roleAtPractice, licenseNumber, npiNumber, message, claimId } = opts
  const adminLink = `${SITE_URL}/admin/collections/claims/${claimId}`

  const bodyHtml = `
    ${p(`A new profile claim has been submitted for review.`)}
    ${table([
      row('Claimant', claimantName),
      row('Email', claimantEmail),
      claimantPhone ? row('Phone', claimantPhone) : '',
      row('Claim type', claimType),
      row('Profile', targetName),
      row('Role', roleAtPractice),
      licenseNumber ? row('License', licenseNumber) : '',
      npiNumber ? row('NPI', npiNumber) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'Review in admin')}</p>
  `

  const text = `New ${claimType} claim for "${targetName}"\n\nClaimant: ${claimantName}\nEmail: ${claimantEmail}\n${claimantPhone ? `Phone: ${claimantPhone}\n` : ''}Role: ${roleAtPractice}\n${licenseNumber ? `License: ${licenseNumber}\n` : ''}${npiNumber ? `NPI: ${npiNumber}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nReview: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New ${claimType} claim: ${targetName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 5. Claim approved — claimant notification
// ---------------------------------------------------------------------------
export function claimApprovedEmail(opts: {
  claimantName: string
  claimType: string
  targetName: string
  setupToken?: string | null
  isExistingUser: boolean
}): { html: string; text: string } {
  const { claimantName, claimType, targetName, setupToken, isExistingUser } = opts
  const firstName = claimantName.split(' ')[0] || claimantName
  const dashboardUrl = claimType === 'clinic' ? `${SITE_URL}/dashboard/clinic` : `${SITE_URL}/dashboard/provider`
  const setupUrl = setupToken ? `${SITE_URL}/setup-account?token=${setupToken}` : dashboardUrl
  const ctaUrl = isExistingUser ? dashboardUrl : setupUrl
  const ctaLabel = isExistingUser ? 'Go to your dashboard' : 'Set up your account'

  const bodyHtml = `
    ${p(`Hi ${esc(firstName)},`)}
    ${p(`Great news: your claim for <strong>${esc(targetName)}</strong> has been approved. Your profile is now under your control.`)}
    ${!isExistingUser ? `
      ${p('We have created an account for you. Click below to set your password and sign in.')}
      <p style="margin:0 0 14px;font-size:13px;color:#94A3B8;">This setup link expires in 7 days.</p>
    ` : `
      ${p('Sign in to your dashboard to update your profile, respond to consultation requests, and manage your listing.')}
    `}
    <p style="margin:0 0 20px;">${primaryButton(ctaUrl, ctaLabel)}</p>
    ${p('If you have questions, reply to this email.')}
  `

  const text = `Hi ${firstName},\n\nYour claim for "${targetName}" has been approved.\n\n${!isExistingUser ? `Set up your account: ${ctaUrl}\n\nThis link expires in 7 days.\n` : `Sign in to your dashboard: ${ctaUrl}\n`}\nQuestions? Reply to this email.\n\ninjector.world`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Your claim has been approved', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 6. Register — admin notification (provider / clinic application)
// ---------------------------------------------------------------------------
export function registerAdminEmail(opts: {
  applicantName: string
  applicantEmail: string
  role: string
  licenseState?: string
  licenseNumber?: string
  clinicName?: string
}): { html: string; text: string } {
  const { applicantName, applicantEmail, role, licenseState, licenseNumber, clinicName } = opts
  const adminLink = `${SITE_URL}/admin/collections/users`

  const bodyHtml = `
    ${p('A new provider or clinic application has been submitted.')}
    ${table([
      row('Name', applicantName),
      row('Email', applicantEmail),
      row('Role', role),
      licenseState && licenseNumber ? row('License', `${licenseState} ${licenseNumber}`) : '',
      clinicName ? row('Clinic', clinicName) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'Review in admin')}</p>
  `

  const text = `New ${role} application\n\nName: ${applicantName}\nEmail: ${applicantEmail}\nRole: ${role}\n${licenseState && licenseNumber ? `License: ${licenseState} ${licenseNumber}\n` : ''}${clinicName ? `Clinic: ${clinicName}\n` : ''}\nReview: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New ${role} application: ${applicantName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 7. Register — applicant confirmation
// ---------------------------------------------------------------------------
export function registerConfirmEmail(opts: {
  applicantFirstName: string
  role: string
}): { html: string; text: string } {
  const { applicantFirstName, role } = opts
  const isProvider = role === 'provider'

  const bodyHtml = `
    ${p(`Hi ${esc(applicantFirstName)},`)}
    ${p(`We received your ${esc(isProvider ? 'provider' : 'clinic owner')} application for injector.world. Our team will review your credentials and you will hear back within 1 to 2 business days.`)}
    ${p('While you wait, you can browse our treatment guides and directory.')}
    <p style="margin:0 0 20px;">${primaryButton(`${SITE_URL}/guides`, 'Browse treatment guides')}</p>
    ${p('If you have questions, reply to this email.')}
  `

  const text = `Hi ${applicantFirstName},\n\nWe received your ${isProvider ? 'provider' : 'clinic owner'} application. Our team will review it within 1 to 2 business days.\n\nBrowse guides while you wait: ${SITE_URL}/guides\n\ninjector.world`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Application received', bodyHtml }),
    text,
  }
}

/**
 * Newsletter email helpers (Phase 10).
 *
 * All emails include:
 *   - An unsubscribe link (CAN-SPAM requirement).
 *   - A physical mailing address (CAN-SPAM requirement).
 *   - The injector.world branded shell from lib/email.ts.
 *
 * Env:
 *   RESEND_API_KEY       — required to actually send (falls back to console log)
 *   NEWSLETTER_FROM      — from-address (default: newsletter@injector.world)
 *   NEWSLETTER_ADDRESS   — physical mailing address for CAN-SPAM footer
 */

import { emailShell, primaryButton } from './email'

export const NEWSLETTER_FROM =
  process.env.NEWSLETTER_FROM || 'newsletter@injector.world'

export const NEWSLETTER_ADDRESS =
  process.env.NEWSLETTER_ADDRESS || 'injector.world — address on file'

function unsubscribeFooterHtml(unsubscribeUrl: string): string {
  return `
    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#94A3B8;">
      You received this because you subscribed at injector.world.<br/>
      <a href="${unsubscribeUrl}" style="color:#3FA68A;text-decoration:underline;">Unsubscribe</a>
      &nbsp;&middot;&nbsp;
      ${NEWSLETTER_ADDRESS}
    </p>`
}

function unsubscribeFooterText(unsubscribeUrl: string): string {
  return `\n\n---\nYou received this because you subscribed at injector.world.\nUnsubscribe: ${unsubscribeUrl}\n${NEWSLETTER_ADDRESS}`
}

// -------------------------------------------------------------------------
// Shared Resend send (non-blocking: resolves to { sent: true } or logs error)
// -------------------------------------------------------------------------
async function sendMail(opts: {
  to: string
  subject: string
  html: string
  text: string
}): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log(`[newsletter:console] to=${opts.to} subject="${opts.subject}"`)
    console.log(`[newsletter:console] text:\n${opts.text}`)
    return
  }
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)
    await resend.emails.send({
      from: NEWSLETTER_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    } as Parameters<InstanceType<typeof Resend>['emails']['send']>[0])
  } catch (err) {
    console.error(`[newsletter:resend] failed to ${opts.to}:`, (err as Error)?.message)
  }
}

// -------------------------------------------------------------------------
// Confirm subscription (double opt-in)
// -------------------------------------------------------------------------
export async function sendConfirmEmail(opts: {
  to: string
  name?: string | null
  confirmUrl: string
  unsubscribeUrl: string
}): Promise<void> {
  const greeting = opts.name ? `Hi ${opts.name},` : 'Hi,'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
      You asked to join the injector.world newsletter. Click the button below to confirm
      your subscription. This link expires in 48 hours.
    </p>
    ${primaryButton(opts.confirmUrl, 'Confirm my subscription')}
    <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#94A3B8;">
      If you did not sign up for this, you can safely ignore this email.
    </p>
    ${unsubscribeFooterHtml(opts.unsubscribeUrl)}
  `
  const textBody = `${greeting}\n\nConfirm your subscription to the injector.world newsletter:\n${opts.confirmUrl}\n\nIf you did not sign up, ignore this email.${unsubscribeFooterText(opts.unsubscribeUrl)}`

  await sendMail({
    to: opts.to,
    subject: 'Confirm your injector.world subscription',
    html: emailShell({ heading: 'One click to confirm', bodyHtml, siteUrl }),
    text: textBody,
  })
}

// -------------------------------------------------------------------------
// Welcome (sent after confirmation)
// -------------------------------------------------------------------------
export async function sendWelcomeEmail(opts: {
  to: string
  name?: string | null
  unsubscribeUrl: string
}): Promise<void> {
  const greeting = opts.name ? `Welcome, ${opts.name}!` : 'Welcome!'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">
      You are now subscribed to the injector.world newsletter.
    </p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
      We send editorial guides, verified injector spotlights, and treatment news.
      No spam. No paid placements disguised as editorial.
    </p>
    ${primaryButton(`${siteUrl}/guides`, 'Browse treatment guides')}
    ${unsubscribeFooterHtml(opts.unsubscribeUrl)}
  `
  const textBody = `${greeting}\n\nYou're subscribed to the injector.world newsletter.\n\nWe send editorial guides, verified injector spotlights, and treatment news.\n\nBrowse guides: ${siteUrl}/guides${unsubscribeFooterText(opts.unsubscribeUrl)}`

  await sendMail({
    to: opts.to,
    subject: `Welcome to injector.world`,
    html: emailShell({ heading: greeting, bodyHtml, siteUrl }),
    text: textBody,
  })
}

// -------------------------------------------------------------------------
// City / market go-live notification
// -------------------------------------------------------------------------
export async function sendGoLiveEmail(opts: {
  to: string
  name?: string | null
  cityLabel: string
  cityUrl: string
  unsubscribeUrl: string
}): Promise<void> {
  const greeting = opts.name ? `Hi ${opts.name},` : 'Hi,'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">${greeting}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">
      Great news: verified injectors are now live in <strong>${opts.cityLabel}</strong> on injector.world.
      Browse verified providers and read reviews in your area.
    </p>
    ${primaryButton(opts.cityUrl, `Find injectors in ${opts.cityLabel}`)}
    ${unsubscribeFooterHtml(opts.unsubscribeUrl)}
  `
  const textBody = `${greeting}\n\nVerified injectors are now live in ${opts.cityLabel} on injector.world.\n\nFind providers: ${opts.cityUrl}${unsubscribeFooterText(opts.unsubscribeUrl)}`

  await sendMail({
    to: opts.to,
    subject: `Verified injectors are now live in ${opts.cityLabel}`,
    html: emailShell({ heading: `${opts.cityLabel} is live on injector.world`, bodyHtml, siteUrl }),
    text: textBody,
  })
}

// -------------------------------------------------------------------------
// Broadcast (admin-sent to confirmed subscribers)
// -------------------------------------------------------------------------
export async function sendBroadcastEmail(opts: {
  to: string
  name?: string | null
  subject: string
  bodyText: string
  unsubscribeUrl: string
}): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
  const safeBody = opts.bodyText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#475569;">${l || '&nbsp;'}</p>`)
    .join('')

  const bodyHtml = `${safeBody}${unsubscribeFooterHtml(opts.unsubscribeUrl)}`
  const textBody = `${opts.bodyText}${unsubscribeFooterText(opts.unsubscribeUrl)}`

  await sendMail({
    to: opts.to,
    subject: opts.subject,
    html: emailShell({ heading: opts.subject, bodyHtml, siteUrl }),
    text: textBody,
  })
}

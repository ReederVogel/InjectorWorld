import type { EmailAdapter } from 'payload'

/**
 * Custom Payload email adapter backed by the already-installed Resend SDK.
 *
 * Why custom (not @payloadcms/email-resend)? The Resend SDK is already a
 * dependency (used by the bookings route), so a tiny adapter avoids adding a
 * package. It also gives us a console fallback in dev so password-reset and
 * verification links are reachable WITHOUT a RESEND_API_KEY (the link is logged).
 *
 * When RESEND_API_KEY is set, real mail is sent. The from-address domain must be
 * verified in Resend for delivery. Configure EMAIL_FROM_ADDRESS / EMAIL_FROM_NAME
 * to override the defaults.
 */

export const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@injector.world'
export const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'injector.world'

type PayloadEmailMessage = {
  to: string | string[]
  from?: string
  subject: string
  html?: string
  text?: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Payload email adapter: a function Payload calls at init with `{ payload }`,
 * returning the initialized adapter (name + defaults + sendEmail). Payload's
 * `sendEmail` message type is intentionally loose, so we cast to our shape.
 */
export const emailAdapter: EmailAdapter = ({ payload }) => ({
  name: 'resend-or-console',
  defaultFromName: EMAIL_FROM_NAME,
  defaultFromAddress: EMAIL_FROM_ADDRESS,
  async sendEmail(rawMessage) {
    const message = rawMessage as unknown as PayloadEmailMessage
    const key = process.env.RESEND_API_KEY
    const from = message.from || `${EMAIL_FROM_NAME} <${EMAIL_FROM_ADDRESS}>`

    if (!key) {
      // Dev fallback: log so reset/verify links are reachable with no key set.
      payload.logger.info(`[email:console] to=${String(message.to)} subject="${message.subject}"`)
      const body = message.text || (message.html ? stripHtml(message.html) : '')
      if (body) payload.logger.info(`[email:console] body:\n${body}`)
      // Surface any links (reset/verify URLs live in <a href>, which stripHtml drops).
      const links = (message.html || '').match(/href="([^"]+)"/g)?.map((h) => h.slice(6, -1)) || []
      for (const link of links) payload.logger.info(`[email:console] link: ${link}`)
      return { id: 'console', skipped: true }
    }

    try {
      const { Resend } = await import('resend')
      const resend = new Resend(key)
      const res = await resend.emails.send({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text || (message.html ? stripHtml(message.html) : message.subject),
      } as Parameters<typeof resend.emails.send>[0])
      return res
    } catch (err) {
      payload.logger.error(`[email:resend] send failed: ${(err as Error)?.message}`)
      throw err
    }
  },
})

/**
 * Shared branded email shell. Inline styles only (email clients ignore <style>).
 * Navy header band, white body, muted footer. No em dashes, no emojis.
 */
export function emailShell(opts: { heading: string; bodyHtml: string; siteUrl: string }): string {
  const { heading, bodyHtml, siteUrl } = opts
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F7F8FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0B1B34;padding:20px 28px;">
          <span style="color:#FFFFFF;font-size:17px;font-weight:600;letter-spacing:-0.01em;">injector<span style="color:#3FA68A;">.</span>world</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0B1B34;font-weight:600;">${heading}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #EEF1F5;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#94A3B8;">
            Information on injector.world is editorial and not medical advice.<br/>
            <a href="${siteUrl}" style="color:#3FA68A;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export function primaryButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#0B1B34;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:999px;">${label}</a>`
}

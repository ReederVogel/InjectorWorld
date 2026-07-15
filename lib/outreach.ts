import crypto from 'crypto'

/**
 * HMAC signature for claim-invite unsubscribe links (CAN-SPAM one-click).
 * Keyed with PAYLOAD_SECRET so third parties cannot forge unsubscribe URLs
 * for addresses they do not own.
 */
export function outreachUnsubscribeSig(email: string): string {
  return crypto
    .createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev-secret')
    .update(`outreach-unsub:${email.toLowerCase()}`)
    .digest('hex')
    .slice(0, 32)
}

export function outreachUnsubscribeUrl(siteUrl: string, email: string): string {
  return `${siteUrl}/api/outreach/unsubscribe?email=${encodeURIComponent(email.toLowerCase())}&sig=${outreachUnsubscribeSig(email)}`
}

/**
 * Signed invite token carried in the claim link (?inv=<id>.<sig>). Lets the
 * claim page prefill the recipient's email from the ClaimInvite record
 * without ever putting the address itself in the URL.
 */
export function outreachInviteToken(inviteId: number | string): string {
  const id = String(inviteId)
  const sig = crypto
    .createHmac('sha256', process.env.PAYLOAD_SECRET || 'dev-secret')
    .update(`outreach-invite:${id}`)
    .digest('hex')
    .slice(0, 24)
  return `${id}.${sig}`
}

export function verifyOutreachInviteToken(token: string): string | null {
  const dot = token.indexOf('.')
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  if (!/^\d+$/.test(id)) return null
  return outreachInviteToken(id) === token ? id : null
}

/**
 * Quote-and-escape a single CSV field. Also neutralizes formula injection —
 * Excel/Sheets execute a cell that starts with =, +, -, or @ as a formula,
 * so a clinic name like "=cmd|..." pasted from scraped data cannot run code
 * when the exported file is opened.
 */
export function csvEscape(value: string | number | null | undefined): string {
  let v = value == null ? '' : String(value)
  if (/^[=+\-@]/.test(v)) v = `'${v}`
  return `"${v.replace(/"/g, '""')}"`
}

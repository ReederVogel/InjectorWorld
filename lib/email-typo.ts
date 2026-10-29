import { run, POPULAR_DOMAINS } from '@zootools/email-spell-checker'

// The library's list misses the big US webmail domains and reaches them by recombining
// name + ending, which also turns real domains like mayo.edu into "mail.edu". So we
// only ever suggest a domain from this list.
const KNOWN = [...new Set([...POPULAR_DOMAINS, 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com'])]

/**
 * "jane@gmial.com" -> "jane@gmail.com". Undefined when nothing looks mistyped.
 * Keeps the part before the @ exactly as typed (the library lowercases it).
 */
export function emailTypoFix(email: string): string | undefined {
  const at = email.lastIndexOf('@')
  if (at < 1) return undefined
  const s = run({ email, domains: KNOWN })
  if (!s || !KNOWN.includes(s.domain)) return undefined
  if (s.domain === email.slice(at + 1).toLowerCase()) return undefined
  return email.slice(0, at + 1) + s.domain
}

/**
 * Slug for an FAQ category, and the anchor id for a single question on its page.
 *
 * Accents are folded, not deleted, so "Juvéderm" becomes "juvederm" rather than
 * "juv-derm" (the same bug lib/clinic-slug-hook.ts once had).
 */
export function faqKebab(s: string, max = 80): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

/** `#will-botox-make-me-look-frozen`. Stable as long as the question text is. */
export function faqAnchor(question: string): string {
  return faqKebab(question, 90) || 'question'
}

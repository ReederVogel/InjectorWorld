/**
 * `sizes` values for DirectoryClinicCard photos (2026-09-24,
 * docs/PAGE-SPEED-PLAN-2026-09-24.md TASK 2).
 *
 * Kept out of the card's own module on purpose: that file is 'use client', and
 * a Server Component importing a plain value from a client module receives a
 * client reference, not the string.
 *
 * LISTING: a card in a grid beside the 280px filter sidebar (every directory
 * listing). Worked from the layout:
 *   >=1280: content 1200 (1280 minus px-10 twice) - 280 sidebar - 24 gap = 896,
 *           3 columns with 20px gaps = 285px a card.
 *   1024-1279: 3 columns of (100vw - 80 - 304 - 40) / 3, 200-265px, so 22vw.
 *   768-1023: sidebar shown, 2 columns of 170-300px.
 *   640-767: no sidebar, 2 columns = 50vw. Below 640: one column, full width.
 * The old "33vw / 50vw / 100vw" ignored the sidebar and shipped photos up to
 * 586KB larger than shown per page (Lighthouse image-delivery-insight).
 */
export const LISTING_CARD_SIZES =
  '(min-width:1280px) 290px, (min-width:1024px) 22vw, (min-width:768px) 300px, (min-width:640px) 50vw, 100vw'

/** Same card in a full-width 3-column row with no sidebar (homepage, related clinics). */
export const WIDE_CARD_SIZES = '(min-width:1280px) 400px, (min-width:768px) 33vw, 100vw'

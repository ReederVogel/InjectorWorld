/**
 * Reasons on the "Report an issue with this listing" form. One list shared by
 * the client form, the API route and the ListingReports collection, kept in its
 * own file so the client bundle does not pull in collection/server code.
 */
export const LISTING_REPORT_REASONS = [
  { label: 'Wrong address or phone', value: 'wrong_contact' },
  { label: 'Wrong opening hours', value: 'wrong_hours' },
  { label: 'Clinic is permanently closed', value: 'closed' },
  { label: 'Wrong or broken website', value: 'wrong_website' },
  { label: 'Treatments or brands are wrong', value: 'wrong_treatments' },
  { label: 'Photos are wrong', value: 'wrong_photos' },
  { label: 'Duplicate listing', value: 'duplicate' },
  { label: 'Not an injector clinic', value: 'not_injector' },
  { label: 'Something else', value: 'other' },
] as const

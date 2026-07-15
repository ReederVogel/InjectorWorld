/**
 * Single source of truth for "is this clinic profile complete" — used by both
 * the clinic dashboard checklist and the owner-only nudge on the public
 * clinic page, so the two never disagree about what counts as done.
 */

export type ClinicCompletenessStep = {
  key: string
  label: string
  done: boolean
  hint: string
}

export type ClinicCompletenessInput = {
  photos?: unknown[] | null
  servicesOffered?: unknown[] | null
  phone?: string | null
  email?: string | null
  websiteUrl?: string | null
  description?: string | null
  hoursJson?: Record<string, unknown> | null
}

export function computeClinicCompleteness(clinic: ClinicCompletenessInput): ClinicCompletenessStep[] {
  const hasPhotos = Array.isArray(clinic.photos) && clinic.photos.length > 0
  const hasServices = Array.isArray(clinic.servicesOffered) && clinic.servicesOffered.length > 0
  const hasContact = Boolean(clinic.phone?.trim() || clinic.email?.trim() || clinic.websiteUrl?.trim())
  const hasDescription = Boolean(clinic.description?.trim())
  const hasHours = Boolean(clinic.hoursJson && Object.keys(clinic.hoursJson).length > 0)

  return [
    {
      key: 'photos',
      label: 'Add clinic photos',
      done: hasPhotos,
      hint: 'Real photos build trust and get more clicks than a blank listing.',
    },
    {
      key: 'services',
      label: 'List your services',
      done: hasServices,
      hint: 'Required so patients find you in treatment-specific search.',
    },
    {
      key: 'contact',
      label: 'Add a phone, email, or website',
      done: hasContact,
      hint: 'Gives patients a way to reach you beyond the consult form.',
    },
    {
      key: 'description',
      label: 'Write a clinic description',
      done: hasDescription,
      hint: 'Tell patients about your team and approach.',
    },
    {
      key: 'hours',
      label: 'Set your opening hours',
      done: hasHours,
      hint: 'Shown on your public page so patients know when to visit.',
    },
  ]
}

import 'server-only'
import { z } from 'zod'

/** Text fields of an owner's before/after upload (POST /api/dashboard/before-after). */
export const BeforeAfterFields = z.object({
  serviceTag: z.string().trim().min(1, 'Choose the treatment.').max(80),
  // Not z.coerce: Number('') is 0, so an empty box would read as "right after treatment".
  weeksPost: z.preprocess(
    (v) => (v === '' || v == null ? undefined : Number(v)),
    z.number({ required_error: 'Enter the weeks between the photos.', invalid_type_error: 'Enter the weeks between the photos.' }).int().min(0).max(520),
  ),
  patientNote: z.string().trim().max(300).optional(),
  consent: z.literal('true', { errorMap: () => ({ message: 'Confirm you have the patient’s written consent.' }) }),
})

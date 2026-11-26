/** Before and after cases (collections/BeforeAfterCases.ts), shared by the dashboard, its API and the clinic page. */

/** Cases one clinic may keep, any status. */
export const MAX_BEFORE_AFTER = 30

export type CaseStatus = 'pending' | 'approved' | 'rejected'

export type OwnerCase = {
  id: number
  beforeUrl: string
  afterUrl: string
  serviceTag: string
  weeksPost: number
  patientNote?: string
  status: CaseStatus
}

export const toOwnerCase = (d: any): OwnerCase => ({
  id: Number(d.id),
  beforeUrl: d.beforePhotoUrl,
  afterUrl: d.afterPhotoUrl,
  serviceTag: d.serviceTag,
  weeksPost: Number(d.weeksPost) || 0,
  patientNote: d.patientNote || undefined,
  status: (d.status as CaseStatus) || 'pending',
})

export function weeksLabel(weeks: number): string {
  if (weeks <= 0) return 'Right after treatment'
  return `${weeks} week${weeks === 1 ? '' : 's'} after`
}

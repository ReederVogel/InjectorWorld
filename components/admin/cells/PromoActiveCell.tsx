'use client'

import { Badge } from './Badge'

/**
 * List cell for Promotions.active. Reads the row's endDate so an active promo
 * whose end date has passed reads as "Expired" rather than a misleading "Active".
 */
export function PromoActiveCell(props: any) {
  const active: boolean = !!(props?.cellData ?? props?.rowData?.active)
  if (!active) return <Badge label="Inactive" tone="grey" />

  const endDate = props?.rowData?.endDate
  if (endDate && new Date(endDate).getTime() < Date.now()) {
    return <Badge label="Expired" tone="red" />
  }
  return <Badge label="Active" tone="green" />
}

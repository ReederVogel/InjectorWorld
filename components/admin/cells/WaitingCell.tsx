'use client'

/** List cell for Claims — shows how many days ago the claim was submitted. */
export function WaitingCell(props: any) {
  const created: string | undefined = props?.rowData?.createdAt
  if (!created) return <span>—</span>
  const days = Math.floor((Date.now() - new Date(created).getTime()) / 86400000)
  if (days === 0) return <span style={{ fontSize: 13, color: '#3FA68A' }}>Today</span>
  const color = days >= 7 ? '#B91C1C' : days >= 3 ? '#C2A14E' : 'inherit'
  return (
    <span style={{ fontSize: 13, color }}>
      {days} day{days === 1 ? '' : 's'}
    </span>
  )
}

'use client'

import { useState } from 'react'
import { QAQuickAnswerInline } from '../quick-actions/QAQuickAnswerInline'

/** List cell wrapper for QA's `quickAnswer` ui field (no DB column, presentation-only). */
export function QAQuickAnswerCell(props: any) {
  const initial: string = props?.rowData?.status ?? ''
  const [status, setStatus] = useState(initial)
  const id = props?.rowData?.id

  if (id == null) return null
  return <QAQuickAnswerInline id={id} status={status} onDone={setStatus} />
}

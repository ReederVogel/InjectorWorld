'use client'

/**
 * A live "143 of 200 characters" / "54 words (aim for 40 to 80)" line under
 * a text field (Payload afterInput slot; Payload passes the field's path).
 */

import { useFormFields } from '@payloadcms/ui'
import { countWords } from '../find/find-engine'

type Props = { path: string; unit?: 'chars' | 'words'; min?: number; max?: number }

export function LengthCounter({ path, unit = 'chars', min, max }: Props) {
  const value = useFormFields(([f]) => f[path]?.value)
  const text = typeof value === 'string' ? value : ''
  const n = unit === 'words' ? countWords(text) : text.length
  const noun = unit === 'words' ? (n === 1 ? 'word' : 'words') : n === 1 ? 'character' : 'characters'
  const over = max !== undefined && n > max
  const under = min !== undefined && n > 0 && n < min

  let label = `${n.toLocaleString('en-US')} ${noun}`
  if (min !== undefined && max !== undefined) label += ` (aim for ${min} to ${max})`
  else if (max !== undefined) label = `${n.toLocaleString('en-US')} of ${max} ${unit === 'words' ? 'words' : 'characters'}`

  const color = over
    ? 'var(--theme-error-500, #B91C1C)'
    : under
      ? 'var(--theme-warning-700, #8a6d1f)'
      : 'var(--theme-elevation-500)'
  return (
    <div aria-live="polite" style={{ marginTop: 4, fontSize: 12, color, fontWeight: over ? 600 : undefined }}>
      {label}
    </div>
  )
}

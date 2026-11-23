'use client'

/**
 * A line under the article body: word count and an estimated reading time.
 *
 * On Guides it also compares that estimate with the "Read Time Min" field
 * (what the guide page shows as "N min read") and offers one click to fill
 * it in. Nothing is filled in on its own: every guide had that field empty
 * when this was added (2026-11-24), so the site showed no read time anywhere,
 * and an automatic value would put a new line on public pages as a side
 * effect of an unrelated edit.
 */

import { useField, useFormFields } from '@payloadcms/ui'
import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { READ_WPM, lexicalWordCount, readMinutes } from '../find/find-engine'

type Props = { bodyPath?: string; readTimePath?: string }

export function BodyStats({ bodyPath = 'body', readTimePath }: Props) {
  const body = useFormFields(([fields]) => fields[bodyPath]?.value)
  const words = useMemo(() => lexicalWordCount(body), [body])
  const minutes = readMinutes(words)

  return (
    <div style={S.row} aria-live="polite">
      <span>
        {words.toLocaleString('en-US')} {words === 1 ? 'word' : 'words'}
        {minutes > 0 && <> · about {minutes} min read</>}
      </span>
      {readTimePath && minutes > 0 && <ReadTimeSuggestion path={readTimePath} minutes={minutes} />}
    </div>
  )
}

function ReadTimeSuggestion({ path, minutes }: { path: string; minutes: number }) {
  const { value, setValue, disabled } = useField<number | null>({ path })
  const current = typeof value === 'number' && value > 0 ? value : null

  if (current === minutes) return <span style={S.ok}>Read time field matches.</span>
  return (
    <span style={S.suggest}>
      {current === null ? 'Read time is empty, so the guide shows none.' : `Read time field says ${current} min.`}
      {!disabled && (
        <button
          type="button"
          style={S.button}
          title={`Sets Read Time Min to ${minutes} (about ${READ_WPM} words a minute). Save to keep it.`}
          onClick={() => setValue(minutes)}
        >
          {current === null ? `Set to ${minutes} min` : `Change to ${minutes} min`}
        </button>
      )}
    </span>
  )
}

const S: Record<string, CSSProperties> = {
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '4px 16px',
    margin: '-12px 0 var(--spacing-field, 24px)',
    fontSize: 12,
    color: 'var(--theme-elevation-500)',
  },
  ok: { color: 'var(--theme-elevation-500)' },
  suggest: { display: 'inline-flex', alignItems: 'baseline', gap: 8 },
  button: {
    padding: 0,
    borderWidth: 0,
    background: 'transparent',
    color: 'var(--theme-elevation-800)',
    fontFamily: 'inherit',
    fontSize: 12,
    textDecoration: 'underline',
    cursor: 'pointer',
  },
}

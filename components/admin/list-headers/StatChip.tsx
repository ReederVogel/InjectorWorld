'use client'

import type { CSSProperties } from 'react'

type Tone = 'default' | 'success' | 'warn' | 'danger'

const TONE_COLORS: Record<Tone, { bg: string; border: string; text: string }> = {
  default: {
    bg: 'var(--theme-elevation-50, #fff)',
    border: 'var(--theme-elevation-150, #e2e8f0)',
    text: 'inherit',
  },
  success: { bg: '#E6F2EE', border: '#3FA68A', text: '#0B1B34' },
  warn: { bg: '#FBF3E1', border: '#C2A14E', text: '#0B1B34' },
  danger: { bg: '#FDECEC', border: '#B91C1C', text: '#B91C1C' },
}

export function StatChip({
  label,
  count,
  href,
  tone = 'default',
  suffix,
}: {
  label: string
  count: number | null | undefined
  href?: string
  tone?: Tone
  /** Appended after the formatted count, e.g. " days". */
  suffix?: string
}) {
  const colors = TONE_COLORS[tone]
  const display = count == null ? '—' : `${count.toLocaleString()}${suffix ?? ''}`

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    padding: '7px 14px',
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    background: colors.bg,
    color: colors.text,
    whiteSpace: 'nowrap',
  }

  const content = (
    <>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{label}</span>
      <span>{display}</span>
    </>
  )

  if (href) {
    return (
      <a href={href} style={style}>
        {content}
      </a>
    )
  }

  return <span style={style}>{content}</span>
}

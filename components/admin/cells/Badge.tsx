'use client'

import type { CSSProperties } from 'react'

export type Tone = 'red' | 'amber' | 'blue' | 'green' | 'grey'

const TONES: Record<Tone, { text: string; bg: string }> = {
  red: { text: '#c0392b', bg: 'rgba(185,28,28,0.12)' },
  amber: { text: '#b7791f', bg: 'rgba(194,161,78,0.20)' },
  blue: { text: '#2563eb', bg: 'rgba(37,99,235,0.12)' },
  green: { text: '#2f8d73', bg: 'rgba(63,166,138,0.16)' },
  grey: { text: '#64748b', bg: 'rgba(100,116,139,0.12)' },
}

/**
 * Small color-coded status pill for Payload list cells. Tone-only styling so it
 * reads on both the light and dark admin themes (translucent background tint).
 */
export function Badge({ label, tone, suffix }: { label: string; tone: Tone; suffix?: string }) {
  const c = TONES[tone]
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '2px 9px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '18px',
    color: c.text,
    background: c.bg,
    whiteSpace: 'nowrap',
  }
  return (
    <span style={style}>
      {label}
      {suffix ? <span style={{ opacity: 0.75, fontWeight: 500 }}>{suffix}</span> : null}
    </span>
  )
}

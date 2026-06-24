'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { StateEntry } from '@/lib/location-queries'

type Props = {
  treatmentSlug: string
  states: StateEntry[]
}

export function IpStateHint({ treatmentSlug, states }: Props) {
  const [selectedSlug, setSelectedSlug] = useState('')
  const [detected, setDetected] = useState(false)

  useEffect(() => {
    fetch('/api/geo/ip')
      .then((r) => r.json())
      .then((d) => {
        if (d.stateCode) {
          const match = states.find((s) => s.code === d.stateCode)
          if (match) {
            setSelectedSlug(match.slug)
            setDetected(true)
          }
        }
      })
      .catch(() => {})
  }, [states])

  if (!detected) return null

  const target = states.find((s) => s.slug === selectedSlug)
  if (!target) return null

  return (
    <div className="flex items-center gap-2 flex-wrap text-body-sm text-ink-secondary bg-brand-accent-soft border border-brand-accent/20 rounded-xl px-4 py-3 mb-6">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span>
        Showing results near{' '}
        <strong className="text-ink-primary font-semibold">{target.name}</strong>.
      </span>
      <span className="text-ink-tertiary">Change:</span>
      <select
        value={selectedSlug}
        onChange={(e) => setSelectedSlug(e.target.value)}
        className="text-body-sm border border-border rounded-md px-2 py-0.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent cursor-pointer"
        aria-label="Change state"
      >
        {states.map((s) => (
          <option key={s.code} value={s.slug}>{s.name}</option>
        ))}
      </select>
      <Link
        href={`/services/${treatmentSlug}/${target.slug}`}
        className="text-brand-accent font-medium hover:underline"
      >
        Show {target.name}
      </Link>
    </div>
  )
}

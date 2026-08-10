'use client'

import { useEffect, useRef, useState } from 'react'
import type { ClinicHours } from '@/lib/clinic-queries'

/**
 * Live open/closed line with the full week in a dropdown.
 *
 * Was a full-width strip under the hero from 2026-08-06 until 2026-08-11, when
 * the client moved it into the hero's clinic-details list. It renders bare now:
 * no section, no background, no page gutter. The caller supplies the row.
 *
 * It sits last in that list on purpose. The dropdown is seven rows tall, so
 * opening it from any earlier position would shove phone and website down the
 * page; from the bottom it only pushes the social row.
 *
 * Status is computed after mount, from the visitor's own clock. Doing it during
 * render would mean the server (UTC on the box) and the browser disagree about
 * what day it is, which is a hydration mismatch. Until then it shows a neutral
 * "Hours" label, so nothing jumps except the text itself.
 */

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

/** "9:00-17:00", "9am - 5pm", "09:00 – 17:30" all land as minutes from midnight. */
function parseRange(raw?: string): { open: number; close: number } | null {
  if (!raw || /^closed$/i.test(raw.trim())) return null
  const parts = raw.split(/\s*[-–—]\s*/)
  if (parts.length !== 2) return null
  const toMinutes = (t: string): number | null => {
    const m = t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i)
    if (!m) return null
    let h = Number(m[1])
    const min = Number(m[2] || 0)
    const period = m[3]?.toLowerCase()
    if (period === 'pm' && h < 12) h += 12
    else if (period === 'am' && h === 12) h = 0
    if (h > 23 || min > 59) return null
    return h * 60 + min
  }
  const open = toMinutes(parts[0])
  const close = toMinutes(parts[1])
  if (open === null || close === null) return null
  return { open, close }
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  const period = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, '0')}${period}`
}

function formatDisplay(raw?: string): string {
  if (!raw) return 'Closed'
  if (/^closed$/i.test(raw.trim())) return 'Closed'
  const range = parseRange(raw)
  return range ? `${formatMinutes(range.open)} - ${formatMinutes(range.close)}` : raw
}

type Status = { open: boolean; detail: string; todayIndex: number }

function computeStatus(hours: ClinicHours): Status {
  const now = new Date()
  const todayIndex = (now.getDay() + 6) % 7
  const minutes = now.getHours() * 60 + now.getMinutes()
  const range = parseRange(hours[DAY_KEYS[todayIndex]])

  if (range && minutes >= range.open && minutes <= range.close) {
    return { open: true, detail: `Closes ${formatMinutes(range.close)}`, todayIndex }
  }
  if (range && minutes < range.open) {
    return { open: false, detail: `Opens today ${formatMinutes(range.open)}`, todayIndex }
  }
  for (let i = 1; i <= 7; i++) {
    const next = (todayIndex + i) % 7
    const nextRange = parseRange(hours[DAY_KEYS[next]])
    if (nextRange) {
      return {
        open: false,
        detail: `Opens ${DAY_LABELS[DAY_KEYS[next]]} ${formatMinutes(nextRange.open)}`,
        todayIndex,
      }
    }
  }
  return { open: false, detail: 'Hours not listed', todayIndex }
}

export function ClinicHoursBar({ hours }: { hours: ClinicHours }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => setStatus(computeStatus(hours)), [hours])

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="clinic-hours-week"
        className="flex items-center gap-2 text-body text-ink-primary"
      >
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${
            status === null ? 'bg-ink-tertiary' : status.open ? 'bg-brand-accent' : 'bg-state-error'
          }`}
        />
        <b className={`font-semibold ${status && !status.open ? 'text-state-error' : ''}`}>
          {status === null ? 'Hours' : status.open ? 'Open now' : 'Closed'}
        </b>
        {status !== null && (
          <>
            <span className="text-ink-tertiary">·</span>
            <span className="text-ink-secondary">{status.detail}</span>
          </>
        )}
        <svg
          aria-hidden
          width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          id="clinic-hours-week"
          className="absolute left-0 top-full z-30 mt-1.5 min-w-[290px] overflow-hidden rounded-control border border-border bg-surface-canvas shadow-lg"
        >
          <table className="w-full border-collapse">
            <tbody>
              {DAY_KEYS.map((day, i) => {
                const raw = hours[day]
                const closed = !raw || /^closed$/i.test(raw.trim())
                const isToday = status?.todayIndex === i
                return (
                  <tr
                    key={day}
                    className={isToday ? 'bg-brand-accent/5 shadow-[inset_3px_0_0_rgb(var(--brand-accent))]' : ''}
                  >
                    <th className="border-t border-border-subtle px-5 py-2.5 text-left text-body-sm font-semibold text-ink-primary">
                      {DAY_LABELS[day]}
                    </th>
                    <td
                      className={`border-t border-border-subtle px-5 py-2.5 text-right text-body-sm ${
                        closed ? 'text-ink-tertiary' : 'text-ink-secondary'
                      }`}
                    >
                      {formatDisplay(raw)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

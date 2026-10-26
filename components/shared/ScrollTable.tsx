'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Article table box (QA IW-1LPA, 2026-10-26). Tables already scrolled sideways
 * inside `.lex-table-wrap`, but nothing said so: on phones the right-hand
 * columns (the price, on cost guides) were simply cut off, and keyboard users
 * could not reach the scroll box at all. When the table is wider than its box
 * this adds a one-line hint and makes the box focusable, so arrow keys scroll it.
 */
export function ScrollTable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setWide(el.scrollWidth > el.clientWidth + 1)
    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div
        ref={ref}
        className="lex-table-wrap"
        role="region"
        aria-label="Table"
        tabIndex={wide ? 0 : undefined}
      >
        {children}
      </div>
      {wide && (
        <p className="lex-table-hint" aria-hidden="true">
          Swipe or scroll sideways to see the full table
        </p>
      )}
    </>
  )
}

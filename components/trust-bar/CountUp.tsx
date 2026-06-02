'use client'

import { useEffect, useRef, useState } from 'react'

export function CountUp({
  to,
  suffix = '',
  duration = 1600,
  format = 'comma',
  className = '',
}: {
  to: number
  suffix?: string
  duration?: number
  format?: 'comma' | 'plain'
  className?: string
}) {
  const [value, setValue] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !startedRef.current) {
          startedRef.current = true
          const start = performance.now()
          function tick(now: number) {
            const t = Math.min(1, (now - start) / duration)
            const eased = 1 - Math.pow(1 - t, 3)
            setValue(Math.round(eased * to))
            if (t < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      })
    }, { threshold: 0.3 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [to, duration])

  const display = format === 'comma' ? value.toLocaleString('en-US') : String(value)

  return <span ref={ref} className={`tabular-nums ${className}`}>{display}{suffix}</span>
}

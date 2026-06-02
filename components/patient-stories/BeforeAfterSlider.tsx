'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  alt,
}: {
  beforeUrl: string
  afterUrl: string
  alt: string
}) {
  const [pos, setPos] = useState(50) // %
  const [isHinting, setIsHinting] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const hintTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left))
    setPos((x / rect.width) * 100)
  }, [])

  // One-time drag hint: 50% → 35% → 50%
  useEffect(() => {
    setIsHinting(true)
    hintTimers.current = [
      setTimeout(() => setPos(35), 800),
      setTimeout(() => setPos(50), 1500),
      // Remove transition after back-animation finishes (~600ms)
      setTimeout(() => setIsHinting(false), 2200),
    ]
    return () => hintTimers.current.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
      if (clientX != null) setFromClientX(clientX)
    }
    function onUp() { draggingRef.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [setFromClientX])

  function startDrag(e: React.MouseEvent | React.TouchEvent) {
    // Cancel hint on first interaction
    hintTimers.current.forEach(clearTimeout)
    setIsHinting(false)
    draggingRef.current = true
    const clientX = 'touches' in e ? e.touches[0]?.clientX : (e as React.MouseEvent).clientX
    if (clientX != null) setFromClientX(clientX)
  }

  // Smooth transition only during hint, instant during drag
  const moveStyle = isHinting
    ? { transition: 'left 0.6s cubic-bezier(0.4,0,0.2,1)' }
    : {}
  const clipStyle = isHinting
    ? { transition: 'clip-path 0.6s cubic-bezier(0.4,0,0.2,1)' }
    : {}

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[4/5] rounded-xl overflow-hidden select-none cursor-ew-resize bg-surface"
      onMouseDown={startDrag}
      onTouchStart={startDrag}
    >
      {/* After (base layer) */}
      <Image
        src={afterUrl}
        alt={`${alt} after`}
        fill
        sizes="(min-width:1024px) 33vw, 90vw"
        className="object-cover pointer-events-none"
        draggable={false}
      />

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, ...clipStyle }}
      >
        <Image
          src={beforeUrl}
          alt={`${alt} before`}
          fill
          sizes="(min-width:1024px) 33vw, 90vw"
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span className="absolute top-3 left-3 text-[10px] font-semibold tracking-wider uppercase bg-black/55 text-white px-2 py-1 rounded-pill">
        Before
      </span>
      <span className="absolute top-3 right-3 text-[10px] font-semibold tracking-wider uppercase bg-brand-accent text-white px-2 py-1 rounded-pill">
        After
      </span>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
        style={{
          left: `${pos}%`,
          transform: 'translateX(-50%)',
          boxShadow: '0 0 12px rgba(0,0,0,0.4)',
          ...moveStyle,
        }}
      />

      {/* Handle */}
      <div
        className="absolute top-1/2 w-10 h-10 rounded-pill bg-white shadow-lg flex items-center justify-center text-ink-primary pointer-events-none"
        style={{ left: `${pos}%`, transform: 'translate(-50%, -50%)', ...moveStyle }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
          <polyline points="9 6 15 12 9 18" transform="translate(8 0)" />
        </svg>
      </div>
    </div>
  )
}
